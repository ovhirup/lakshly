import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { evaluateFeaturePolicy } from './index.ts';

const directory = fileURLToPath(new URL('./', import.meta.url));
const fixture = JSON.parse(readFileSync(join(directory, 'fixtures.synthetic.json'), 'utf8'));
const corpus = JSON.parse(readFileSync(join(directory, 'swift-parity-cases.synthetic.json'), 'utf8'));
const originalFixture = JSON.stringify(fixture);
const originalCorpus = JSON.stringify(corpus);
function assert(condition, message) { if (!condition) throw new Error(message); }
function equal(actual, expected, message) {
  assert(isDeepStrictEqual(actual, expected), `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`);
}
function keys(value, required, optional = []) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed (${result.status ?? 'no exit'}): ${result.error?.message ?? ''}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result;
}
const bases = new Map();
for (const item of fixture.cases) {
  assert(typeof item.id === 'string' && !bases.has(item.id), 'Ambiguous original fixture case ID');
  bases.set(item.id, item);
}
assert(keys(corpus, ['policyVersion', 'marker', 'cases']) && corpus.policyVersion === 1
  && corpus.marker === 'SYNTHETIC' && Array.isArray(corpus.cases) && corpus.cases.length === 38,
  'Invalid synthetic parity corpus document');
assert(fixture.marker === 'SYNTHETIC' && fixture.cases.length === 54, 'Unexpected C1 literal fixture');
const ids = new Set();
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
function mutatedEnvelope(item) {
  assert(keys(item, ['id', 'baseCaseId', 'target', 'path', 'operation', 'expectedReason'], ['value']), 'Unexpected mutation fields');
  assert(typeof item.id === 'string' && item.id.startsWith('synthetic.') && !ids.has(item.id), 'Duplicate/invalid corpus ID');
  ids.add(item.id);
  assert(typeof item.baseCaseId === 'string' && bases.has(item.baseCaseId), 'Unknown corpus base case');
  assert(['catalog', 'context', 'request'].includes(item.target), 'Invalid mutation target');
  assert(Array.isArray(item.path) && item.path.every(part => typeof part === 'string'
    ? part.length > 0 && !unsafe.has(part) : Number.isSafeInteger(part) && part >= 0), 'Invalid/unsafe mutation path');
  assert(['replace', 'remove'].includes(item.operation), 'Invalid mutation operation');
  assert(item.operation === 'replace' ? Object.hasOwn(item, 'value') : !Object.hasOwn(item, 'value'), 'Invalid mutation value');
  assert(['invalid_catalog', 'invalid_context', 'invalid_request', 'unknown_feature'].includes(item.expectedReason), 'Invalid literal expected reason');
  const base = bases.get(item.baseCaseId);
  const envelope = structuredClone({ catalog: fixture.catalog, context: base.context, request: base.request });
  if (item.path.length === 0) {
    assert(item.operation === 'replace', 'Root removal is forbidden');
    envelope[item.target] = structuredClone(item.value); return envelope;
  }
  let container = envelope[item.target];
  for (let i = 0; i < item.path.length; i++) {
    const part = item.path[i];
    if (Array.isArray(container)) {
      assert(Number.isSafeInteger(part) && part >= 0 && part < container.length && Object.hasOwn(container, part), 'Invalid array index');
    } else {
      assert(container !== null && typeof container === 'object' && typeof part === 'string'
        && Object.hasOwn(container, part), 'Nonexistent mutation path');
    }
    if (i === item.path.length - 1) {
      if (item.operation === 'remove') {
        assert(!Array.isArray(container), 'Array-element removal is unsupported'); delete container[part];
      } else container[part] = structuredClone(item.value);
    } else container = container[part];
  }
  return envelope;
}
const mutations = corpus.cases.map(item => ({ item, envelope: mutatedEnvelope(item) }));

