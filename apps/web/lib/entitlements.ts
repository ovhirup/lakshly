export type Plan = "free" | "premium";
export type Feature =
  | "priorityFeedback"
  | "import.statements"
  | "setup.wizard"
  | "setup.emailGuide"
  | "setup.extraEmails"
  | "setup.suggestions"
  | "setup.health"
  | "mailSync.connect"
  | "mailSync.imap"
  | "mailSync.statementPasswordKeychain"
  | "mailSync.background"
  | "setup.freshnessReminders";

/** Mirrors Apple EntitlementsMap. Unmapped features require Premium (fail closed). */
export const ENTITLEMENTS_MAP: Readonly<Record<Feature, Plan>> = {
  priorityFeedback: "premium",
  // Import and first-run setup are always free (setup-wizard spec §10).
  "import.statements": "free",
  "setup.wizard": "free",
  "setup.emailGuide": "free",
  "setup.extraEmails": "free",
  "setup.suggestions": "free",
  "setup.health": "free",
  "mailSync.connect": "free",
  "mailSync.imap": "free",
  "mailSync.statementPasswordKeychain": "free",
  "mailSync.background": "premium",
  "setup.freshnessReminders": "premium",
};

/** Per-plan quantity limits. Features without an entry have no limit. */
export const ENTITLEMENT_LIMITS: Readonly<Partial<Record<Feature, Record<Plan, number>>>> = {
  "setup.extraEmails": { free: 3, premium: 10 },
  "mailSync.connect": { free: 1, premium: 5 },
};

export function can(feature: string, plan: Plan): boolean {
  const required = Object.hasOwn(ENTITLEMENTS_MAP, feature)
    ? ENTITLEMENTS_MAP[feature as Feature]
    : "premium";
  return required === "free" || plan === "premium";
}

/** Quantity allowed for a feature on a plan: 0 when the plan can't use it, Infinity when unlimited. */
export function limit(feature: string, plan: Plan): number {
  if (!can(feature, plan)) return 0;
  const l = Object.hasOwn(ENTITLEMENT_LIMITS, feature) ? ENTITLEMENT_LIMITS[feature as Feature] : undefined;
  return l ? l[plan] : Infinity;
}
