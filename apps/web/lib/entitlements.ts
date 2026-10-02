export type Plan = "free" | "premium";
export type Feature = "priorityFeedback";

/** Mirrors Apple EntitlementsMap. Unmapped features require Premium. */
export const ENTITLEMENTS_MAP: Readonly<Record<Feature, Plan>> = {
  priorityFeedback: "premium",
};

export function can(feature: string, plan: Plan): boolean {
  const required = Object.hasOwn(ENTITLEMENTS_MAP, feature)
    ? ENTITLEMENTS_MAP[feature as Feature]
    : "premium";
  return required === "free" || plan === "premium";
}
