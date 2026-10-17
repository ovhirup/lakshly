import XCTest
@testable import Lakshly

final class WowFreedomTests: XCTestCase {
  func testSingleLoanBaselinePayoffMonth() {
    let loan = debt("loan", "Demo personal loan", principal: 12_000, outstanding: 12_000, rate: 12, emi: 5_000)
    let plan = Freedom.simulate(debts: [loan], from: "2026-01", extraPaise: 0, rollOver: false)
    XCTAssertEqual(plan.freedomMonth, "2026-03" as String?)
    XCTAssertEqual(plan.months, 3)
    XCTAssertEqual(plan.totalInterestPaise, 213)
    XCTAssertEqual(plan.payoffs, [DebtPayoff(id: "loan", name: "Demo personal loan", month: "2026-03")])
    XCTAssertTrue(plan.unscheduled.isEmpty)

    let flat = debt("flat", "Demo flat loan", principal: 30_000, outstanding: 30_000, rate: 0, emi: 10_000)
    let flatPlan = Freedom.simulate(debts: [flat], from: "2026-01", extraPaise: 0, rollOver: false)
    XCTAssertEqual(flatPlan.freedomMonth, "2026-03" as String?)
    XCTAssertEqual(flatPlan.months, 3)
    XCTAssertEqual(flatPlan.totalInterestPaise, 0)
  }

  func testEmiZeroDebtIsUnscheduled() {
    let loan = debt("loan", "Demo personal loan", principal: 30_000, outstanding: 30_000, rate: 0, emi: 10_000)
    let family = debt(
      "family", "Demo family loan", principal: 10_000, outstanding: 10_000, rate: 0, emi: 0, kind: "family")
    let paid = debt("paid", "Demo closed loan", principal: 5_000, outstanding: 0, rate: 10, emi: 500)
    let plan = Freedom.simulate(debts: [loan, family, paid], from: "2026-01", extraPaise: 0, rollOver: false)
    XCTAssertEqual(plan.unscheduled.map(\.id), ["family", "paid"])
    XCTAssertEqual(plan.payoffs.map(\.id), ["loan"])
    XCTAssertEqual(plan.freedomMonth, "2026-03" as String?)
    XCTAssertFalse(plan.payoffs.contains { $0.id == "family" })
  }

  func testExtraPullsTheDateInAndSavesInterest() {
    let loan = debt("loan", "Demo personal loan", principal: 12_000, outstanding: 12_000, rate: 12, emi: 5_000)
    let baseline = Freedom.simulate(debts: [loan], from: "2026-01", extraPaise: 0, rollOver: false)
    let whatIf = Freedom.simulate(debts: [loan], from: "2026-01", extraPaise: 3_000, rollOver: false)
    XCTAssertEqual(baseline.freedomMonth, "2026-03" as String?)
    XCTAssertEqual(whatIf.freedomMonth, "2026-02" as String?)
    XCTAssertEqual(whatIf.totalInterestPaise, 161)
    XCTAssertEqual(Freedom.pullIn(baseline: baseline, whatIf: whatIf), 1)
    XCTAssertEqual(Freedom.interestSaved(baseline: baseline, whatIf: whatIf), 52)
    XCTAssertEqual(Freedom.pullIn(baseline: baseline, whatIf: baseline), 0)
    XCTAssertEqual(Freedom.interestSaved(baseline: whatIf, whatIf: baseline), 0)
    XCTAssertEqual(Freedom.message(pullIn: 1), "1 month sooner, nice nudge 🎉")
  }

  func testRollOverBeatsNoRollOver() {
    let first = debt("a", "Demo high loan", principal: 10_000, outstanding: 10_000, rate: 0, emi: 10_000)
    let second = debt("b", "Demo long loan", principal: 20_000, outstanding: 20_000, rate: 0, emi: 5_000)
    let debts = [first, second]
    let plain = Freedom.simulate(debts: debts, from: "2026-01", extraPaise: 0, rollOver: false)
    let rolled = Freedom.simulate(debts: debts, from: "2026-01", extraPaise: 0, rollOver: true)
    XCTAssertEqual(plain.freedomMonth, "2026-04" as String?)
    XCTAssertEqual(plain.months, 4)
    XCTAssertEqual(rolled.freedomMonth, "2026-02" as String?)
    XCTAssertEqual(rolled.months, 2)
    XCTAssertGreaterThan(Freedom.pullIn(baseline: plain, whatIf: rolled), 0)
    XCTAssertEqual(Freedom.pullIn(baseline: plain, whatIf: rolled), 2)
    XCTAssertLessThan(rolled.months, plain.months)
  }

  func testAvalancheTargetsHighestRateThenSmallestBalance() {
    let high = debt("high", "Demo high rate", principal: 50_000, outstanding: 50_000, rate: 24, emi: 100)
    let low = debt("low", "Demo low rate", principal: 5_000, outstanding: 5_000, rate: 1, emi: 100)
    let plan = Freedom.simulate(debts: [low, high], from: "2026-04", extraPaise: 50_900, rollOver: false)
    XCTAssertEqual(payoffMonth(plan, "high"), "2026-04" as String?)
    XCTAssertNotEqual(payoffMonth(plan, "low"), "2026-04" as String?)

    let big = debt("big", "Demo big balance", principal: 10_000, outstanding: 10_000, rate: 12, emi: 100)
    let small = debt("small", "Demo small balance", principal: 4_000, outstanding: 4_000, rate: 12, emi: 100)
    let tie = Freedom.simulate(debts: [big, small], from: "2026-05", extraPaise: 5_000, rollOver: false)
    XCTAssertEqual(payoffMonth(tie, "small"), "2026-05" as String?)
    XCTAssertNotEqual(payoffMonth(tie, "big"), "2026-05" as String?)

    let heavy = debt("heavy", "Demo heavy rate", principal: 5_000, outstanding: 5_000, rate: 18, emi: 5_000)
    let light = debt("light", "Demo light rate", principal: 1_000, outstanding: 1_000, rate: 1, emi: 100)
    let cascade = Freedom.simulate(debts: [light, heavy], from: "2026-08", extraPaise: 976, rollOver: false)
    XCTAssertEqual(cascade.payoffs.map(\.month), ["2026-08" as String?, "2026-08" as String?])
  }

