import { describe, expect, it, vi } from 'vitest';
import Ajv2020 from '../../parsers/node_modules/ajv/dist/2020.js';
import addFormats from '../../parsers/node_modules/ajv-formats/dist/index.js';
import schema from '../feature-policy/feature-policy.schema.json';
import fixtures from '../feature-policy/fixtures.synthetic.json';
import {
  evaluateFeaturePolicy, validateCatalog, validateContext, validateRequest,
  type FeatureCatalog, type PolicyContext, type FeatureRequest, type PolicyDecision,
} from '../feature-policy';

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateFixture = ajv.compile(schema);
const definition = (name: string) => ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` });
const schemas = Object.fromEntries(Object.keys(schema.$defs).map(name => [name, definition(name)]));
const catalog = (): FeatureCatalog => structuredClone(fixtures.catalog) as FeatureCatalog;
const context = (): PolicyContext => structuredClone(fixtures.cases[0].context) as PolicyContext;
const request = (): FeatureRequest => structuredClone(fixtures.cases[0].request);
const decision = (): PolicyDecision => structuredClone(fixtures.cases[0].expected) as PolicyDecision;
const originalFixtures = JSON.stringify(fixtures);

function malformedCatalog(change: (value: FeatureCatalog) => void) {
  const value = catalog(); change(value); return value;
}
function malformedContext(change: (value: PolicyContext) => void) {
  const value = context(); change(value); return value;
}

describe('feature policy strict schema and synthetic truth table', () => {
  it('compiles every Draft 2020-12 definition in strict mode and validates the fixture root', () => {
    expect(Object.keys(schemas)).toHaveLength(9);
    expect(validateFixture(fixtures), JSON.stringify(validateFixture.errors)).toBe(true);
    expect(validateCatalog(fixtures.catalog)).toEqual([]);
    expect(new Set(fixtures.cases.map(item => item.id)).size).toBe(fixtures.cases.length);
    expect(fixtures.marker).toBe('SYNTHETIC');
    for (const feature of fixtures.catalog.features) expect(feature.id).toMatch(/^synthetic\./);
    expect(fixtures.catalog.features.filter(feature => feature.audience === 'private')).toHaveLength(1);
  });

  for (const item of fixtures.cases) it(`literal decision: ${item.id}`, () => {
    expect(schemas.decision(item.expected), JSON.stringify(schemas.decision.errors)).toBe(true);
    expect(evaluateFeaturePolicy(fixtures.catalog, item.context, item.request)).toEqual(item.expected);
  });

  it('covers each platform for all five suite/access combinations', () => {
    for (const combination of ['stableFree', 'betaFree', 'betaSimulatedPremium', 'stableVerifiedPremium', 'privateSuperUser'])
      for (const platform of ['web', 'macos', 'iphone'])
        expect(fixtures.cases.some(item => item.id === `${combination}.${platform}`)).toBe(true);
  });

  it('preserves all inputs and literal expected outputs through repeated evaluation', () => {
    const snapshot = structuredClone(fixtures);
    for (let pass = 0; pass < 3; pass++) for (const item of fixtures.cases)
      expect(evaluateFeaturePolicy(fixtures.catalog, item.context, item.request)).toEqual(item.expected);
    expect(fixtures).toEqual(snapshot);
    expect(JSON.stringify(fixtures)).toBe(originalFixtures);
  });

  it('uses explicit time rather than the ambient clock', () => {
    const item = fixtures.cases.find(item => item.id === 'paidBeforeExpiry')!;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('ambient clock used'); });
    try {
      expect(evaluateFeaturePolicy(fixtures.catalog, item.context, item.request)).toEqual(item.expected);
      expect(evaluateFeaturePolicy(fixtures.catalog, item.context, item.request)).toEqual(item.expected);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});

describe('structural rejection with no schema bypass', () => {
  const invalidInputs: [string, string, () => unknown][] = [
    ['catalog extra property', 'catalog', () => ({ ...catalog(), unexpected: true })],
    ['catalog version', 'catalog', () => ({ ...catalog(), policyVersion: 2 })],
    ['catalog missing revision', 'catalog', () => { const { policyRevision: _, ...rest } = catalog(); return rest; }],
    ['catalog invalid ID', 'catalog', () => malformedCatalog(value => { value.features[0].id = 'bad id'; })],
    ['catalog long ID', 'catalog', () => malformedCatalog(value => { value.features[0].id = 'a'.repeat(129); })],
    ['catalog empty revision', 'catalog', () => ({ ...catalog(), policyRevision: '' })],
    ['feature bad audience', 'catalog', () => malformedCatalog(value => { Object.assign(value.features[0], { audience: 'other' }); })],
    ['feature missing quota', 'catalog', () => malformedCatalog(value => { Reflect.deleteProperty(value.features[0], 'quota'); })],
    ['feature extra property', 'catalog', () => malformedCatalog(value => { Object.assign(value.features[0], { claim: true }); })],
    ['feature nonboolean', 'catalog', () => malformedCatalog(value => { Object.assign(value.features[0], { enabled: 1 }); })],
    ['quota missing tier', 'catalog', () => malformedCatalog(value => { Object.assign(value.features[7], { quota: { free: 2 } }); })],
    ['quota extra property', 'catalog', () => malformedCatalog(value => { Object.assign(value.features[7], { quota: { free: 2, premium: null, period: 1 } }); })],
    ['quota fraction', 'catalog', () => malformedCatalog(value => { value.features[7].quota!.free = 1.5; })],
    ['quota negative', 'catalog', () => malformedCatalog(value => { value.features[7].quota!.free = -1; })],
    ['quota nonfinite', 'catalog', () => malformedCatalog(value => { value.features[7].quota!.free = Infinity; })],
    ['catalog sparse features', 'catalog', () => ({ ...catalog(), features: Array(1) })],
    ['catalog sparse platforms', 'catalog', () => malformedCatalog(value => { value.features[0].supportedPlatforms = Array(1); })],
    ['catalog sparse availability', 'catalog', () => malformedCatalog(value => { value.features[0].availableIn = Array(1); })],
    ['quota unsafe', 'catalog', () => malformedCatalog(value => { value.features[7].quota!.free = Number.MAX_SAFE_INTEGER + 1; })],
    ['context extra property', 'context', () => ({ ...context(), extra: true })],
    ['context version', 'context', () => ({ ...context(), policyVersion: 2 })],
    ['context bad platform', 'context', () => ({ ...context(), platform: 'ios' })],
    ['context missing entitlement', 'context', () => { const { entitlement: _, ...rest } = context(); return rest; }],
    ['context negative time', 'context', () => ({ ...context(), asOfEpochSeconds: -1 })],
    ['context fractional time', 'context', () => ({ ...context(), asOfEpochSeconds: 200.5 })],
    ['context future time bound', 'context', () => ({ ...context(), asOfEpochSeconds: 253402300800 })],
    ['entitlement extra property', 'context', () => malformedContext(value => { Object.assign(value.entitlement, { token: 'synthetic' }); })],
    ['entitlement bad provenance', 'context', () => malformedContext(value => { Object.assign(value.entitlement, { provenance: 'clientToggle' }); })],
    ['entitlement fractional bound', 'context', () => malformedContext(value => { value.entitlement.endsAtEpochSeconds = 200.5; })],
    ['entitlement out-of-range bound', 'context', () => malformedContext(value => { value.entitlement.endsAtEpochSeconds = 253402300800; })],
    ['entitlement missing start', 'context', () => malformedContext(value => { Reflect.deleteProperty(value.entitlement, 'startsAtEpochSeconds'); })],
    ['request extra property', 'request', () => ({ ...request(), extra: true })],
    ['request missing usage', 'request', () => ({ featureId: request().featureId })],
    ['request invalid ID', 'request', () => ({ ...request(), featureId: '../feature' })],
    ['request nonfinite quantity', 'request', () => ({ ...request(), usage: { used: NaN, requested: 1 } })],
    ['request zero quantity', 'request', () => ({ ...request(), usage: { used: 0, requested: 0 } })],
    ['request fractional used', 'request', () => ({ ...request(), usage: { used: 0.5, requested: 1 } })],
    ['request negative used', 'request', () => ({ ...request(), usage: { used: -1, requested: 1 } })],
    ['request unsafe quantity', 'request', () => ({ ...request(), usage: { used: 0, requested: Number.MAX_SAFE_INTEGER + 1 } })],
    ['usage extra property', 'request', () => ({ ...request(), usage: { used: 0, requested: 1, reset: true } })],
  ];
  const validators = { catalog: validateCatalog, context: validateContext, request: validateRequest };
  for (const [label, category, make] of invalidInputs) it(label, () => {
    const input = make();
    expect(schemas[category](input)).toBe(false);
    expect(validators[category as keyof typeof validators](input).length).toBeGreaterThan(0);
    const result = evaluateFeaturePolicy(category === 'catalog' ? input : catalog(), category === 'context' ? input : context(), category === 'request' ? input : request());
    expect(result.reason).toBe(`invalid_${category}`);
    expect(result.allowed).toBe(false);
    expect(result.effectiveTier).toBeNull();
    expect(result.accessBasis).toBeNull();
    expect(result.limit).toBeNull();
  });

  for (const [label, change] of [
    ['additional decision field', (value: PolicyDecision) => Object.assign(value, { extra: true })],
    ['missing decision field', (value: PolicyDecision) => Reflect.deleteProperty(value, 'allowed')],
    ['bad reason', (value: PolicyDecision) => Object.assign(value, { reason: 'approve' })],
    ['wrong decision version', (value: PolicyDecision) => Object.assign(value, { policyVersion: 2 })],
    ['unsafe decision limit', (value: PolicyDecision) => Object.assign(value, { limit: Number.MAX_SAFE_INTEGER + 1 })],
    ['bad decision feature ID', (value: PolicyDecision) => Object.assign(value, { featureId: 'bad id' })],
  ] as const) it(`schema rejects ${label}`, () => {
    const value = decision(); change(value); expect(schemas.decision(value)).toBe(false);
  });

  it('rejects primitive and null inputs and malformed diagnostics never echo input data', () => {
    for (const input of [null, undefined, [], false, 1, 'synthetic.claim']) {
      expect(validateCatalog(input).length).toBeGreaterThan(0);
      expect(validateContext(input).length).toBeGreaterThan(0);
      expect(validateRequest(input).length).toBeGreaterThan(0);
    }
    const result = evaluateFeaturePolicy(null, null, { featureId: 'invalid claim text', usage: {} });
    expect(result).toEqual({ policyVersion: 1, policyRevision: null, featureId: '', allowed: false, reason: 'invalid_catalog', effectiveTier: null, accessBasis: null, limit: null });
    expect(validateRequest({ claimValue: 'synthetic.untrusted' })).toEqual([
      { path: '/featureId', code: 'required' }, { path: '/usage', code: 'required' },
      { path: '', code: 'additional_property' }, { path: '/featureId', code: 'identifier' },
      { path: '/usage', code: 'object_required' },
    ]);
  });
});

describe('semantic validation and decision precedence', () => {
  const catalogMutations: [string, (value: FeatureCatalog) => void][] = [
    ['duplicate feature ID', value => { value.features[1].id = value.features[0].id; }],
    ['duplicate platform', value => { value.features[0].supportedPlatforms.push('web'); }],
    ['duplicate availability triple', value => { value.features[0].availableIn.push({ ...value.features[0].availableIn[0] }); }],
    ['unavailable platform reference', value => { value.features[0].supportedPlatforms = ['web']; }],
    ['public experimental combination', value => { value.features[0].availableIn[0].channel = 'experimental'; }],
    ['private stable combination', value => { value.features[0].availableIn[6].channel = 'stable'; }],
    ['private definition public record', value => { value.features[2].availableIn.push({ suite: 'public', channel: 'beta', platform: 'web' }); }],
  ];
  for (const [label, change] of catalogMutations) it(`runtime rejects ${label}`, () => {
    const value = malformedCatalog(change);
    expect(validateCatalog(value).length).toBeGreaterThan(0);
    expect(evaluateFeaturePolicy(value, context(), request()).reason).toBe('invalid_catalog');
  });

  const contextMutations: [string, (value: PolicyContext) => void][] = [
    ['public experimental', value => { value.channel = 'experimental'; }],
    ['private beta', value => { value.suite = 'private'; value.channel = 'beta'; }],
    ['none with bounds', value => { value.entitlement.startsAtEpochSeconds = 100; }],
    ['none with active state', value => { value.entitlement.state = 'active'; }],
    ['premium missing start', value => { value.entitlement = { kind: 'premium', provenance: 'verifiedEntitlement', state: 'active', startsAtEpochSeconds: null, endsAtEpochSeconds: null }; }],
    ['premium no state', value => { value.entitlement = { kind: 'premium', provenance: 'verifiedEntitlement', state: 'none', startsAtEpochSeconds: 100, endsAtEpochSeconds: null }; }],
    ['zero-duration interval', value => { value.entitlement = { kind: 'premium', provenance: 'verifiedEntitlement', state: 'active', startsAtEpochSeconds: 200, endsAtEpochSeconds: 200 }; }],
    ['reversed interval', value => { value.entitlement = { kind: 'premium', provenance: 'verifiedEntitlement', state: 'active', startsAtEpochSeconds: 200, endsAtEpochSeconds: 199 }; }],
    ['private refunded authority', value => { value.suite = 'private'; value.channel = 'experimental'; value.entitlement = { kind: 'superUser', provenance: 'verifiedPrivateAuthorization', state: 'refunded', startsAtEpochSeconds: 100, endsAtEpochSeconds: null }; }],
  ];
  for (const [label, change] of contextMutations) it(`runtime rejects ${label}`, () => {
    const value = malformedContext(change);
    expect(schemas.context(value)).toBe(true); // Structural validity is deliberately distinct from authority semantics.
    expect(validateContext(value).length).toBeGreaterThan(0);
    expect(evaluateFeaturePolicy(catalog(), value, request()).reason).toBe('invalid_context');
  });

  it('validates catalog then context then request, preserving only validated ID/revision', () => {
    expect(evaluateFeaturePolicy(null, null, null).reason).toBe('invalid_catalog');
    expect(evaluateFeaturePolicy(catalog(), null, null)).toMatchObject({ reason: 'invalid_context', policyRevision: 'synthetic.v1', featureId: '' });
    expect(evaluateFeaturePolicy(catalog(), context(), null)).toMatchObject({ reason: 'invalid_request', policyRevision: 'synthetic.v1', featureId: '' });
    expect(evaluateFeaturePolicy(catalog(), context(), { featureId: 'synthetic.sharedFree', usage: null })).toMatchObject({ reason: 'invalid_request', featureId: 'synthetic.sharedFree' });
  });

  it('keeps availability checks before resolved tier, including SuperUser', () => {
    const value = catalog(); const feature = value.features[0];
    const req = request();
    feature.audience = 'private'; feature.implemented = false; feature.enabled = false;
    feature.supportedPlatforms = []; feature.availableIn = [];
    expect(evaluateFeaturePolicy(value, context(), req).reason).toBe('private_feature');
    feature.audience = 'public';
    expect(evaluateFeaturePolicy(value, context(), req).reason).toBe('not_implemented');
    feature.implemented = true;
    expect(evaluateFeaturePolicy(value, context(), req).reason).toBe('disabled');
    feature.enabled = true;
    expect(evaluateFeaturePolicy(value, context(), req).reason).toBe('unsupported_platform');
    feature.supportedPlatforms = ['web'];
    expect(evaluateFeaturePolicy(value, context(), req)).toMatchObject({ reason: 'channel_unavailable', effectiveTier: null, accessBasis: null });
  });

  it('preserves tier/basis after resolving access and treats null limit as no grant on denial', () => {
    expect(evaluateFeaturePolicy(catalog(), context(), { featureId: 'synthetic.sharedPremium', usage: { used: 0, requested: 1 } })).toMatchObject({ allowed: false, reason: 'tier_required', effectiveTier: 'free', accessBasis: 'free', limit: null });
    const premium = structuredClone(fixtures.cases.find(item => item.id === 'finitePremiumOver')!);
    expect(evaluateFeaturePolicy(catalog(), premium.context, premium.request)).toEqual(premium.expected);
  });

  it('handles the exact maximum safe finite quota without addition overflow', () => {
    const value = catalog(); value.features[0].quota = { free: Number.MAX_SAFE_INTEGER, premium: 0 };
    expect(validateCatalog(value)).toEqual([]); // No assumed Premium >= Free ordering.
    for (const [used, requested, allowed] of [
      [Number.MAX_SAFE_INTEGER - 1, 1, true],
      [0, Number.MAX_SAFE_INTEGER, true],
      [1, Number.MAX_SAFE_INTEGER, false],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, false],
    ] as const) {
      expect(evaluateFeaturePolicy(value, context(), { featureId: 'synthetic.sharedFree', usage: { used, requested } })).toMatchObject({ allowed, reason: allowed ? 'allowed' : 'quota_exhausted', limit: Number.MAX_SAFE_INTEGER });
    }
  });
});
