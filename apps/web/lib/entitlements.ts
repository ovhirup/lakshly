// Tiers and feature gates for the PUBLIC web app. Data lives in packages/shared/entitlements.json.
// The UI asks can(feature) / limit(feature); it never checks premium booleans directly.
import { FEATURES, FREE_BILL_OF_RIGHTS, PRICES, TIERS, type FeatureId } from "./entitlements.gen";

export type Tier = (typeof TIERS)[number];
/** What the public app can actually be in: the demo plan toggle, until verified purchases exist. */
export type Plan = "free" | "premium";
export type { FeatureId };
export { FEATURES, FREE_BILL_OF_RIGHTS, PRICES };

const RANK: Record<Tier, number> = { free: 0, premium: 1, superUser: 2 };

/**
 * Resolution order: edition flag -> verified entitlement -> free.
 * The public repo has no edition flag, so this can only ever return "free" or "premium".
 * (Today the "verified entitlement" is the demo plan toggle; payments aren't live.)
 */
export function resolveTier(plan: unknown): Plan {
  return plan === "premium" ? "premium" : "free";
}

function spec(feature: string) {
  return Object.hasOwn(FEATURES, feature) ? FEATURES[feature as FeatureId] : undefined;
}

/** Fails closed: unknown features need Premium. */
export function can(feature: FeatureId | string, tier: Tier): boolean {
  const s = spec(feature);
  return RANK[tier] >= RANK[s ? s.minTier : "premium"];
}

/** Numeric limit for this tier, or null for unlimited. Features without limits are unlimited when allowed, 0 otherwise. */
export function limit(feature: FeatureId | string, tier: Tier): number | null {
  if (tier === "superUser") return null;
  const s = spec(feature);
  if (s?.limits && Object.hasOwn(s.limits, tier)) return s.limits[tier] ?? null;
  return can(feature, tier) ? null : 0;
}

/** Premium-only features, for perks lists and upsell copy. */
export function premiumFeatures(): FeatureId[] {
  return (Object.keys(FEATURES) as FeatureId[]).filter((id) => FEATURES[id].minTier === "premium");
}

const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const PRICE_TEXT = {
  monthly: inr0.format(PRICES.INR.monthly / 100),
  yearly: inr0.format(PRICES.INR.yearly / 100),
  yearlyPerMonth: inr0.format(Math.round(PRICES.INR.yearly / 12 / 100)),
};