const temporary = mkdtempSync(join(tmpdir(), 'lakshly-feature-policy-parity-'));
try {
  const generated = run(process.execPath, [join(directory, 'generate-swift.mjs'), '--check']);
  process.stdout.write(generated.stdout);
  const executable = join(temporary, 'feature-policy-cli');
  const compiled = run('swiftc', ['-parse-as-library', '-module-cache-path', join(temporary, 'module-cache'),
    join(directory, 'generated/FeaturePolicyContract.swift'), join(directory, 'swift/FeaturePolicyReference.swift'),
    join(directory, 'swift/FeaturePolicyCLI.swift'), '-o', executable]);
  if (compiled.stderr) process.stderr.write(compiled.stderr);
  console.log('Swift compile: PASS (Foundation/CoreFoundation headless CLI).');
  function decisions(lines) {
    const result = run(executable, [], { input: lines.join('\n') + '\n' });
    assert(!result.stderr, `Unexpected CLI stderr: ${result.stderr}`);
    const output = result.stdout.trimEnd().split('\n').map(line => JSON.parse(line));
    assert(output.length === lines.length, 'CLI response count mismatch');
    return output;
  }
  const literalEnvelopes = fixture.cases.map(item => ({ catalog: fixture.catalog, context: item.context, request: item.request }));
  const swiftLiteral = decisions(literalEnvelopes.map(value => JSON.stringify(value)));
  fixture.cases.forEach((item, index) => {
    const envelope = literalEnvelopes[index];
    equal(evaluateFeaturePolicy(envelope.catalog, envelope.context, envelope.request), item.expected, `TS literal ${item.id}`);
    equal(swiftLiteral[index], item.expected, `Swift literal ${item.id}`);
  });
  console.log(`Literal decision parity: PASS (${fixture.cases.length} full expected decisions).`);
  const swiftMutations = decisions(mutations.map(({ envelope }) => JSON.stringify(envelope)));
  mutations.forEach(({ item, envelope }, index) => {
    const expected = evaluateFeaturePolicy(envelope.catalog, envelope.context, envelope.request);
    assert(expected.reason === item.expectedReason, `TS corpus ${item.id}: ${expected.reason} != ${item.expectedReason}`);
    equal(swiftMutations[index], expected, `Swift mutation ${item.id}`);
  });
  console.log(`Mutation decision parity: PASS (${mutations.length} full decisions with literal reasons).`);
  const normal = JSON.stringify(literalEnvelopes[0]);
  const exponent = normal.replaceAll('"policyVersion":1', '"policyVersion":1e0');
  const negativeZero = normal.replace('"used":0', '"used":-0');
  const lexical = [normal, exponent, negativeZero];
  const lexicalOutput = decisions(lexical);
  lexical.forEach((line, index) => {
    const parsed = JSON.parse(line);
    equal(evaluateFeaturePolicy(parsed.catalog, parsed.context, parsed.request), fixture.cases[0].expected, 'TS lexical numeric equivalence');
    equal(lexicalOutput[index], fixture.cases[0].expected, 'Swift lexical numeric equivalence');
  });
  console.log('Lexical numeric parity: PASS (1e0 versions and -0 usage).');
  const transport = decisions(['{', 'null', '[]', '{}', JSON.stringify({ ...literalEnvelopes[0], unexpected: true }), normal]);
  equal(transport.slice(0, 5), [{ error: 'invalid_json' }, ...Array.from({ length: 4 }, () => ({ error: 'invalid_envelope' }))], 'Malformed transport');
  equal(transport[5], fixture.cases[0].expected, 'CLI continues after malformed lines');
  console.log('Malformed transport: PASS (invalid JSON/envelopes, then valid decision).');
  const roundTrip = run(executable, ['--round-trip-fixture'], { input: JSON.stringify(fixture) });
  assert(!roundTrip.stderr, `Unexpected fixture stderr: ${roundTrip.stderr}`);
  equal(JSON.parse(roundTrip.stdout), fixture, 'Generated Codable fixture round-trip including required nulls');
  console.log('Fixture round-trip: PASS (every value/key, including explicit required nulls).');
  equal(JSON.stringify(fixture), originalFixture, 'Original fixture/expected values mutated');
  equal(JSON.stringify(corpus), originalCorpus, 'Original mutation corpus mutated');
  console.log('Input immutability: PASS.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
