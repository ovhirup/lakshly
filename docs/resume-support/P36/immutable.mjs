import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

const baseline = '7bf0ef74a7f5d8cbf1f87995cf2ef7c021ea4671';
const result = spawnSync('git', [
  'show', `${baseline}:docs/public-feature-catalog.proposal.json`
], {encoding:'utf8'});
if (result.status !== 0) throw new Error(result.stderr);
const before = JSON.parse(result.stdout);
const after = JSON.parse(readFileSync('docs/public-feature-catalog.proposal.json','utf8'));
const unchanged = p => ({
  metadata: {
    proposalVersion:p.proposalVersion, kind:p.kind, status:p.status,
    runtimeEvidence:p.runtimeEvidence, privateSuiteEvidence:p.privateSuiteEvidence,
    legacyCatalog:p.legacyCatalog, policyReferences:p.policyReferences
  },
  freeBillOfRights:p.freeBillOfRights,
  declarations:p.features.map(f => ({id:f.id,legacy:f.legacy,freeRight:f.freeRight})),
  nativeFeatures:p.features.map(f => ({
    id:f.id,iphone:f.platforms.iphone,macos:f.platforms.macos
  })),
  appleAliases:p.appleAliases,
  quotas:p.quotaReviews.map(q => ({
    id:q.id,legacyLimits:q.legacyLimits,proposedUnit:q.proposedUnit,
    migrationHazard:q.migrationHazard,decisionIds:q.decisionIds,
    iphone:q.platformObservations.iphone,macos:q.platformObservations.macos
  })),
  ownerDecisions:p.ownerDecisions
});
if (!isDeepStrictEqual(unchanged(before),unchanged(after)))
  throw new Error('Immutable declaration/native/decision sections changed');
if (after.sourceCommit !== '779f9130e80adce66a1825212756d5f0acc8e677')
  throw new Error('Wrong refreshed pin');
const changes = after.features.filter((f,i) =>
  f.platforms.web.sourceStatus !== before.features[i].platforms.web.sourceStatus
).map(f => [f.id,f.platforms.web.sourceStatus]);
const expected = [
  ['security.lock','sourcePartial'],
  ['data.export','sourceImplemented'],
  ['setup.freshnessReminders','sourceImplemented']
];
if (!isDeepStrictEqual(changes,expected))
  throw new Error('Unexpected Web status changes');
console.log('Immutable sections and exactly three Web status changes: PASS');
