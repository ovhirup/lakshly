/* Generated from packages/shared/currency/currencies.json by scripts/gen-currencies.mjs. Do not edit. */

export const CURRENCY_CODES = ["INR","USD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export type CurrencyMagnitude = {
  minBudgetLine: number;
  budgetStepSmall: number;
  budgetStepLarge: number;
  budgetStepThreshold: number;
  annualPaymentThreshold: number;
  goalTargetRounding: number;
  goalEmergencyRounding: number;
  goalMonthlyRounding: number;
  goalMonthlyMinimum: number;
  customGoalDefault: number;
  glanceRounding: number;
  starterBudgets: readonly (readonly [string, number])[];
};
export type CurrencyInfo = {
  exponent: number; symbol: string; locale: string; mask: string;
  /** Thresholds in MAJOR units, descending. */
  compactUnits: readonly (readonly [number, string])[];
  /** Amounts in MINOR units. */
  magnitude: CurrencyMagnitude;
};
export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyInfo>> = {
  "INR": {
    "exponent": 2,
    "symbol": "₹",
    "locale": "en-IN",
    "mask": "₹ •••••",
    "compactUnits": [
      [
        10000000,
        "Cr"
      ],
      [
        100000,
        "L"
      ],
      [
        1000,
        "K"
      ]
    ],
    "magnitude": {
      "minBudgetLine": 50000,
      "budgetStepSmall": 10000,
      "budgetStepLarge": 50000,
      "budgetStepThreshold": 500000,
      "annualPaymentThreshold": 500000,
      "goalTargetRounding": 100000,
      "goalEmergencyRounding": 1000000,
      "goalMonthlyRounding": 10000,
      "goalMonthlyMinimum": 50000,
      "customGoalDefault": 5000000,
      "glanceRounding": 100,
      "starterBudgets": [
        [
          "groceries",
          600000
        ],
        [
          "dining",
          300000
        ],
        [
          "transport",
          200000
        ],
        [
          "shopping",
          300000
        ]
      ]
    }
  },
  "USD": {
    "exponent": 2,
    "symbol": "$",
    "locale": "en-US",
    "mask": "$ •••••",
    "compactUnits": [
      [
        1000000000,
        "B"
      ],
      [
        1000000,
        "M"
      ],
      [
        1000,
        "K"
      ]
    ],
    "magnitude": {
      "minBudgetLine": 2500,
      "budgetStepSmall": 1000,
      "budgetStepLarge": 5000,
      "budgetStepThreshold": 50000,
      "annualPaymentThreshold": 25000,
      "goalTargetRounding": 10000,
      "goalEmergencyRounding": 50000,
      "goalMonthlyRounding": 1000,
      "goalMonthlyMinimum": 2500,
      "customGoalDefault": 100000,
      "glanceRounding": 100,
      "starterBudgets": [
        [
          "groceries",
          40000
        ],
        [
          "dining",
          20000
        ],
        [
          "transport",
          15000
        ],
        [
          "shopping",
          20000
        ]
      ]
    }
  }
};
