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
  "badges.animatedFrames",
  "badges.cabinet",
  "badges.core",
  "badges.share",
  "badges.themes",
  "budgets.lines",
  "budgets.unlimited",
  "core.tabs",
  "credit.insights",
  "data.delete",
  "data.export",
  "debt.planner",
  "glance.notchPanel",
  "history.full",
  "import.statements",
  "investments.insights",
  "mailSync.background",
  "mailSync.connect",
  "mailSync.imap",
  "mailSync.statementPasswordKeychain",
  "nudges.core",
  "nudges.notifications",
  "nudges.tone.hype",
  "nudges.tone.roast",
  "priorityFeedback",
  "privacy.autoHide",
  "privacy.mode",
  "privacy.shake",
  "privacy.widgetMask",
  "review.inbox",
  "review.merchantRules",
  "review.reminder",
  "review.widget",
  "review.worthIt",
  "rewards.tracking",
  "security.encryption",
  "security.lock",
  "setup.emailGuide",
  "setup.extraEmails",
  "setup.freshnessReminders",
  "setup.health",
  "setup.suggestions",
  "setup.wizard",
  "themes.premium"
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];
export type FeatureSpec = { minTier: "free" | "premium" | "superUser"; label: string; limits?: Partial<Record<"free" | "premium" | "superUser", number | null>> };
export const FEATURES: Readonly<Record<FeatureId, FeatureSpec>> = {
  "badges.animatedFrames": {
    "minTier": "premium",
    "label": "Animated badge frames"
  },
  "badges.cabinet": {
    "minTier": "free",
    "label": "Badge cabinet"
  },
  "badges.core": {
    "minTier": "free",
    "label": "All badges and XP (never for sale)"
  },
  "badges.share": {
    "minTier": "free",
    "label": "Share a badge image (no amounts)"
  },
  "badges.themes": {
    "minTier": "premium",
    "label": "Badge themes"
  },
  "budgets.lines": {
    "minTier": "free",
    "label": "Budget category lines per budget",
    "limits": {
      "free": 6,
      "premium": null
    }
  },
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
  "glance.notchPanel": {
    "minTier": "premium",
    "label": "Mac notch glance panel"
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
  "mailSync.background": {
    "minTier": "premium",
    "label": "Background mailbox sync"
  },
  "mailSync.connect": {
    "minTier": "free",
    "label": "Automatic read-only statement sync",
    "limits": {
      "free": 1,
      "premium": 5
    }
  },
  "mailSync.imap": {
    "minTier": "free",
    "label": "IMAP mailbox sync (Apple)"
  },
  "mailSync.statementPasswordKeychain": {
    "minTier": "free",
    "label": "Remember statement passwords on this device (Apple)"
  },
  "nudges.core": {
    "minTier": "free",
    "label": "Coach nudges with Not now, Why? and snooze"
  },
  "nudges.notifications": {
    "minTier": "free",
    "label": "Nudge notifications (Apple apps)"
  },
  "nudges.tone.hype": {
    "minTier": "free",
    "label": "Hype and Straight coach tones"
  },
  "nudges.tone.roast": {
    "minTier": "premium",
    "label": "Roast-lite coach tone"
  },
  "priorityFeedback": {
    "minTier": "premium",
    "label": "Priority feature requests"
  },
  "privacy.autoHide": {
    "minTier": "free",
    "label": "Hide when switching away"
  },
  "privacy.mode": {
    "minTier": "free",
    "label": "Privacy mode (hide amounts)"
  },
  "privacy.shake": {
    "minTier": "free",
    "label": "Shake to hide"
  },
  "privacy.widgetMask": {
    "minTier": "free",
    "label": "Widgets without amounts"
  },
  "review.inbox": {
    "minTier": "free",
    "label": "Weekly review inbox"
  },
  "review.merchantRules": {
    "minTier": "free",
    "label": "Remember a category for a merchant",
    "limits": {
      "free": null
    }
  },
  "review.reminder": {
    "minTier": "free",
    "label": "Sunday review reminder"
  },
  "review.widget": {
    "minTier": "free",
    "label": "Review count widget"
  },
  "review.worthIt": {
    "minTier": "free",
    "label": "Worth-it tags"
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
  "setup.emailGuide": {
    "minTier": "free",
    "label": "Email search guide for statements"
  },
  "setup.extraEmails": {
    "minTier": "free",
    "label": "Extra email addresses in the search guide",
    "limits": {
      "free": 3,
      "premium": 10
    }
  },
  "setup.freshnessReminders": {
    "minTier": "premium",
    "label": "Statement freshness reminders"
  },
  "setup.health": {
    "minTier": "free",
    "label": "Setup health and freshness"
  },
  "setup.suggestions": {
    "minTier": "free",
    "label": "Suggested budget and first goal"
  },
  "setup.wizard": {
    "minTier": "free",
    "label": "Guided setup"
  },
  "themes.premium": {
    "minTier": "premium",
    "label": "3 extra themes"
  }
};
export const FREE_BILL_OF_RIGHTS: readonly FeatureId[] = ["security.lock","security.encryption","import.statements","core.tabs","data.delete","data.export","setup.wizard","setup.emailGuide","mailSync.connect","privacy.mode","badges.core"];
