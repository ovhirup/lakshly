// Generated from packages/shared/currency/currencies.json by apps/web/scripts/gen-currencies.mjs. Do not edit.

enum CurrencyCode: String, CaseIterable, Codable {
  case inr = "INR"
  case usd = "USD"
}

/// Amounts are integers in MINOR units (paise, cents).
struct CurrencyMagnitude {
  let minBudgetLine: Int64
  let budgetStepSmall: Int64
  let budgetStepLarge: Int64
  let budgetStepThreshold: Int64
  let annualPaymentThreshold: Int64
  let goalTargetRounding: Int64
  let goalEmergencyRounding: Int64
  let goalMonthlyRounding: Int64
  let goalMonthlyMinimum: Int64
  let customGoalDefault: Int64
  let glanceRounding: Int64
  let starterBudgets: [(category: String, amount: Int64)]
}

struct CurrencyInfo {
  let exponent: Int
  let symbol: String
  let locale: String
  let mask: String
  /// Thresholds in MAJOR units, descending.
  let compactUnits: [(threshold: Int64, suffix: String)]
  let magnitude: CurrencyMagnitude
}

extension CurrencyCode {
  var info: CurrencyInfo {
    switch self {
    case .inr:
      return CurrencyInfo(
        exponent: 2, symbol: "₹", locale: "en-IN", mask: "₹ •••••",
        compactUnits: [(10000000, "Cr"), (100000, "L"), (1000, "K")],
        magnitude: CurrencyMagnitude(
          minBudgetLine: 50000,
          budgetStepSmall: 10000,
          budgetStepLarge: 50000,
          budgetStepThreshold: 500000,
          annualPaymentThreshold: 500000,
          goalTargetRounding: 100000,
          goalEmergencyRounding: 1000000,
          goalMonthlyRounding: 10000,
          goalMonthlyMinimum: 50000,
          customGoalDefault: 5000000,
          glanceRounding: 100,
          starterBudgets: [("groceries", 600000), ("dining", 300000), ("transport", 200000), ("shopping", 300000)]
        )
      )
    case .usd:
      return CurrencyInfo(
        exponent: 2, symbol: "$", locale: "en-US", mask: "$ •••••",
        compactUnits: [(1000000000, "B"), (1000000, "M"), (1000, "K")],
        magnitude: CurrencyMagnitude(
          minBudgetLine: 2500,
          budgetStepSmall: 1000,
          budgetStepLarge: 5000,
          budgetStepThreshold: 50000,
          annualPaymentThreshold: 25000,
          goalTargetRounding: 10000,
          goalEmergencyRounding: 50000,
          goalMonthlyRounding: 1000,
          goalMonthlyMinimum: 2500,
          customGoalDefault: 100000,
          glanceRounding: 100,
          starterBudgets: [("groceries", 40000), ("dining", 20000), ("transport", 15000), ("shopping", 20000)]
        )
      )
    }
  }
}
