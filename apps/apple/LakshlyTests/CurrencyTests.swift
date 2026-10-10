import XCTest
@testable import Lakshly

/// Mirrors apps/web/tests/currency.test.ts for the generated currency table and the minor-unit helpers.
final class CurrencyTests: XCTestCase {
  func testTableCoversExactlyInrAndUsd() {
    XCTAssertEqual(CurrencyCode.allCases.map(\.rawValue), ["INR", "USD"])
    XCTAssertNil(CurrencyCode(rawValue: "JPY"))
  }

  func testInrRowsEqualTodaysHardCodedConstants() {
    let m = CurrencyCode.inr.info.magnitude
    XCTAssertEqual(CurrencyCode.inr.info.symbol, "₹")
    XCTAssertEqual(CurrencyCode.inr.info.compactUnits.map(\.suffix), ["Cr", "L", "K"])
    XCTAssertEqual(CurrencyCode.inr.info.compactUnits.map(\.thresholdMajor), [10_000_000, 100_000, 1_000])
    XCTAssertEqual(m.minBudgetLine, 50_000)
    XCTAssertEqual(m.budgetStepSmall, 10_000)
    XCTAssertEqual(m.budgetStepLarge, 50_000)
    XCTAssertEqual(m.budgetStepThreshold, 500_000)
    XCTAssertEqual(m.glanceRounding, 100)
    XCTAssertEqual(m.starterBudgets.map(\.category), ["groceries", "dining", "transport", "shopping"])
    XCTAssertEqual(m.starterBudgets.map(\.amount), [600_000, 300_000, 200_000, 300_000])
  }

  func testMinimumsSitOnTheRoundingGrid() {
    for code in CurrencyCode.allCases {
      let m = code.info.magnitude
      XCTAssertEqual(m.minBudgetLine % m.budgetStepSmall, 0, code.rawValue)
      XCTAssertEqual(m.goalMonthlyMinimum % m.budgetStepSmall, 0, code.rawValue)
    }
  }

  func testUsdKeepsInrRatios() {
    let i = CurrencyCode.inr.info.magnitude
    let u = CurrencyCode.usd.info.magnitude
    XCTAssertEqual(u.budgetStepLarge / u.budgetStepSmall, i.budgetStepLarge / i.budgetStepSmall)
    XCTAssertEqual(u.budgetStepThreshold / u.budgetStepSmall, i.budgetStepThreshold / i.budgetStepSmall)
    XCTAssertEqual(CurrencyCode.usd.info.compactUnits.map(\.suffix), ["B", "M", "K"])
  }

  func testToMinorParsesDecimalTextExactly() throws {
    XCTAssertEqual(try CurrencyCode.inr.toMinor("19.99"), 1999)
    XCTAssertEqual(try CurrencyCode.usd.toMinor("1234.5"), 123_450)
    XCTAssertEqual(try CurrencyCode.usd.toMinor("0.07"), 7)
    XCTAssertEqual(try CurrencyCode.usd.toMinor("-12.30"), -1230)
    XCTAssertEqual(try CurrencyCode.inr.toMinor("+5"), 500)
    XCTAssertEqual(try CurrencyCode.inr.toMinor("  42 "), 4200)
    XCTAssertEqual(try CurrencyCode.inr.toMinor("42\n"), 4200)
    XCTAssertEqual(try CurrencyCode.inr.toMinor("-0"), 0)
  }

  func testToMinorTrailingZerosOkButRealExtraPrecisionRejected() throws {
    XCTAssertEqual(try CurrencyCode.usd.toMinor("1.500"), 150)
    XCTAssertThrowsError(try CurrencyCode.usd.toMinor("1.505")) { XCTAssertEqual($0 as? CurrencyError, .tooManyDecimals("1.505")) }
  }

  func testToMinorRejectsNonAmounts() {
    for bad in ["", "abc", "1,234", "1.2.3", "₹5", ".5", "5.", "NaN", "5\u{301}", "٣"] {
      XCTAssertThrowsError(try CurrencyCode.inr.toMinor(bad), bad)
    }
    XCTAssertThrowsError(try CurrencyCode.inr.toMinor("99999999999999999999")) { XCTAssertEqual($0 as? CurrencyError, .outOfRange("99999999999999999999")) }
  }

  func testDecimalAndRoundTrip() throws {
    XCTAssertEqual(CurrencyCode.inr.minorFactor, 100)
    XCTAssertEqual(try CurrencyCode.usd.toMinor(Decimal(string: "19.99")!), 1999)
    XCTAssertEqual(CurrencyCode.usd.fromMinor(1999), Decimal(string: "19.99")!)
    for minor: Int64 in [0, 1, 99, 100, 123_456_789, -5] {
      XCTAssertEqual(try CurrencyCode.usd.toMinor(CurrencyCode.usd.fromMinor(minor)), minor)
    }
  }
}
