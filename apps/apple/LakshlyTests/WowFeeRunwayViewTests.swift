import XCTest
@testable import Lakshly

final class WowFeeRunwayViewTests: XCTestCase {
  func testDueLineUsesDayMonthAndDayCount() {
    XCTAssertEqual(FeeRunwayFormat.dueLine(due: "2026-02-12", daysLeft: 118), "due 12 Feb · 118 days")
    XCTAssertEqual(FeeRunwayFormat.dueLine(due: "2026-03-01", daysLeft: 1), "due 1 Mar · 1 day")
    XCTAssertEqual(FeeRunwayFormat.dueLine(due: "2026-12-31", daysLeft: 0), "due 31 Dec · today")
    XCTAssertEqual(FeeRunwayFormat.dueDateLabel("2026-02-12"), "12 Feb")
  }

  func testStatusTitles() {
    XCTAssertEqual(FeeRunwayFormat.statusTitle(.funded), "Funded ✓")
    XCTAssertEqual(FeeRunwayFormat.statusTitle(.onTrack), "On track")
    XCTAssertEqual(FeeRunwayFormat.statusTitle(.behind), "Behind")
  }

  func testHeadlineReadyLineAndPercent() {
    XCTAssertEqual(
      FeeRunwayFormat.headline(monthlyNeedPaise: 150_000),
      "Set aside \(Money.format(150_000)) a month")
    XCTAssertEqual(
      FeeRunwayFormat.readyLine(fundedPaise: 6_200, totalPaise: 10_000, fraction: 0.62),
      "\(Money.format(6_200)) of \(Money.format(10_000)) ready (62%)")
    XCTAssertEqual(FeeRunwayFormat.perMonthLine(334), "\(Money.format(334)) a month")
    XCTAssertEqual(FeeRunwayFormat.percent(0), 0)
    XCTAssertEqual(FeeRunwayFormat.percent(1), 100)
    XCTAssertEqual(FeeRunwayFormat.percent(0.625), 63)
    XCTAssertEqual(FeeRunwayFormat.percent(-0.2), 0)
    XCTAssertEqual(FeeRunwayFormat.percent(1.4), 100)
  }

  func testRupeeFieldAndPaiseParsing() {
    XCTAssertEqual(FeeRunwayFormat.rupeeField(150_000), "1500")
    XCTAssertEqual(FeeRunwayFormat.rupeeField(350), "3.50")
    XCTAssertEqual(FeeRunwayFormat.rupeeField(0), "")
    XCTAssertEqual(FeeRunwayFormat.paise(from: "1,500"), 150_000)
    XCTAssertEqual(FeeRunwayFormat.paise(from: "₹3.50"), 350)
    XCTAssertEqual(FeeRunwayFormat.paise(from: "3.5"), 350)
    XCTAssertEqual(FeeRunwayFormat.paise(from: "0"), nil)
    XCTAssertEqual(FeeRunwayFormat.paise(from: ""), nil)
    XCTAssertEqual(FeeRunwayFormat.paise(from: "12.345"), nil)
    XCTAssertEqual(FeeRunwayFormat.paise(from: "-5"), nil)
  }

  func testDayStringUsesTheCalendarDay() {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? calendar.timeZone
    let date = calendar.date(from: DateComponents(timeZone: calendar.timeZone, year: 2026, month: 2, day: 12, hour: 12))
    XCTAssertEqual(date.map { FeeRunwayFormat.dayString($0, calendar: calendar) }, "2026-02-12")
  }
}
