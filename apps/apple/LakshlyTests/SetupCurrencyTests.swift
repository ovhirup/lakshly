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
}
