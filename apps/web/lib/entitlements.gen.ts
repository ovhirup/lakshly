/* Generated from packages/shared/entitlements.json by scripts/gen-entitlements.mjs. Do not edit. */

export const TIERS = ["superUser","premium","free"] as const;
export const PRICES = {
  "INR": {
    "monthly": 11900,
    "yearly": 99900
  },
  "USD": {
    "monthly": 499,
    "yearly": 3999
  }
} as const;
export const FEATURE_IDS = [
  "budgets.unlimited",
  "core.tabs",
  "credit.insights",
  "data.delete",
  "data.export",
  "debt.planner",
  "history.full",
  "import.statements",
  "investments.insights",
  "priorityFeedback",
  "rewards.tracking",
  "security.encryption",
  "security.lock",
  "themes.premium"
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];
export type FeatureSpec = { minTier: "free" | "premium" | "superUser"; label: string; limits?: Partial<Record<"free" | "premium" | "superUser", number | null>> };
export const FEATURES: Readonly<Record<FeatureId, FeatureSpec>> = {
  "budgets.unlimited": {
    "minTier": "premium",
    "label": "Unlimited budgets",
    "limits": {
      "free": 1,
      "premium": null
    }
  },
  "core.tabs": {
    "minTier": "free",
    "label": "Overview, Spend, Budget and History"
  },
  "credit.insights": {
    "minTier": "premium",
    "label": "Credit insights"
  },
  "data.delete": {
    "minTier": "free",
    "label": "Delete all your data"
  },
  "data.export": {
    "minTier": "free",
    "label": "Export your own data"
  },
  "debt.planner": {
    "minTier": "premium",
    "label": "Debt planner and payoff what-ifs"
  },
  "history.full": {
    "minTier": "premium",
    "label": "Unlimited history",
    "limits": {
      "free": 12,
      "premium": null
    }
  },
  "import.statements": {
    "minTier": "free",
    "label": "Statement import (PDF, CSV, CAS)"
  },
  "investments.insights": {
    "minTier": "premium",
    "label": "Investment insights"
  },
  "priorityFeedback": {
    "minTier": "premium",
    "label": "Priority feature requests"
  },
  "rewards.tracking": {
    "minTier": "premium",
    "label": "Rewards tracking"
  },
  "security.encryption": {
    "minTier": "free",
    "label": "On-device encryption"
  },
  "security.lock": {
    "minTier": "free",
    "label": "App lock"
  },
  "themes.premium": {
    "minTier": "premium",
    "label": "3 extra themes"
  }
};
export const FREE_BILL_OF_RIGHTS: readonly FeatureId[] = ["security.lock","security.encryption","import.statements","core.tabs","data.delete","data.export"];
