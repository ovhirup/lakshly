/* Generated from packages/shared/badges.rules.json and nudges.catalog.json by scripts/gen-entitlements.mjs. Do not edit. */

export const BADGE_RULES_JSON = {
  "$comment": "Lakshly badges for the public apps. Hand-written for this repo. Badges reward money moving the right way; they never reward spending, trading, redemptions, logins or app time, are never revoked, and can't be bought. Amounts are paise.",
  "version": 1,
  "xp": {
    "weeklyCap": 80,
    "historyBonusCap": 250,
    "premiumCanBuy": false
  },
  "defaults": {
    "variableExcludes": [
      "income",
      "transfers",
      "investments",
      "emi",
      "rent",
      "insurance"
    ],
    "excludeTags": [
      "refund",
      "big-ticket"
    ],
    "baseline": {
      "method": "median",
      "months": 3,
      "minMonths": 2
    }
  },
  "merchantSets": {
    "food_delivery": {
      "category": "dining",
      "pattern": "swiggy|zomato|eatsure|delivery|biryani house|tiffin"
    }
  },
  "families": [
    {
      "id": "budget",
      "label": "Budget & spending"
    },
    {
      "id": "debt",
      "label": "Debt"
    },
    {
      "id": "consistency",
      "label": "Consistency"
    },
    {
      "id": "savings",
      "label": "Savings"
    },
    {
      "id": "review",
      "label": "Weekly review"
    }
  ],
  "badges": [
    {
      "id": "under_budget",
      "name": "Under Budget",
      "family": "budget",
      "emoji": "🎯",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 30,
          "params": {
            "n": 1
          }
        },
        {
          "tier": "silver",
          "xp": 60,
          "params": {
            "n": 3
          }
        },
        {
          "tier": "gold",
          "xp": 120,
          "params": {
            "n": 6
          }
        }
      ],
      "rule": {
        "type": "consecutive_months_under_budget",
        "freezes": 1
      },
      "copy": {
        "rule": "Finish complete months with budgeted spending at or under your budgets ({n} in a row; one slip is forgiven).",
        "hint": "Keep budgeted categories under budget for a full month."
      }
    },
    {
      "id": "category_tamer",
      "name": "Category Tamer",
      "family": "budget",
      "emoji": "🐢",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 25,
          "params": {
            "factor": 0.85,
            "minBaseline": 100000
          }
        }
      ],
      "rule": {
        "type": "category_tamer"
      },
      "copy": {
        "rule": "In a complete month, bring one category to 85% or less of your usual while total variable spend stays at or under your usual.",
        "hint": "Spend 15% less than usual in one category, without overspending elsewhere."
      }
    },
    {
      "id": "wants_whisperer",
      "name": "Wants Whisperer",
      "family": "budget",
      "emoji": "🤫",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 25,
          "params": {
            "maxShare": 0.3
          }
        },
        {
          "tier": "silver",
          "xp": 40,
          "params": {
            "maxShare": 0.25
          }
        },
        {
          "tier": "gold",
          "xp": 60,
          "params": {
            "maxShare": 0.2
          }
        }
      ],
      "rule": {
        "type": "share_of_spend",
        "nwv": "want",
        "minCount": 10
      },
      "copy": {
        "rule": "Wants are {maxSharePct} or less of a complete month's variable spend (with at least 10 Wants that month).",
        "hint": "Keep Wants to a smaller slice of the month."
      }
    },
    {
      "id": "vice_free_fortnight",
      "name": "Vice-free Streak",
      "family": "budget",
      "emoji": "🕊️",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 30,
          "params": {
            "days": 14
          }
        },
        {
          "tier": "silver",
          "xp": 40,
          "params": {
            "days": 30
          }
        },
        {
          "tier": "gold",
          "xp": 60,
          "params": {
            "days": 60
          }
        }
      ],
      "rule": {
        "type": "zero_run_days",
        "match": {
          "nwv": "vice"
        },
        "needsPriorMatch": true
      },
      "copy": {
        "rule": "{days} days in a row with no spend tagged Vice (counted after your first Vice).",
        "hint": "Tag Vices in the weekly review, then keep a run going."
      }
    },
    {
      "id": "no_delivery_week",
      "name": "No-Delivery Week",
      "family": "budget",
      "emoji": "🍲",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 20,
          "params": {
            "days": 7
          }
        },
        {
          "tier": "silver",
          "xp": 30,
          "params": {
            "days": 14
          }
        },
        {
          "tier": "gold",
          "xp": 50,
          "params": {
            "days": 30
          }
        }
      ],
      "rule": {
        "type": "zero_run_days",
        "match": {
          "set": "food_delivery"
        },
        "needsPriorMatch": false
      },
      "copy": {
        "rule": "{days} days in a row with no food-delivery orders.",
        "hint": "Cook in or eat out, just skip delivery apps for a stretch."
      }
    },
    {
      "id": "emi_on_time",
      "name": "EMI on Time",
      "family": "debt",
      "emoji": "⏱️",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 20,
          "params": {
            "n": 3
          }
        },
        {
          "tier": "silver",
          "xp": 40,
          "params": {
            "n": 6
          }
        },
        {
          "tier": "gold",
          "xp": 80,
          "params": {
            "n": 12
          }
        }
      ],
      "rule": {
        "type": "on_time_instalments",
        "tolerancePct": 2,
        "lookbackDays": 31
      },
      "copy": {
        "rule": "{n} instalments in a row paid on or before the due date (within 2% of the EMI).",
        "hint": "Pay each EMI on or before its due date."
      }
    },
    {
      "id": "slice_cleared",
      "name": "Slice Cleared",
      "family": "debt",
      "emoji": "🧩",
      "perEntity": true,
      "tiers": [
        {
          "tier": "bronze",
          "xp": 25,
          "params": {
            "pct": 10
          }
        },
        {
          "tier": "silver",
          "xp": 25,
          "params": {
            "pct": 25
          }
        },
        {
          "tier": "gold",
          "xp": 25,
          "params": {
            "pct": 50
          }
        }
      ],
      "rule": {
        "type": "debt_repaid_pct"
      },
      "copy": {
        "rule": "Repay {pct}% of a loan's principal.",
        "hint": "Every EMI clears another slice of the principal."
      }
    },
    {
      "id": "debt_free",
      "name": "Debt Free",
      "family": "debt",
      "emoji": "🎉",
      "perEntity": true,
      "tiers": [
        {
          "tier": "bronze",
          "xp": 100,
          "params": {}
        }
      ],
      "rule": {
        "type": "debt_closed"
      },
      "copy": {
        "rule": "A loan's outstanding reaches zero.",
        "hint": "Close out a loan completely."
      }
    },
    {
      "id": "sip_steady",
      "name": "SIP Steady",
      "family": "consistency",
      "emoji": "🌱",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 20,
          "params": {
            "n": 3,
            "freezes": 0
          }
        },
        {
          "tier": "silver",
          "xp": 40,
          "params": {
            "n": 6,
            "freezes": 1
          }
        },
        {
          "tier": "gold",
          "xp": 80,
          "params": {
            "n": 12,
            "freezes": 1
          }
        }
      ],
      "rule": {
        "type": "sip_months",
        "windowDays": 5
      },
      "copy": {
        "rule": "{n} months in a row where every active SIP went through within 5 days of its date. Amounts never matter.",
        "hint": "Let every active SIP run each month."
      }
    },
    {
      "id": "emergency_ready",
      "name": "Emergency Ready",
      "family": "savings",
      "emoji": "🛟",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 30,
          "params": {
            "months": 1
          }
        },
        {
          "tier": "silver",
          "xp": 60,
          "params": {
            "months": 3
          }
        },
        {
          "tier": "gold",
          "xp": 120,
          "params": {
            "months": 6
          }
        }
      ],
      "rule": {
        "type": "emergency_months"
      },
      "copy": {
        "rule": "Savings, current, cash and fixed deposits cover {months} months of your typical total spend.",
        "hint": "Build a cushion of easy-to-reach money."
      }
    },
    {
      "id": "pay_yourself_first",
      "name": "Pay Yourself First",
      "family": "savings",
      "emoji": "🥇",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 30,
          "params": {
            "n": 3,
            "withinDays": 3,
            "salaryMin": 1000000
          }
        }
      ],
      "rule": {
        "type": "pay_yourself_first"
      },
      "copy": {
        "rule": "3 months in a row where an investment goes out within 3 days of your salary landing.",
        "hint": "Move your SIP date to just after payday."
      }
    },
    {
      "id": "inbox_zero",
      "name": "Inbox Zero",
      "family": "review",
      "emoji": "📥",
      "tiers": [
        {
          "tier": "bronze",
          "xp": 20,
          "params": {
            "n": 4
          }
        },
        {
          "tier": "silver",
          "xp": 40,
          "params": {
            "n": 12
          }
        },
        {
          "tier": "gold",
          "xp": 80,
          "params": {
            "n": 26
          }
        }
      ],
      "rule": {
        "type": "cleared_weeks"
      },
      "copy": {
        "rule": "Clear the weekly review {n} times.",
        "hint": "Finish a weekly review."
      }
    }
  ]
};

