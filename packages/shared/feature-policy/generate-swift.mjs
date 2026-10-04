import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = new URL('./', import.meta.url);
const schemaBytes = readFileSync(new URL('feature-policy.schema.json', directory));
const schema = JSON.parse(schemaBytes);
const fail = message => { throw new Error(`Unsupported feature-policy v1 schema: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };
assert(JSON.stringify(Object.keys(schema).sort()) === JSON.stringify(['$schema', '$id', '$ref', '$defs'].sort()), 'root keys');
assert(schema.$id === 'https://lakshly.app/schemas/feature-policy-v1', 'root ID');
const defs = schema.$defs;
const modelNames = {
  availability: 'Availability', feature: 'Feature', catalog: 'Catalog', entitlement: 'Entitlement',
  context: 'Context', request: 'Request', decision: 'Decision', fixtureCase: 'FixtureCase', fixtureDocument: 'FixtureDocument',
};
assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'draft');
assert(schema.$ref === '#/$defs/fixtureDocument', 'root');
assert(JSON.stringify(Object.keys(defs)) === JSON.stringify(Object.keys(modelNames)), 'definition order/names');
const quote = value => JSON.stringify(value);
const keywords = new Set(['private', 'public', 'internal', 'default', 'case', 'class', 'struct', 'enum', 'none', 'repeat']);
const swiftCase = value => keywords.has(value) ? `\`${value}\`` : value;
const enumDefinitions = {
  Suite: defs.availability.properties.suite,
  Channel: defs.availability.properties.channel,
  Platform: defs.availability.properties.platform,
  PublicTier: defs.feature.properties.minimumPublicTier,
  Tier: defs.decision.properties.effectiveTier.anyOf[0],
  EntitlementKind: defs.entitlement.properties.kind,
  Provenance: defs.entitlement.properties.provenance,
  EntitlementState: defs.entitlement.properties.state,
  Reason: defs.decision.properties.reason,
  AccessBasis: defs.decision.properties.accessBasis.anyOf[0],
};
const enumUse = {
  'Availability.suite': 'Suite', 'Availability.channel': 'Channel', 'Availability.platform': 'Platform',
  'Feature.audience': 'Suite', 'Feature.supportedPlatforms[]': 'Platform', 'Feature.minimumPublicTier': 'PublicTier',
  'Context.suite': 'Suite', 'Context.channel': 'Channel', 'Context.platform': 'Platform',
  'Entitlement.kind': 'EntitlementKind', 'Entitlement.provenance': 'Provenance', 'Entitlement.state': 'EntitlementState',
  'Decision.reason': 'Reason', 'Decision.effectiveTier': 'Tier', 'Decision.accessBasis': 'AccessBasis',
};
const expectedFields = {
  Availability: ['suite', 'channel', 'platform'],
  Feature: ['id', 'audience', 'implemented', 'enabled', 'supportedPlatforms', 'availableIn', 'minimumPublicTier', 'quota'],
  Catalog: ['policyVersion', 'policyRevision', 'features'],
  Entitlement: ['kind', 'provenance', 'state', 'startsAtEpochSeconds', 'endsAtEpochSeconds'],
  Context: ['policyVersion', 'suite', 'channel', 'platform', 'asOfEpochSeconds', 'entitlement'],
  Request: ['featureId', 'usage'],
  Decision: ['policyVersion', 'policyRevision', 'featureId', 'allowed', 'reason', 'effectiveTier', 'accessBasis', 'limit'],
  FixtureCase: ['id', 'context', 'request', 'expected'],
  FixtureDocument: ['policyVersion', 'marker', 'catalog', 'cases'],
  FeatureQuota: ['free', 'premium'], RequestUsage: ['used', 'requested'],
};
const nestedModels = [];
const integerExpectations = {
  'FeatureQuota.free': [0, 9007199254740991],
  'FeatureQuota.premium': [0, 9007199254740991],
  'RequestUsage.used': [0, 9007199254740991],
  'Decision.limit': [0, 9007199254740991],
  'RequestUsage.requested': [1, 9007199254740991],
  'Entitlement.startsAtEpochSeconds': [0, 253402300799],
  'Entitlement.endsAtEpochSeconds': [0, 253402300799],
  'Context.asOfEpochSeconds': [0, 253402300799],
};
const versionPaths = ['Catalog.policyVersion', 'Context.policyVersion', 'Decision.policyVersion', 'FixtureDocument.policyVersion'];
const seenVersionPaths = new Set();
const integers = [];
const identifiers = [];
function typeFor(node, path) {
  const allowed = new Set(['$ref', 'type', 'additionalProperties', 'required', 'properties', 'items', 'uniqueItems', 'enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'anyOf']);
  for (const key of Object.keys(node)) assert(allowed.has(key), `${path}: construct ${key}`);
  if (node.$ref) {
    assert(Object.keys(node).length === 1, `${path}: decorated reference`);
    const name = modelNames[node.$ref.replace('#/$defs/', '')];
    assert(name, `${path}: reference`); return name;
  }
  if (node.anyOf) {
    assert(Object.keys(node).length === 1 && node.anyOf.length === 2, `${path}: anyOf`);
    if (node.anyOf[1].type === 'null' && Object.keys(node.anyOf[1]).length === 1)
      return `${typeFor(node.anyOf[0], path)}?`;
    assert(path === 'Decision.featureId' && node.anyOf[1].type === 'string' && node.anyOf[1].const === ''
      && Object.keys(node.anyOf[1]).length === 2, `${path}: string alternative`);
    assert(typeFor(node.anyOf[0], path) === 'String', `${path}: identifier alternative`); return 'String';
  }
  if (node.enum) {
    const name = enumUse[path];
    assert(name && node.type === 'string' && Object.keys(node).length === 2, `${path}: enum mapping`);
    assert(JSON.stringify(node.enum) === JSON.stringify(enumDefinitions[name].enum), `${path}: inconsistent shared enum`);
    return name;
  }
  if (node.type === 'object') {
    const name = path === 'Feature.quota' ? 'FeatureQuota' : path === 'Request.usage' ? 'RequestUsage' : null;
    assert(name, `${path}: nested object`); nestedModels.push([name, node]); return name;
  }
  if (node.type === 'array') {
    assert(Object.keys(node).every(key => ['type', 'items', 'uniqueItems'].includes(key)), `${path}: array construct`);
    if ('uniqueItems' in node) assert(node.uniqueItems === true, `${path}: uniqueness`);
    return `[${typeFor(node.items, `${path}[]`)}]`;
  }
  if (node.type === 'boolean') { assert(Object.keys(node).length === 1, `${path}: boolean constraint`); return 'Bool'; }
  if (node.type === 'integer') {
    if ('const' in node) {
      assert(versionPaths.includes(path) && node.const === 1 && Object.keys(node).length === 2, `${path}: version`);
      seenVersionPaths.add(path);
    }
    else {
      const expected = integerExpectations[path];
      assert(expected && Object.keys(node).length === 3 && node.minimum === expected[0]
        && node.maximum === expected[1], `${path}: integer bounds`);
      integers.push({ path, minimum: node.minimum, maximum: node.maximum });
    }
    return 'Int64';
  }
  if (node.type === 'string') {
    if ('const' in node) assert(path === 'FixtureDocument.marker' && node.const === 'SYNTHETIC' && Object.keys(node).length === 2, `${path}: string constant`);
    else {
      assert(Object.keys(node).length === 4 && node.minLength === 1 && node.maxLength === 128
        && node.pattern === '^[a-z][A-Za-z0-9._-]*$', `${path}: identifier constraints`);
      identifiers.push(node);
    }
    return 'String';
  }
  fail(`${path}: type`);
}
function fieldsFor(name, node) {
  assert(node.type === 'object' && node.additionalProperties === false
    && Object.keys(node).length === 4, `${name}: exact object`);
  assert(JSON.stringify(Object.keys(node.properties)) === JSON.stringify(expectedFields[name])
    && JSON.stringify(node.required) === JSON.stringify(expectedFields[name]), `${name}: required keys`);
  return Object.entries(node.properties).map(([field, value]) => [field, typeFor(value, `${name}.${field}`)]);
}
const models = Object.entries(modelNames).map(([definition, name]) => [name, fieldsFor(name, defs[definition])]);
for (const [name, node] of nestedModels) models.push([name, fieldsFor(name, node)]);
assert(seenVersionPaths.size === versionPaths.length, 'missing version paths');
assert(integers.length === Object.keys(integerExpectations).length
  && new Set(integers.map(item => item.path)).size === integers.length, 'missing/duplicate integer paths');
const quantity = integers.find(item => item.path === 'RequestUsage.used');
const epoch = integers.find(item => item.path === 'Context.asOfEpochSeconds');
assert(quantity?.maximum === 9007199254740991 && epoch?.maximum === 253402300799, 'v1 numeric bounds');
assert(integers.every(item => [quantity.maximum, epoch.maximum].includes(item.maximum)), 'unexpected numeric bound');
assert(identifiers.length > 0 && identifiers.every(node => JSON.stringify(node) === JSON.stringify(identifiers[0])), 'shared identifier constraints');
const lines = [
  '// Generated by generate-swift.mjs; do not edit.',
  `// Source schema SHA-256: ${createHash('sha256').update(schemaBytes).digest('hex')}`,
  '// Models and structural constants are schema-derived; access semantics are authored separately.',
  'import Foundation', '', 'public enum LakshlyFeaturePolicyV1 {',
  '  public static let policyVersion: Int64 = 1',
  `  public static let minimumQuantity: Int64 = ${quantity.minimum}`,
  `  public static let maximumQuantity: Int64 = ${quantity.maximum}`,
  `  public static let minimumEpochSeconds: Int64 = ${epoch.minimum}`,
  `  public static let maximumEpochSeconds: Int64 = ${epoch.maximum}`,
  `  public static let minimumRequested: Int64 = ${integers.find(item => item.path === 'RequestUsage.requested').minimum}`,
  `  public static let identifierMinimumLength = ${identifiers[0].minLength}`,
  `  public static let identifierMaximumLength = ${identifiers[0].maxLength}`,
  `  public static let identifierPattern = ${quote(identifiers[0].pattern)}`,
  '',
];
for (const [name, node] of Object.entries(enumDefinitions)) {
  assert(node.enum.length > 0 && new Set(node.enum).size === node.enum.length, `${name}: empty/duplicate enum values`);
  lines.push(`  public enum ${name}: String, Codable, Equatable, CaseIterable {`);
  for (const value of node.enum) {
    assert(/^[A-Za-z][A-Za-z0-9_]*$/.test(value), `${name}: unsupported enum spelling`);
    lines.push(`    case ${swiftCase(value)} = ${quote(value)}`);
  }
  lines.push('  }', `  public static let ${name[0].toLowerCase() + name.slice(1)}Values = ${JSON.stringify(node.enum)}`, '');
}
lines.push('  private struct JSONKey: CodingKey {',
  '    let stringValue: String', '    var intValue: Int? { nil }',
  '    init?(stringValue: String) { self.stringValue = stringValue }',
  '    init?(intValue: Int) { return nil }', '  }', '');
for (const [name, fields] of models) {
  const keyName = name[0].toLowerCase() + name.slice(1);
  const keys = fields.map(([field]) => field);
  lines.push(`  public static let ${keyName}RequiredKeys = ${JSON.stringify(keys)}`,
    `  public static let ${keyName}AllowedKeys = ${keyName}RequiredKeys`,
    `  public struct ${name}: Codable, Equatable {`);
  for (const [field, type] of fields) lines.push(`    public let ${field}: ${type}`);
  lines.push(`    public init(${fields.map(([field, type]) => `${field}: ${type}`).join(', ')}) {`);
  for (const [field] of fields) lines.push(`      self.${field} = ${field}`);
  lines.push('    }', '    private enum CodingKeys: String, CodingKey {');
  for (const [field] of fields) lines.push(`      case ${field}`);
  lines.push('    }', '    public init(from decoder: Decoder) throws {',
    '      let raw = try decoder.container(keyedBy: JSONKey.self)',
    `      let expected = Set(LakshlyFeaturePolicyV1.${keyName}RequiredKeys)`,
    '      guard Set(raw.allKeys.map(\\.stringValue)) == expected else {',
    `        throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: ${quote(`${name} requires exact schema keys`)}))`,
    '      }', '      let values = try decoder.container(keyedBy: CodingKeys.self)');
  for (const [field, type] of fields) lines.push(`      self.${field} = try values.${type.endsWith('?') ? 'decodeIfPresent' : 'decode'}(${type.replace(/\?$/, '')}.self, forKey: .${field})`);
  lines.push('    }', '    public func encode(to encoder: Encoder) throws {', '      var values = encoder.container(keyedBy: CodingKeys.self)');
  for (const [field, type] of fields) {
    if (type.endsWith('?')) lines.push(`      if let value = ${field} { try values.encode(value, forKey: .${field}) } else { try values.encodeNil(forKey: .${field}) }`);
    else lines.push(`      try values.encode(${field}, forKey: .${field})`);
  }
  lines.push('    }', '  }', '');
}
lines.push('}', '');
const output = lines.join('\n');
const destination = new URL('generated/FeaturePolicyContract.swift', directory);
assert(process.argv.slice(2).every(arg => arg === '--check') && process.argv.slice(2).length <= 1, 'generator arguments');
if (process.argv.includes('--check')) {
  let actual;
  try { actual = readFileSync(destination, 'utf8'); } catch { throw new Error('Generated Swift contract is missing; run generator.'); }
  if (actual !== output) { console.error('Generated Swift contract drift detected.'); process.exitCode = 1; }
  else console.log('Generation check: PASS (schema-derived Swift bytes match).');
} else {
  writeFileSync(destination, output, 'utf8');
  console.log(`Generation: PASS (${models.length} models, ${Object.keys(enumDefinitions).length} enums).`);
}
