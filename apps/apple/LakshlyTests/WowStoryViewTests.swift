import XCTest
@testable import Lakshly

final class WowStoryViewTests: XCTestCase {
  private let months = ["2026-07", "2026-08", "2026-09"]

  func testFreeOpensOnlyTheLatestMonth() {
    XCTAssertEqual(StoryMonths.openMonths(months, tier: .free), ["2026-09"])
    XCTAssertTrue(StoryMonths.isOpen("2026-09", months: months, tier: .free))
    XCTAssertFalse(StoryMonths.isOpen("2026-08", months: months, tier: .free))
    XCTAssertFalse(StoryMonths.isOpen("2026-07", months: months, tier: .free))
  }

  func testShareOpensEarlierMonths() {
    XCTAssertEqual(StoryMonths.openMonths(months, tier: .premium), months)
    XCTAssertTrue(StoryMonths.isOpen("2026-07", months: months, tier: .premium))
    XCTAssertEqual(StoryMonths.openMonths(months, tier: .superUser), months)
  }

  func testASingleMonthStaysOpenForFree() {
    XCTAssertEqual(StoryMonths.openMonths(["2026-09"], tier: .free), ["2026-09"])
  }

  func testEmptyOrUnknownMonthsStayClosed() {
    XCTAssertTrue(StoryMonths.openMonths([], tier: .premium).isEmpty)
    XCTAssertFalse(StoryMonths.isOpen("2026-01", months: months, tier: .premium))
    XCTAssertFalse(StoryMonths.isOpen("2026-09", months: [], tier: .free))
  }
}
