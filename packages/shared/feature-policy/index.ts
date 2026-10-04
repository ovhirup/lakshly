import type {
  AccessBasis, FeatureCatalog, FeatureRequest, PolicyContext, PolicyDecision,
  PolicyReason, PolicyTier, ValidationIssue,
} from './types';
export type * from './types';

const platforms = ['web', 'macos', 'iphone'];
const suites = ['public', 'private'];
const channels = ['beta', 'stable', 'experimental'];
const maxEpochSeconds = 253402300799;
const identifierPattern = /^[a-z][A-Za-z0-9._-]*$/;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && identifierPattern.test(value);
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const combination = (suite: unknown, channel: unknown): boolean =>
  (suite === 'public' && (channel === 'beta' || channel === 'stable')) ||
  (suite === 'private' && channel === 'experimental');

/** Issues identify paths and categories only; never echo untrusted values. */
function guards(issues: ValidationIssue[]) {
  const issue = (path: string, code: string) => { issues.push({ path, code }); };
  const shape = (value: unknown, keys: string[], path: string): value is RecordValue => {
    if (!record(value)) { issue(path, 'object_required'); return false; }
    for (const key of keys) if (!Object.hasOwn(value, key)) issue(`${path}/${key}`, 'required');
    for (const key of Object.keys(value)) if (!keys.includes(key)) issue(path, 'additional_property');
    return true;
  };
  const check = (condition: boolean, path: string, code: string) => {
    if (!condition) issue(path, code);
  };
  const member = (value: unknown, choices: string[], path: string) =>
    check(typeof value === 'string' && choices.includes(value), path, 'enum');
  return { issue, shape, check, member };
}

export function validateCatalog(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { shape, check, member, issue } = guards(issues);
  if (!shape(value, ['policyVersion', 'policyRevision', 'features'], '')) return issues;
  check(value.policyVersion === 1, '/policyVersion', 'version');
  check(identifier(value.policyRevision), '/policyRevision', 'identifier');
  if (!Array.isArray(value.features)) { issue('/features', 'array_required'); return issues; }
  const ids = new Set<string>();
  Array.from(value.features).forEach((feature: unknown, i: number) => {
    const path = `/features/${i}`;
    if (!shape(feature, ['id', 'audience', 'implemented', 'enabled', 'supportedPlatforms', 'availableIn', 'minimumPublicTier', 'quota'], path)) return;
    check(identifier(feature.id), `${path}/id`, 'identifier');
    if (typeof feature.id === 'string') {
      check(!ids.has(feature.id), `${path}/id`, 'duplicate_feature');
      ids.add(feature.id);
    }
    member(feature.audience, suites, `${path}/audience`);
    check(typeof feature.implemented === 'boolean', `${path}/implemented`, 'boolean');
    check(typeof feature.enabled === 'boolean', `${path}/enabled`, 'boolean');
    member(feature.minimumPublicTier, ['free', 'premium'], `${path}/minimumPublicTier`);
    const supported = feature.supportedPlatforms;
    if (!Array.isArray(supported)) issue(`${path}/supportedPlatforms`, 'array_required');
    else {
      const seen = new Set<unknown>();
      Array.from(supported).forEach((platform: unknown, j: number) => {
        member(platform, platforms, `${path}/supportedPlatforms/${j}`);
        check(!seen.has(platform), `${path}/supportedPlatforms/${j}`, 'duplicate_platform');
        seen.add(platform);
      });
    }
    if (!Array.isArray(feature.availableIn)) issue(`${path}/availableIn`, 'array_required');
    else {
      const triples = new Set<string>();
      Array.from(feature.availableIn).forEach((availability: unknown, j: number) => {
        const ap = `${path}/availableIn/${j}`;
        if (!shape(availability, ['suite', 'channel', 'platform'], ap)) return;
        member(availability.suite, suites, `${ap}/suite`);
        member(availability.channel, channels, `${ap}/channel`);
        member(availability.platform, platforms, `${ap}/platform`);
        check(combination(availability.suite, availability.channel), ap, 'suite_channel');
        check(feature.audience !== 'private' || availability.suite !== 'public', ap, 'private_audience');
        check(Array.isArray(supported) && supported.includes(availability.platform), `${ap}/platform`, 'unsupported_reference');
        // Valid enum strings contain no delimiter; malformed values still receive structural issues.
        if (typeof availability.suite === 'string' && typeof availability.channel === 'string'
          && typeof availability.platform === 'string') {
          const triple = JSON.stringify([availability.suite, availability.channel, availability.platform]);
          check(!triples.has(triple), ap, 'duplicate_availability');
          triples.add(triple);
        }
      });
    }
    if (feature.quota !== null && shape(feature.quota, ['free', 'premium'], `${path}/quota`)) {
      for (const tier of ['free', 'premium'])
        check(feature.quota[tier] === null || integer(feature.quota[tier]), `${path}/quota/${tier}`, 'safe_quantity');
    }
  });
  return issues;
}