export const NUDGE_CATALOG_JSON = {
  "$comment": "Lakshly nudge catalog for the public apps. Hand-written for this repo. One nudge a day at most; every nudge explains itself and offers 'Not now'. 'masked' variants never contain amounts. roast is null where roasting isn't appropriate (debt, credit, investing).",
  "version": 1,
  "limits": {
    "maxShownPerDay": 1,
    "maxPerScreen": 1,
    "snoozeDaysOnNotNow": 7,
    "minDataDaysForNegative": 30,
    "negativePerWeek": 3,
    "roastOffAfterOverMonths": 2,
    "guardrail": {
      "minShown": 4,
      "snoozeShare": 0.5,
      "days": 30
    }
  },
  "bannedWords": [
    "stupid",
    "idiot",
    "broke",
    "loser",
    "shame",
    "pathetic",
    "failure",
    "lazy",
    "waste of money"
  ],
  "maskPlaceholders": [
    "{amount}",
    "{usual}",
    "{spent}",
    "{budget}",
    "{value}"
  ],
  "nudges": [
    {
      "id": "pace_over",
      "polarity": "negative",
      "source": "pace",
      "screen": "overview",
      "v1Priority": 1,
      "priority": 90,
      "cooldownHours": 72,
      "minHistoryDays": 30,
      "trigger": "A budgeted category has used {usedPct} of its budget by day {day} of {dim} (more than 20 points ahead of the calendar).",
      "action": {
        "label": "Open Budget",
        "href": "/budget/"
      },
      "templates": {
        "hype": {
          "text": "Heads up! {category} is at {usedPct} of budget on day {day}. You've got this: a lighter week puts it back on track 💪",
          "masked": "Heads up! {category} is running ahead of budget. A lighter week puts it back on track 💪"
        },
        "straight": {
          "text": "{category}: {spent} of {budget} used ({usedPct}) by day {day}.",
          "masked": "{category} is running ahead of budget this month."
        },
        "roast": {
          "text": "{category} is sprinting: {usedPct} gone and it's only day {day}. Maybe let it walk for a bit? 🐢",
          "masked": "{category} is sprinting ahead of budget. Maybe let it walk for a bit? 🐢"
        }
      }
    },
    {
      "id": "pace_under",
      "polarity": "positive",
      "source": "pace",
      "screen": "overview",
      "v1Priority": 2,
      "priority": 60,
      "cooldownHours": 72,
      "minHistoryDays": 0,
      "trigger": "Variable spend this month is {usedPct} of your usual by day {day} of {dim} (at least 15 points behind the calendar).",
      "action": {
        "label": "See Spend",
        "href": "/spend/"
      },
      "templates": {
        "hype": {
          "text": "Look at you! Only {usedPct} of your usual spend by day {day} ✨",
          "masked": "Look at you! You're spending well under your usual pace ✨"
        },
        "straight": {
          "text": "Month to date: {spent}, {usedPct} of your usual {usual} by day {day}.",
          "masked": "You're under your usual spending pace this month."
        },
        "roast": {
          "text": "Only {usedPct} of your usual by day {day}? Who are you and what did you do with the old you? 😏",
          "masked": "Under your usual pace? Who are you and what did you do with the old you? 😏"
        }
      }
    },
    {
      "id": "near_badge",
      "polarity": "positive",
      "source": "badges",
      "screen": "overview",
      "v1Priority": 4,
      "priority": 50,
      "cooldownHours": 96,
      "minHistoryDays": 0,
      "trigger": "You're {pct} of the way to {badge} {tier}.",
      "action": {
        "label": "See badges",
        "href": "/badges/"
      },
      "templates": {
        "hype": {
          "text": "So close! {emoji} {badge} {tier} is {pct} done. {hint}",
          "masked": "So close! {emoji} {badge} {tier} is {pct} done. {hint}"
        },
        "straight": {
          "text": "{emoji} {badge} {tier}: {pct} there. {hint}",
          "masked": "{emoji} {badge} {tier}: {pct} there. {hint}"
        },
        "roast": {
          "text": "{emoji} {badge} {tier} is {pct} done. It's practically begging you to finish. {hint}",
          "masked": "{emoji} {badge} {tier} is {pct} done. It's practically begging you to finish. {hint}"
        }
      }
    },
    {
      "id": "review_waiting",
      "polarity": "info",
      "source": "review",
      "screen": "overview",
      "v1Priority": 9,
      "priority": 40,
      "cooldownHours": 48,
      "minHistoryDays": 0,
      "trigger": "{count} spends are waiting in this week's review.",
      "action": {
        "label": "Review",
        "href": "/review/"
      },
      "templates": {
        "hype": {
          "text": "{count} spends are ready for a quick check. Two minutes, then inbox zero 🎉",
          "masked": "{count} spends are ready for a quick check. Two minutes, then inbox zero 🎉"
        },
        "straight": {
          "text": "{count} spends to review this week.",
          "masked": "{count} spends to review this week."
        },
        "roast": {
          "text": "{count} spends are sitting in your review, quietly judging you. Go say hi.",
          "masked": "{count} spends are sitting in your review, quietly judging you. Go say hi."
        }
      }
    },
    {
      "id": "delivery_burst",
      "polarity": "negative",
      "source": "delivery",
      "screen": "spend",
      "v1Priority": 9,
      "priority": 70,
      "cooldownHours": 120,
      "minHistoryDays": 30,
      "trigger": "{count} food-delivery orders in the last 7 days ({spent}), at least double your usual week ({usual}).",
      "action": {
        "label": "See Spend",
        "href": "/spend/"
      },
      "templates": {
        "hype": {
          "text": "{count} deliveries this week! Fancy a home-cooked comeback? 🍳",
          "masked": "Lots of deliveries this week! Fancy a home-cooked comeback? 🍳"
        },
        "straight": {
          "text": "{count} delivery orders in 7 days: {spent} vs about {usual} in a usual week.",
          "masked": "Delivery orders are about double your usual this week."
        },
        "roast": {
          "text": "{count} deliveries in a week. The delivery riders know your gate code by now. 🛵",
          "masked": "The delivery riders know your gate code by now. 🛵"
        }
      }
    },
    {
      "id": "points_expiring",
      "polarity": "info",
      "source": "rewards",
      "screen": "overview",
      "v1Priority": 9,
      "priority": 30,
      "cooldownHours": 168,
      "minHistoryDays": 0,
      "trigger": "{program} points expire on {date} ({days} days).",
      "action": {
        "label": "Open Rewards",
        "href": "/rewards/"
      },
      "templates": {
        "hype": {
          "text": "Free value alert! {program} points expire in {days} days 🎁",
          "masked": "Free value alert! {program} points expire in {days} days 🎁"
        },
        "straight": {
          "text": "{program} points expire in {days} days ({date}).",
          "masked": "{program} points expire in {days} days ({date})."
        },
        "roast": null
      }
    }
  ]
};
