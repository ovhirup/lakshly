import XCTest
@testable import Lakshly

/// WP1 B4: the Swift setup suggestions read their thresholds from the currency table. INR is pinned by SetupGoldenTests;
/// these pin USD and mirror packages/shared/tests/setup-currency.test.ts and apps/web/tests/setup-currency.test.ts.
final class SetupCurrencyTests: XCTestCase {
  private func txn(_ date: String, _ amount: Int64) -> SetupTransaction {
    SetupTransaction(id: "t" + date, date: date, amount: amount, category: "groceries", merchant: nil, tags: nil)
  }

  func testUsdKeepsAThirtyDollarLineThatInrDrops() {
    let ds = SetupDataset(transactions: ["2026-06-10", "2026-07-10", "2026-08-10"].map { txn($0, -3_000) }, accounts: [], budgets: nil, goals: nil)
    XCTAssertEqual(suggestBudget(ds, today: "2026-09-15", factorPct: 100, currency: .usd).lines.map(\.category), ["groceries"])
    XCTAssertEqual(suggestBudget(ds, today: "2026-09-15", factorPct: 100, currency: .inr).lines.count, 0)
  }

  func testUsdEmergencyTargetRoundsToFiveHundredDollars() {
    let ds = SetupDataset(transactions: ["2026-06-10", "2026-07-10", "2026-08-10"].map { txn($0, -123_400) }, accounts: [], budgets: nil, goals: nil)
    let goal = suggestGoal(ds, today: "2026-09-15", currency: .usd)
    XCTAssertEqual(goal.rule, "emergency3")
    XCTAssertEqual(goal.target, 400_000) // 3 x $1,234 = $3,702 -> $4,000
    XCTAssertEqual((goal.target ?? 0) % 50_000, 0)
  }

  func testDefaultCurrencyIsInr() {
    let ds = SetupDataset(transactions: ["2026-06-10", "2026-07-10", "2026-08-10"].map { txn($0, -123_400) }, accounts: [], budgets: nil, goals: nil)
    XCTAssertEqual(suggestGoal(ds, today: "2026-09-15"), suggestGoal(ds, today: "2026-09-15", currency: .inr))
    XCTAssertEqual(suggestBudget(ds, today: "2026-09-15"), suggestBudget(ds, today: "2026-09-15", currency: .inr))
  }

  func testUsdBudgetUsesTheFiftyDollarStepAtAndAboveFiveHundredDollars() {
    // Median $625: USD rounds on the $50 step (-> $650); a swapped small/large step would give $630. INR for 62_500 paise uses the ₹100 step.
    let ds = SetupDataset(transactions: ["2026-06-10", "2026-07-10", "2026-08-10"].map { txn($0, -62_500) }, accounts: [], budgets: nil, goals: nil)
    XCTAssertEqual(suggestBudget(ds, today: "2026-09-15", factorPct: 100, currency: .usd).lines.first?.limit, 65_000)
    XCTAssertEqual(suggestBudget(ds, today: "2026-09-15", factorPct: 100, currency: .inr).lines.first?.limit, 60_000)
  }

  func testUsdAnnualPaymentThresholdIsTwoHundredFiftyDollars() {
    var txns = ["2025-12-10", "2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10", "2026-06-10", "2026-07-10", "2026-08-10"].map { txn($0, -10_000) }
    txns.append(SetupTransaction(id: "ins", date: "2025-12-01", amount: -30_000, category: "insurance", merchant: "Insurer", tags: nil))
    let ds = SetupDataset(transactions: txns, accounts: [SetupAccountBalance(type: "savings", balance: 1_000_000)], budgets: nil, goals: nil)
    // $300 qualifies in USD (threshold $250) but is far below the INR threshold of 500_000 paise.
    XCTAssertEqual(suggestGoal(ds, today: "2026-09-15", currency: .usd).rule, "annualPayment")
    XCTAssertNotEqual(suggestGoal(ds, today: "2026-09-15", currency: .inr).rule, "annualPayment")
  }

  func testUsdMonthlyGoalMinimumIsThirtyDollars() {
    // Median $1,000/month, savings $2,990: the emergency target is $3,000, the gap is $10, so the monthly amount is lifted to the $30 floor.
    let ds = SetupDataset(transactions: ["2026-06-10", "2026-07-10", "2026-08-10"].map { txn($0, -100_000) }, accounts: [SetupAccountBalance(type: "savings", balance: 299_000)], budgets: nil, goals: nil)
    let goal = suggestGoal(ds, today: "2026-09-15", currency: .usd)
    XCTAssertEqual(goal.rule, "emergency3")
    XCTAssertEqual(goal.monthly, 3_000)
  }
}