export function validateContext(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { shape, check, member } = guards(issues);
  if (!shape(value, ['policyVersion', 'suite', 'channel', 'platform', 'asOfEpochSeconds', 'entitlement'], '')) return issues;
  check(value.policyVersion === 1, '/policyVersion', 'version');
  member(value.suite, suites, '/suite');
  member(value.channel, channels, '/channel');
  member(value.platform, platforms, '/platform');
  check(combination(value.suite, value.channel), '', 'suite_channel');
  check(integer(value.asOfEpochSeconds, 0, maxEpochSeconds), '/asOfEpochSeconds', 'epoch_seconds');
  const entitlement = value.entitlement;
  if (!shape(entitlement, ['kind', 'provenance', 'state', 'startsAtEpochSeconds', 'endsAtEpochSeconds'], '/entitlement')) return issues;
  member(entitlement.kind, ['none', 'premium', 'superUser'], '/entitlement/kind');
  member(entitlement.provenance, ['none', 'verifiedEntitlement', 'betaSimulation', 'verifiedPrivateAuthorization'], '/entitlement/provenance');
  member(entitlement.state, ['none', 'active', 'revoked', 'refunded'], '/entitlement/state');
  for (const bound of ['startsAtEpochSeconds', 'endsAtEpochSeconds'])
    check(entitlement[bound] === null || integer(entitlement[bound], 0, maxEpochSeconds), `/entitlement/${bound}`, 'epoch_seconds');
  const none = entitlement.kind === 'none' && entitlement.provenance === 'none' && entitlement.state === 'none'
    && entitlement.startsAtEpochSeconds === null && entitlement.endsAtEpochSeconds === null;
  const premium = value.suite === 'public' && entitlement.kind === 'premium'
    && (entitlement.provenance === 'verifiedEntitlement' ||
      (entitlement.provenance === 'betaSimulation' && value.channel === 'beta'))
    && (entitlement.state === 'active' || entitlement.state === 'revoked' || entitlement.state === 'refunded')
    && integer(entitlement.startsAtEpochSeconds, 0, maxEpochSeconds);
  const superUser = value.suite === 'private' && entitlement.kind === 'superUser'
    && entitlement.provenance === 'verifiedPrivateAuthorization'
    && (entitlement.state === 'active' || entitlement.state === 'revoked')
    && integer(entitlement.startsAtEpochSeconds, 0, maxEpochSeconds);
  check(none || premium || superUser, '/entitlement', 'entitlement_combination');
  if (entitlement.endsAtEpochSeconds !== null)
    check(integer(entitlement.startsAtEpochSeconds, 0, maxEpochSeconds)
      && integer(entitlement.endsAtEpochSeconds, 0, maxEpochSeconds)
      && entitlement.endsAtEpochSeconds > entitlement.startsAtEpochSeconds,
    '/entitlement', 'interval_order');
  return issues;
}

export function validateRequest(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { shape, check } = guards(issues);
  if (!shape(value, ['featureId', 'usage'], '')) return issues;
  check(identifier(value.featureId), '/featureId', 'identifier');
  if (shape(value.usage, ['used', 'requested'], '/usage')) {
    check(integer(value.usage.used), '/usage/used', 'safe_quantity');
    check(integer(value.usage.requested, 1), '/usage/requested', 'positive_safe_quantity');
  }
  return issues;
}

export function evaluateFeaturePolicy(catalog: unknown, context: unknown, request: unknown): PolicyDecision {
  const featureId = record(request) && identifier(request.featureId) ? request.featureId : '';
  const decision = (reason: PolicyReason, revision: string | null,
    effectiveTier: PolicyTier | null = null, accessBasis: AccessBasis | null = null,
    limit: number | null = null): PolicyDecision => ({
    policyVersion: 1, policyRevision: revision, featureId, allowed: reason === 'allowed',
    reason, effectiveTier, accessBasis, limit,
  });
  if (validateCatalog(catalog).length) return decision('invalid_catalog', null);
  const validCatalog = catalog as FeatureCatalog;
  const revision = validCatalog.policyRevision;
  if (validateContext(context).length) return decision('invalid_context', revision);
  if (validateRequest(request).length) return decision('invalid_request', revision);
  const validContext = context as PolicyContext;
  const validRequest = request as FeatureRequest;
  const feature = validCatalog.features.find(item => item.id === featureId);
  if (!feature) return decision('unknown_feature', revision);
  if (validContext.suite === 'public' && feature.audience === 'private') return decision('private_feature', revision);
  if (!feature.implemented) return decision('not_implemented', revision);
  if (!feature.enabled) return decision('disabled', revision);
  if (!feature.supportedPlatforms.includes(validContext.platform)) return decision('unsupported_platform', revision);
  if (!feature.availableIn.some(item => item.suite === validContext.suite
    && item.channel === validContext.channel && item.platform === validContext.platform))
    return decision('channel_unavailable', revision);
  const entitlement = validContext.entitlement;
  const active = entitlement.state === 'active' && entitlement.startsAtEpochSeconds !== null
    && entitlement.startsAtEpochSeconds <= validContext.asOfEpochSeconds
    && (entitlement.endsAtEpochSeconds === null || validContext.asOfEpochSeconds < entitlement.endsAtEpochSeconds);
  let tier: PolicyTier = 'free';
  let basis: AccessBasis = 'free';
  if (validContext.suite === 'private') {
    if (!active || entitlement.kind !== 'superUser') return decision('private_authorization_required', revision);
    tier = 'superUser'; basis = 'privateSuperUser';
  } else if (active && entitlement.kind === 'premium') {
    tier = 'premium'; basis = entitlement.provenance === 'betaSimulation' ? 'simulatedPremium' : 'verifiedPremium';
  }
  if (tier === 'free' && feature.minimumPublicTier === 'premium') return decision('tier_required', revision, tier, basis);
  const limit = tier === 'superUser' || feature.quota === null ? null : feature.quota[tier];
  if (limit !== null && (validRequest.usage.requested > limit || validRequest.usage.used > limit - validRequest.usage.requested))
    return decision('quota_exhausted', revision, tier, basis, limit);
  return decision('allowed', revision, tier, basis, limit);
}
