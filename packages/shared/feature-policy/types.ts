/** Unwired policy v1. Provenance must already be verified by the caller's trust boundary. */
export type PolicyPlatform = 'web' | 'macos' | 'iphone';
export type PolicySuite = 'public' | 'private';
export type PolicyChannel = 'beta' | 'stable' | 'experimental';
export type PolicyTier = 'free' | 'premium' | 'superUser';
export interface FeatureAvailability {
  suite: PolicySuite;
  channel: PolicyChannel;
  platform: PolicyPlatform;
}
export interface FeatureDefinition {
  id: string;
  audience: PolicySuite;
  implemented: boolean;
  enabled: boolean;
  supportedPlatforms: PolicyPlatform[];
  availableIn: FeatureAvailability[];
  minimumPublicTier: 'free' | 'premium';
  quota: null | { free: number | null; premium: number | null };
}
export interface FeatureCatalog {
  policyVersion: 1;
  policyRevision: string;
  features: FeatureDefinition[];
}
export interface PolicyEntitlement {
  kind: 'none' | 'premium' | 'superUser';
  provenance: 'none' | 'verifiedEntitlement' | 'betaSimulation' | 'verifiedPrivateAuthorization';
  state: 'none' | 'active' | 'revoked' | 'refunded';
  startsAtEpochSeconds: number | null;
  endsAtEpochSeconds: number | null;
}
export interface PolicyContext {
  policyVersion: 1;
  suite: PolicySuite;
  channel: PolicyChannel;
  platform: PolicyPlatform;
  asOfEpochSeconds: number;
  entitlement: PolicyEntitlement;
}
export interface FeatureRequest {
  featureId: string;
  usage: { used: number; requested: number };
}
export type PolicyReason = 'invalid_catalog' | 'invalid_context' | 'invalid_request'
  | 'unknown_feature' | 'private_feature' | 'not_implemented' | 'disabled'
  | 'unsupported_platform' | 'channel_unavailable' | 'private_authorization_required'
  | 'tier_required' | 'quota_exhausted' | 'allowed';
export type AccessBasis = 'free' | 'verifiedPremium' | 'simulatedPremium' | 'privateSuperUser';
export interface PolicyDecision {
  policyVersion: 1;
  policyRevision: string | null;
  featureId: string;
  allowed: boolean;
  reason: PolicyReason;
  effectiveTier: PolicyTier | null;
  accessBasis: AccessBasis | null;
  limit: number | null;
}
export interface ValidationIssue { path: string; code: string }
export interface PolicyFixtureCase {
  id: string;
  context: PolicyContext;
  request: FeatureRequest;
  expected: PolicyDecision;
}
export interface PolicyFixtureDocument {
  policyVersion: 1;
  marker: 'SYNTHETIC';
  catalog: FeatureCatalog;
  cases: PolicyFixtureCase[];
}
