import XCTest
@testable import Lakshly

@MainActor final class BillRadarViewTests: XCTestCase {
  private var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Kolkata")!
    return calendar
  }

  private var now: Date {
    calendar.date(from: DateComponents(year: 2026, month: 10, day: 18, hour: 8))!
  }

  private func bill(_ id: String, days: Int, paid: Bool = false, muted: Bool = false) -> RadarBill {
    let due = calendar.date(byAdding: .day, value: days, to: now)!
    let parts = calendar.dateComponents([.year, .month, .day], from: due)
    return RadarBill(sourceId: id, kind: .card, name: "Demo bill",
      due: String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!),
      daysLeft: days, amount: 123456, paid: paid, muted: muted)
  }

  func testGroupingBoundariesAndPaidRows() {
    let input = [-1, 0, 1, 6, 7, 45, 46].map { bill("demo-\($0)", days: $0, paid: $0 == 0) }
    let groups = BillRadarSections.group(input)
    XCTAssertEqual(groups.map(\.title), ["Today", "This week", "Later"])
    XCTAssertEqual(groups.map { $0.bills.map(\.daysLeft) }, [[0], [1, 6], [7, 45]])
    XCTAssertTrue(groups[0].bills[0].paid)
    XCTAssertTrue(BillRadarSections.group([]).isEmpty)
  }

  func testOverviewSelectsEarliestThreeUnpaid() {
    let input = [bill("demo-paid", days: 0, paid: true), bill("demo-later", days: 20),
      bill("demo-three", days: 3), bill("demo-one", days: 1), bill("demo-two", days: 2)]
    XCTAssertEqual(BillRadarSections.upcoming(input).map(\.daysLeft), [1, 2, 3])
    XCTAssertTrue(BillRadarSections.upcoming([]).isEmpty)
  }

  func testLockedCopy() {
    XCTAssertEqual(BillRadarSections.lockedCopy(4), "4 more bills won’t alert you")
  }

  func testRequestIdentifiersPrivacyCategoryAndDates() {
    var state = BillRadarState()
    state.alertsOn = true
    state.leadDays = 3
    state.amountsInAlerts = true
    let item = bill("demo-one", days: 7)
    let requests = BillNotifications.requests(for: [item], state: state, limit: .unlimited,
      now: now, calendar: calendar)
    XCTAssertEqual(requests.count, 1)
    let request = requests[0]
    XCTAssertEqual(request.id, "lakshly.bill.\(item.id)")
    XCTAssertEqual(request.userInfo, ["url": "lakshly://bills", "billId": item.id])
    XCTAssertEqual(request.categoryIdentifier, "LAKSHLY_BILL")
    XCTAssertEqual(request.dateComponents.day, 22)
    XCTAssertEqual(request.dateComponents.hour, 9)
    XCTAssertFalse(request.body.contains(Money.format(123456)))
    let withAmounts = BillNotifications.requests(for: [item], state: state, limit: .unlimited,
      includeAmounts: true, now: now, calendar: calendar)
    XCTAssertTrue(withAmounts[0].body.contains(Money.format(123456)))
    state.amountsInAlerts = false
    XCTAssertFalse(BillNotifications.requests(for: [item], state: state, limit: .unlimited,
      includeAmounts: true, now: now, calendar: calendar)[0].body.contains(Money.format(123456)))
  }

  func testRequestCapTierAndOptOut() {
    var state = BillRadarState()
    state.alertsOn = true
    let bills = (0..<50).map { bill("demo-\($0)", days: 7) }
    XCTAssertEqual(BillNotifications.requests(for: bills, state: state, limit: .unlimited,
      now: now, calendar: calendar).count, 40)
    XCTAssertEqual(BillNotifications.requests(for: bills, state: state, limit: .count(3),
      now: now, calendar: calendar).count, 3)
    let excluded = [bill("demo-paid", days: 7, paid: true), bill("demo-muted", days: 7, muted: true)]
    XCTAssertTrue(BillNotifications.requests(for: excluded, state: state, limit: .unlimited,
      now: now, calendar: calendar).isEmpty)
    state.alertsOn = false
    XCTAssertTrue(BillNotifications.requests(for: bills, state: state, limit: .unlimited,
      now: now, calendar: calendar).isEmpty)
  }

  func testBillsDeepLinkDefersUntilUnlock() {
    let url = URL(string: "lakshly://bills")!
    XCTAssertEqual(GlanceLinks.effect(for: url, locked: false), .select("bills"))
    XCTAssertEqual(GlanceLinks.effect(for: url, locked: true), .deferUntilUnlock("bills"))
  }
}
