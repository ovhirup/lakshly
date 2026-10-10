import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Read-only review-inventory verification. Never imported by product consumers.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pinned = '779f9130e80adce66a1825212756d5f0acc8e677';
const catalogPath = 'packages/shared/entitlements.json';
const applePath = 'apps/apple/Lakshly/Store/Entitlements.swift';
const platforms = ['web', 'iphone', 'macos'];
const statuses = ['sourceImplemented', 'sourcePartial', 'sourceStub', 'notFoundInAudit'];
const suggestions = ['evidenceReviewCandidate', 'holdForImplementationOrScopeDecision'];
const enforcement = ['sourceOperationGuard', 'sourceUIOnly', 'noGuardFound', 'notApplicablePendingDecision'];
const decisionIds = ['widgets', 'budgets', 'history', 'extraEmails', 'mailboxes', 'merchantRules', 'releaseEvidence', 'freeRights', 'storeKitTime', 'nativeChannels'];
const mappings = {
  premiumThemes: 'themes.premium', debtPlanner: 'debt.planner', creditInsights: 'credit.insights',
  investmentInsights: 'investments.insights', rewardsInsights: 'rewards.tracking', priorityFeedback: 'priorityFeedback',
  importStatements: 'import.statements', setupWizard: 'setup.wizard', setupEmailGuide: 'setup.emailGuide',
  setupExtraEmails: 'setup.extraEmails', setupSuggestions: 'setup.suggestions', setupHealth: 'setup.health',
  mailSyncConnect: 'mailSync.connect', mailSyncIMAP: 'mailSync.imap', mailSyncStatementPasswordKeychain: 'mailSync.statementPasswordKeychain',
  mailSyncBackground: 'mailSync.background', setupFreshnessReminders: 'setup.freshnessReminders',
};
function assert(condition, message) { if (!condition) throw new Error(message); }
function object(value, keys, label) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value)
    && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()), `${label}: exact object keys required`);
}
function text(value, label) { assert(typeof value === 'string' && value.trim().length > 0, `${label}: nonempty string required`); }
function choice(value, values, label) { assert(values.includes(value), `${label}: invalid enum`); }
function array(value, label) { assert(Array.isArray(value), `${label}: array required`); }
function unique(values, label) { assert(new Set(values).size === values.length, `${label}: duplicate entries`); }
function equal(actual, expected, label) { assert(isDeepStrictEqual(actual, expected), `${label}: differs from pinned source/review contract`); }
function safePath(path) {
  text(path, 'evidence path');
  assert(!path.includes('\\') && !path.includes('\0') && !path.startsWith('/')
    && !path.split('/').some(part => part === '.' || part === '..' || part.length === 0)
    && ['apps/web/', 'apps/apple/', 'packages/shared/'].some(prefix => path.startsWith(prefix)), 'Unsafe evidence path');
}
const sourceCache = new Map();
function source(path) {
  safePath(path);
  if (!sourceCache.has(path)) {
    const result = spawnSync('git', ['show', `${pinned}:${path}`], { cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 8 * 1024 * 1024 });
    assert(!result.error && result.status === 0, `Pinned source retrieval failed: ${path}: ${result.stderr ?? result.error?.message ?? ''}`);
    sourceCache.set(path, result.stdout);
  }
  return sourceCache.get(path);
}
function evidence(value, label, requireApplication = false) {
  array(value, label); assert(value.length > 0, `${label}: evidence required`);
  unique(value.map(item => JSON.stringify([item?.path, item?.line, item?.needle])), label);
  for (const item of value) {
    object(item, ['path', 'line', 'needle'], label); safePath(item.path);
    assert(Number.isSafeInteger(item.line) && item.line > 0 && item.line <= 1_000_000, `${label}: bounded positive line required`);
    text(item.needle, `${label} needle`);
    assert(!/[\r\n\0]/.test(item.needle), `${label}: single-line needle required`);
    const line = source(item.path).split('\n')[item.line - 1];
    assert(line !== undefined && line.includes(item.needle), `${label}: incorrect pinned evidence needle at ${item.path}:${item.line}`);
  }
  if (requireApplication) assert(value.some(item => item.path.startsWith('apps/')), `${label}: application-source anchor required`);
}
let proseCitations = 0;
function citationText(value, label) {
  const pattern = /\b(apps\/(?:web|apple)\/[^\s`"'<>():]+):([0-9]+)\b/g;
  for (const match of value.matchAll(pattern)) {
    const path = match[1], lineNumber = Number(match[2]);
    const context = `${label}: explicit citation ${path}:${match[2]}`;
    safePath(path);
    assert(Number.isSafeInteger(lineNumber) && lineNumber > 0 && lineNumber <= 1_000_000, `${context}: bounded positive line required`);
    const line = source(path).split('\n')[lineNumber - 1];
    assert(line !== undefined && line.trim().length > 0, `${context}: missing or blank pinned line`);
    proseCitations++;
  }
}
function embeddedCitations(value, label) {
  if (typeof value === 'string') citationText(value, label);
  else if (Array.isArray(value)) value.forEach((item, index) => embeddedCitations(item, `${label}[${index}]`));
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) embeddedCitations(item, `${label}.${key}`);
  }
}
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === '--proposal' && args[1].length > 0), 'Use no arguments or --proposal <path>');
const proposal = JSON.parse(readFileSync(args.length ? resolve(args[1]) : join(root, 'docs/public-feature-catalog.proposal.json'), 'utf8'));
object(proposal, ['proposalVersion', 'kind', 'status', 'sourceCommit', 'runtimeEvidence', 'privateSuiteEvidence', 'legacyCatalog', 'policyReferences', 'freeBillOfRights', 'features', 'appleAliases', 'quotaReviews', 'ownerDecisions'], 'proposal');
equal(proposal.proposalVersion, 1, 'proposal version');
equal(proposal.kind, 'public-feature-review-inventory', 'proposal kind');
equal(proposal.status, 'pending-owner-approval', 'proposal status');
equal(proposal.sourceCommit, pinned, 'source commit');
equal(proposal.runtimeEvidence, 'not-reverified', 'runtime evidence');
equal(proposal.privateSuiteEvidence, 'not-inspected', 'private suite evidence');
const catalogBytes = source(catalogPath);
const legacy = JSON.parse(catalogBytes);
equal(readFileSync(join(root, catalogPath), 'utf8'), catalogBytes, 'Current legacy catalog bytes');
object(proposal.legacyCatalog, ['path', 'sha256', 'version'], 'legacy catalog');
equal(proposal.legacyCatalog, { path: catalogPath, sha256: createHash('sha256').update(catalogBytes).digest('hex'), version: legacy.version }, 'Catalog checksum/version');
array(proposal.policyReferences, 'policy references');
equal(proposal.policyReferences.map(item => item.url), ['https://github.com/ovhirup/lakshly/pull/36', 'https://github.com/ovhirup/lakshly/pull/39'], 'Policy reference proposals');
for (const item of proposal.policyReferences) { object(item, ['url', 'purpose'], 'policy reference'); text(item.purpose, 'policy reference purpose'); }
array(proposal.freeBillOfRights, 'Free rights');
equal(proposal.freeBillOfRights, legacy.freeBillOfRights, 'Unchanged Free rights');
assert(proposal.freeBillOfRights.length === 11, 'Expected eleven Free rights'); unique(proposal.freeBillOfRights, 'Free rights');
array(proposal.ownerDecisions, 'owner decisions');
equal(proposal.ownerDecisions.map(item => item.id), decisionIds, 'Owner decision IDs/order');
for (const item of proposal.ownerDecisions) {
  object(item, ['id', 'question', 'recommendation', 'status'], 'owner decision');
  text(item.question, 'decision question'); text(item.recommendation, 'decision recommendation'); equal(item.status, 'pending', 'decision status');
}
array(proposal.features, 'features');
equal(proposal.features.map(item => item.id), Object.keys(legacy.features), '43 feature IDs/order');
assert(proposal.features.length === 43, 'Expected 43 features'); unique(proposal.features.map(item => item.id), 'feature IDs');
let observations = 0, approvals = 0;
for (const item of proposal.features) {
  object(item, ['id', 'legacy', 'freeRight', 'platforms'], 'feature');
  equal(item.legacy, legacy.features[item.id], `${item.id} complete legacy object`);
  equal(item.freeRight, legacy.freeBillOfRights.includes(item.id), `${item.id} Free right membership`);
  object(item.platforms, platforms, `${item.id} platforms`);
  for (const platform of platforms) {
    observations++;
    const review = item.platforms[platform];
    object(review, ['sourceStatus', 'notes', 'evidence', 'releaseProposal'], `${item.id}/${platform} review`);
    choice(review.sourceStatus, statuses, 'source status'); text(review.notes, 'review notes');
    evidence(review.evidence, `${item.id}/${platform}`, review.sourceStatus !== 'notFoundInAudit');
    object(review.releaseProposal, ['beta', 'stable'], 'release proposal');
    for (const channel of ['beta', 'stable']) {
      const release = review.releaseProposal[channel]; approvals++;
      object(release, ['suggestion', 'rationale', 'approval'], 'release suggestion');
      choice(release.suggestion, suggestions, 'release suggestion'); text(release.rationale, 'release rationale');
      equal(release.approval, 'pending', 'Premature release approval');
      equal(release.suggestion, review.sourceStatus === 'sourceImplemented' ? 'evidenceReviewCandidate' : 'holdForImplementationOrScopeDecision', 'Source/candidate rule');
    }
  }
}
assert(observations === 129 && approvals === 258, 'Platform/channel counts mismatch');
const apple = source(applePath);
const enumBody = apple.match(/enum Feature:[^{]+\{([\s\S]*?)\n\}/)?.[1];
const standardBody = apple.match(/static let standard:[^=]+ = \[([\s\S]*?)\n  \]/)?.[1];
assert(enumBody && standardBody, 'Pinned Apple enum/standard dictionary not found');
const parsedCases = [...enumBody.matchAll(/^\s*case (\w+)(?: = "([^"]+)")?/gm)].map(match => ({ appleCase: match[1], rawValue: match[2] ?? match[1] }));
const parsedTiers = [...standardBody.matchAll(/^\s*\.([A-Za-z]+): \.(free|premium),$/gm)].map(match => [match[1], match[2]]);
assert(parsedCases.length === 19 && parsedTiers.length === 19, 'Expected nineteen pinned Apple cases/tiers');
unique(parsedCases.map(item => item.appleCase), 'Apple cases'); unique(parsedCases.map(item => item.rawValue), 'Apple raw values'); unique(parsedTiers.map(item => item[0]), 'Apple standard keys');
const tiers = Object.fromEntries(parsedTiers);
array(proposal.appleAliases, 'Apple aliases');
equal(proposal.appleAliases.map(item => item.appleCase), parsedCases.map(item => item.appleCase), '19 Apple alias order');
let mapped = 0, pending = 0;
for (let index = 0; index < proposal.appleAliases.length; index++) {
  const alias = proposal.appleAliases[index], original = parsedCases[index];
  object(alias, ['appleCase', 'rawValue', 'currentMinTier', 'canonicalId', 'proposedCanonicalId', 'mappingStatus', 'notes', 'evidence'], 'Apple alias');
  equal(alias.rawValue, original.rawValue, 'Apple raw value'); equal(alias.currentMinTier, tiers[alias.appleCase], 'Apple tier');
  text(alias.notes, 'alias notes'); evidence(alias.evidence, `alias ${alias.appleCase}`, true);
  if (Object.hasOwn(mappings, alias.appleCase)) {
    mapped++; equal(alias.canonicalId, mappings[alias.appleCase], 'Canonical Apple mapping');
    assert(Object.hasOwn(legacy.features, alias.canonicalId), 'Canonical ID must already exist');
    equal(alias.proposedCanonicalId, null, 'Mapped alias cannot propose a new ID'); equal(alias.mappingStatus, 'mapped', 'Mapped status');
  } else {
    pending++; assert(['basicWidgets', 'extraWidgets'].includes(alias.appleCase), 'Unknown unresolved Apple alias');
    equal(alias.canonicalId, null, 'Widget canonical ID must remain null, never review.widget');
    equal(alias.proposedCanonicalId, alias.appleCase === 'basicWidgets' ? 'widgets.basic' : 'widgets.extra', 'Proposed widget name');
    assert(!Object.hasOwn(legacy.features, alias.proposedCanonicalId), 'Proposed widget is not a legacy feature');
    equal(alias.mappingStatus, 'ownerDecisionRequired', 'Widget approval pending');
  }
}
assert(mapped === 17 && pending === 2, 'Apple alias counts mismatch');
array(proposal.quotaReviews, 'quota reviews');
const quotaIds = Object.entries(legacy.features).filter(([, feature]) => Object.hasOwn(feature, 'limits')).map(([id]) => id);
equal(proposal.quotaReviews.map(item => item.id), quotaIds, 'Six quota IDs/order');
assert(quotaIds.length === 6, 'Expected six quotas');
for (const item of proposal.quotaReviews) {
  object(item, ['id', 'legacyLimits', 'proposedUnit', 'platformObservations', 'migrationHazard', 'decisionIds'], 'quota review');
  equal(item.legacyLimits, legacy.features[item.id].limits, `${item.id} exact raw limits`);
  text(item.proposedUnit, 'proposed unit'); text(item.migrationHazard, 'migration hazard');
  array(item.decisionIds, 'quota decisions'); assert(item.decisionIds.length > 0, 'Quota decision references required'); unique(item.decisionIds, 'quota decisions');
  assert(item.decisionIds.every(id => decisionIds.includes(id)), 'Unknown pending decision reference');
  object(item.platformObservations, platforms, 'quota platforms');
  for (const platform of platforms) {
    const observation = item.platformObservations[platform];
    object(observation, ['observedUnit', 'enforcement', 'notes', 'evidence'], 'quota observation');
    text(observation.observedUnit, 'observed unit'); choice(observation.enforcement, enforcement, 'quota enforcement');
    text(observation.notes, 'quota notes'); evidence(observation.evidence, `quota ${item.id}/${platform}`);
  }
}
const table = (headings, rows) => [
  `| ${headings.join(' | ')} |`, `| ${headings.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
].join('\n');
const featureMatrix = table(['Feature ID', 'Legacy minimum', 'Free right', 'Web source', 'iPhone source', 'macOS source', 'Beta / Stable'],
  proposal.features.map(item => [item.id, item.legacy.minTier, item.freeRight ? 'yes' : 'no', ...platforms.map(platform => item.platforms[platform].sourceStatus), 'pending / pending on all platforms']));
const quotaMatrix = table(['Feature ID', 'Raw legacy limits', 'Web enforcement', 'iPhone enforcement', 'macOS enforcement', 'Pending decisions'],
  proposal.quotaReviews.map(item => [item.id, `\`${JSON.stringify(item.legacyLimits)}\``, ...platforms.map(platform => item.platformObservations[platform].enforcement), item.decisionIds.join(', ')]));
const aliasMatrix = table(['Apple case', 'Raw value', 'Current tier', 'Canonical ID', 'Proposed ID', 'Mapping'],
  proposal.appleAliases.map(item => [item.appleCase, item.rawValue, item.currentMinTier, item.canonicalId ?? 'none', item.proposedCanonicalId ?? 'none', item.mappingStatus]));
const markdown = readFileSync(join(root, 'docs/PUBLIC-FEATURE-CATALOG.md'), 'utf8');
for (const [name, rendered] of [['feature', featureMatrix], ['quota', quotaMatrix], ['apple-alias', aliasMatrix]]) {
  const start = `<!-- ${name}-matrix:start -->`, end = `<!-- ${name}-matrix:end -->`;
  assert(markdown.split(start).length === 2 && markdown.split(end).length === 2, `Unique ${name} matrix markers required`);
  const section = markdown.split(start)[1].split(end)[0];
  equal(section, `\n${rendered}\n`, `${name} Markdown matrix`);
}
embeddedCitations(proposal, 'proposal');
for (const document of ['PUBLIC-FEATURE-CATALOG.md', 'APPLE-POLICY-MIGRATION.md']) {
  const text = readFileSync(join(root, 'docs', document), 'utf8');
  for (const id of decisionIds) assert(text.includes(`decision-${id}`), `${document}: missing owner decision ${id}`);
  citationText(text, document);
}
assert(proseCitations > 0, 'Explicit prose application citations required');
console.log(`${proposal.features.length} features; ${observations} platform observations; ${approvals} pending channel approvals`);
console.log(`${proposal.appleAliases.length} Apple aliases: ${mapped} mapped, ${pending} pending`);
console.log(`${proposal.freeBillOfRights.length} Free rights; ${proposal.quotaReviews.length} quota reviews`);
console.log(`Explicit prose application citations: ${proseCitations} checked`);
console.log('Pinned evidence and review matrices: PASS');