  func testEmiBelowInterestHasNoFreedomMonth() {
    let trap = debt("trap", "Demo interest trap", principal: 100_000, outstanding: 100_000, rate: 12, emi: 500)
    let plan = Freedom.simulate(debts: [trap], from: "2026-01", extraPaise: 0, rollOver: false)
    XCTAssertNil(plan.freedomMonth)
    XCTAssertEqual(plan.months, Freedom.maxMonths)
    XCTAssertEqual(plan.payoffs, [DebtPayoff(id: "trap", name: "Demo interest trap", month: nil)])
    XCTAssertGreaterThan(plan.totalInterestPaise, 0)
  }

  func testCountdownNeverNegative() {
    XCTAssertEqual(Freedom.countdown(to: "2001-01", now: Date()).days, 0)
    XCTAssertGreaterThan(Freedom.countdown(to: "2099-01", now: Date()).days, 0)
    XCTAssertEqual(Freedom.countdown(to: "not-a-month", now: Date()).days, 0)

    let calendar = Calendar.current
    let mid = calendar.date(from: DateComponents(year: 2026, month: 6, day: 15))!
    XCTAssertEqual(Freedom.countdown(to: "2026-06", now: mid).days, 16)
    let onTarget = calendar.date(from: DateComponents(year: 2026, month: 7, day: 1))!
    XCTAssertEqual(Freedom.countdown(to: "2026-06", now: onTarget).days, 0)
    let after = calendar.date(from: DateComponents(year: 2026, month: 7, day: 2, hour: 9))!
    XCTAssertEqual(Freedom.countdown(to: "2026-06", now: after).days, 0)
  }

  func testClearedFraction() {
    XCTAssertEqual(Freedom.clearedFraction(debts: []), 0)
    let zero = debt("zero", "Demo zero", principal: 0, outstanding: 0, rate: 0, emi: 0)
    XCTAssertEqual(Freedom.clearedFraction(debts: [zero]), 0)
    let half = debt("half", "Demo half", principal: 200, outstanding: 100, rate: 0, emi: 10)
    XCTAssertEqual(Freedom.clearedFraction(debts: [half]), 0.5)
    let done = debt("done", "Demo done", principal: 80, outstanding: 20, rate: 0, emi: 10)
    let open = debt("open", "Demo open", principal: 80, outstanding: 80, rate: 0, emi: 10)
    XCTAssertEqual(Freedom.clearedFraction(debts: [done, open]), 0.375)
  }

  func testMessageThresholds() {
    XCTAssertEqual(Freedom.message(pullIn: 0), "Steady and sure, the tortoise also won 🐢")
    XCTAssertEqual(Freedom.message(pullIn: -3), "Steady and sure, the tortoise also won 🐢")
    XCTAssertEqual(Freedom.message(pullIn: 1), "1 month sooner, nice nudge 🎉")
    XCTAssertEqual(Freedom.message(pullIn: 2), "2 months sooner, nice nudge 🎉")
    XCTAssertEqual(Freedom.message(pullIn: 5), "5 months sooner, nice nudge 🎉")
    XCTAssertEqual(Freedom.message(pullIn: 6), "6 months sooner, half a year back in your pocket 🚀")
    XCTAssertEqual(Freedom.message(pullIn: 11), "11 months sooner, half a year back in your pocket 🚀")
    XCTAssertEqual(Freedom.message(pullIn: 12), "12 months sooner, freedom speedrun unlocked 🏁")
    XCTAssertEqual(Freedom.message(pullIn: 24), "24 months sooner, freedom speedrun unlocked 🏁")
  }

  func testStartMonthUsesTheReviewClock() {
    let calendar = Calendar.current
    let now = calendar.date(from: DateComponents(year: 2026, month: 10, day: 17, hour: 21))!
    XCTAssertEqual(Freedom.startMonth(now: now, calendar: calendar), "2026-10")
  }

  @MainActor func testDemoSeedGivesAFreedomMonth() throws {
    let debts = try XCTUnwrap(try DataStore.loadSeed().debts)
    let plan = Freedom.simulate(debts: debts, from: "2026-01", extraPaise: 0, rollOver: false)
    XCTAssertNotNil(plan.freedomMonth)
    XCTAssertFalse(plan.payoffs.isEmpty)
    XCTAssertTrue(plan.unscheduled.contains { $0.emi == 0 })
  }

  private func payoffMonth(_ plan: FreedomPlan, _ id: String) -> String? {
    plan.payoffs.first { $0.id == id }?.month
  }

  private func debt(
    _ id: String, _ name: String, principal: Int64, outstanding: Int64, rate: Double, emi: Int64,
    kind: String = "personal_loan"
  ) -> Debt {
    Debt(
      id: id, name: name, kind: kind, lender: "Sample Lender", principal: principal,
      outstanding: outstanding, annualRatePct: rate, emi: emi, startDate: "2026-01-01",
      tenureMonths: 12, accountId: nil)
  }
}
