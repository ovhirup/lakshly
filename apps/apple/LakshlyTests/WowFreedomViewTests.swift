import XCTest
@testable import Lakshly

final class WowFreedomViewTests: XCTestCase {
  func testExtraSliderMaximumRoundsTwiceScheduledEmiUpToRupeeSteps() {
    XCTAssertEqual(Freedom.extraStepPaise, 50_000)
    XCTAssertEqual(Freedom.extraSliderMaximum(debts: []), 50_000)

    let quiet = debt("quiet", "Demo family loan", outstanding: 80_000, emi: 0)
    let closed = debt("closed", "Demo closed loan", outstanding: 0, emi: 40_000)
    XCTAssertEqual(Freedom.extraSliderMaximum(debts: [quiet, closed]), 50_000)

    let exact = debt("exact", "Demo personal loan", outstanding: 200_000, emi: 100_000)
    XCTAssertEqual(Freedom.extraSliderMaximum(debts: [exact]), 200_000)

    let tiny = debt("tiny", "Demo tiny loan", outstanding: 50_000, emi: 10_000)
    XCTAssertEqual(Freedom.extraSliderMaximum(debts: [tiny]), 50_000)

    let uneven = debt("uneven", "Sample uneven loan", outstanding: 90_000, emi: 30_000)
    XCTAssertEqual(Freedom.extraSliderMaximum(debts: [uneven]), 100_000)

    let first = debt("first", "Demo first loan", outstanding: 100_000, emi: 100_000)
    let second = debt("second", "Example second loan", outstanding: 80_000, emi: 50_000)
    XCTAssertEqual(Freedom.extraSliderMaximum(debts: [first, second, quiet]), 300_000)
  }

  private func debt(_ id: String, _ name: String, outstanding: Int64, emi: Int64) -> Debt {
    Debt(
      id: id, name: name, kind: "personal_loan", lender: "Sample Lender", principal: max(outstanding, 1),
      outstanding: outstanding, annualRatePct: 12, emi: emi, startDate: "2026-01-01",
      tenureMonths: 12, accountId: nil)
  }
}
