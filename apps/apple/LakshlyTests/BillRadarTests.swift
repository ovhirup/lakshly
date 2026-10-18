import XCTest
@testable import Lakshly

final class BillRadarTests: XCTestCase {
  private var calendar: Calendar {
    var value = Calendar(identifier: .gregorian)
    value.timeZone = TimeZone(identifier: "Asia/Kolkata")!
    return value
  }

  private func date(_ text: String) -> Date {
    ISO8601DateFormatter().date(from: text)!
  }

  private var now: Date { date("2026-03-28T19:00:00+05:30") }

  private func row(
    _ due: String = "2026-04-03", kind: BillKind = .card, name: String = "Demo card",
    paid: Bool = false, muted: Bool = false, amount: Int64? = 10000
  ) -> RadarBill {
    RadarBill(sourceId: "demo", kind: kind, name: name, due: due, daysLeft: 6,
      amount: amount, paid: paid, muted: muted)
  }

  private func build(
    accounts: [Account] = [], debts: [Debt] = [], sips: [SIP] = [], fees: [WowFee] = [],
    subscriptions: [SubscriptionItem] = [], planned: Set<String> = [], state: BillRadarState = BillRadarState(),
    at: Date? = nil
  ) -> [RadarBill] {
    BillRadar.build(accounts: accounts, debts: debts, sips: sips, fees: fees,
      subscriptions: subscriptions, plannedCancels: planned, state: state, now: at ?? now, calendar: calendar)
  }

  private func card(_ id: String = "demo", name: String = "Demo card", day: Int? = 31, balance: Int64 = -10000) -> Account {
    Account(id: id, name: name, type: "credit_card", institution: "Demo", mask: nil, currency: "INR",
      balance: balance, invested: nil, creditLimit: nil, statementDay: nil, dueDay: day, asOf: "2026-03-28", source: nil)
  }

  private func subscription(_ cadence: SubscriptionCadence, next: String) -> SubscriptionItem {
    SubscriptionItem(id: "demo-service", name: "Demo service", kind: "other", charges: 2,
      lastDate: "2026-01-01", lastPaise: 10000, typicalPaise: 10000, cadence: cadence,
      monthlyPaise: 10000, yearlyPaise: 120000, nextDate: next, flags: [], verdict: "Keep")
  }

  func testMonthEndClampAndZeroBalanceRules() {
    let feb = date("2026-02-28T19:00:00+05:30")
    let bills = build(accounts: [card()], at: feb)
    XCTAssertEqual(bills.first?.due, "2026-02-28")
    XCTAssertEqual(bills.first?.daysLeft, 0)
    XCTAssertEqual(build(accounts: [card()], at: date("2026-04-01T19:00:00+05:30")).first?.due, "2026-04-30")
    XCTAssertTrue(build(accounts: [card(day: nil, balance: 0)]).isEmpty)
    XCTAssertEqual(build(accounts: [card(day: nil)]).first?.due, "2026-04-01")
    XCTAssertEqual(build(accounts: [card(balance: .min)]).first?.amount, Int64.max)
    XCTAssertEqual(build(accounts: [card(day: 31, balance: 0)]).first?.amount, 0)
  }

  func testYearlyFeeAndHorizon() {
    let fees = [
      WowFee(id: "demo-yearly", name: "Demo LIC policy", amount: 10000, due: "2025-04-02", yearly: true),
      WowFee(id: "sample-old", name: "Sample old fee", amount: 20000, due: "2025-04-02", yearly: false),
      WowFee(id: "sample-edge", name: "Sample boundary", amount: 30000, due: "2026-05-12", yearly: false),
      WowFee(id: "sample-out", name: "Sample outside", amount: 40000, due: "2026-05-13", yearly: false)
    ]
    let bills = build(fees: fees)
    XCTAssertEqual(bills.map(\.sourceId), ["demo-yearly", "sample-edge"])
    XCTAssertEqual(bills.map(\.daysLeft), [5, 45])
    XCTAssertEqual(bills.first?.kind, .insurance)
    XCTAssertEqual(bills.first?.due, "2026-04-02")
  }

  func testSortTieBreakAndPaidMutedSummary() {
    let cards = [card("demo-z", name: "Demo Z"), card("demo-a", name: "Demo A")]
    let fee = WowFee(id: "sample-fee", name: "Sample fee", amount: 5000, due: "2026-03-31", yearly: false)
    let state = BillRadarState(paid: ["card:demo-a:2026-03-31"], muted: ["card:demo-z"])
    let bills = build(accounts: cards, fees: [fee], state: state)
    XCTAssertEqual(bills.map(\.sourceId), ["demo-a", "demo-z", "sample-fee"])
    XCTAssertTrue(bills[0].paid)
    XCTAssertTrue(bills[1].muted)
    XCTAssertEqual(BillRadar.summary(bills), .init(dueThisWeek: 2, dueThisWeekPaise: 15000, next: bills[1]))
    XCTAssertEqual(BillRadar.summary([]), .init(dueThisWeek: 0, dueThisWeekPaise: 0, next: nil))
  }

  func testSubscriptionCadencesAndExclusions() {
    let cases: [(SubscriptionCadence, String, String)] = [
      (.weekly, "2026-03-14", "2026-03-28"),
      (.monthly, "2026-01-31", "2026-03-31"),
      (.quarterly, "2025-12-31", "2026-03-31"),
      (.yearly, "2025-04-02", "2026-04-02")
    ]
    for (cadence, next, expected) in cases {
      XCTAssertEqual(build(subscriptions: [subscription(cadence, next: next)]).first?.due, expected)
    }
    let active = subscription(.monthly, next: "2026-03-29")
    var lapsed = active
    lapsed.flags = [.lapsed("1 Jan")]
    XCTAssertTrue(build(subscriptions: [lapsed]).isEmpty)
    XCTAssertTrue(build(subscriptions: [active], planned: [active.id]).isEmpty)
    XCTAssertTrue(build(subscriptions: [subscription(.irregular, next: "2026-03-01")]).isEmpty)
    var missing = active
    missing.nextDate = nil
    XCTAssertTrue(build(subscriptions: [missing]).isEmpty)
  }

  func testAllKindRanksAndInactiveSources() {
    let debt = Debt(id: "demo-debt", name: "Demo loan", kind: "personal", lender: nil,
      principal: 100000, outstanding: 50000, annualRatePct: 0, emi: 10000,
      startDate: "2025-01-31", tenureMonths: 10, accountId: nil)
    let cleared = Debt(id: "demo-cleared", name: "Demo cleared loan", kind: "personal", lender: nil,
      principal: 100000, outstanding: 0, annualRatePct: 0, emi: 10000,
      startDate: "2025-01-31", tenureMonths: 10, accountId: nil)
    let sip = SIP(id: "demo-fund", scheme: "Demo fund", platform: nil, amount: 10000,
      dayOfMonth: 31, startDate: "2025-01-31", stepUpPctYearly: nil, status: "active", accountId: nil)
    let fees = [
      WowFee(id: "demo-policy", name: "Demo term plan", amount: 10000, due: "2026-03-31", yearly: true),
      WowFee(id: "sample-renewal", name: "Sample renewal", amount: 10000, due: "2026-03-31", yearly: true)
    ]
    let bills = build(accounts: [card()], debts: [debt, cleared], sips: [sip], fees: fees,
      subscriptions: [subscription(.monthly, next: "2026-03-31")])
    XCTAssertEqual(bills.map(\.kind), BillKind.allCases)
    XCTAssertEqual(bills.map(\.daysLeft), Array(repeating: 3, count: 6))
    let feb = build(debts: [debt], sips: [sip], at: date("2026-02-28T19:00:00+05:30"))
    XCTAssertEqual(feb.map(\.due), ["2026-02-28", "2026-02-28"])
    XCTAssertEqual(BillKind.allCases.map(\.title), ["Card bill", "EMI", "Insurance", "Fee", "Subscription", "SIP"])
    XCTAssertEqual(BillKind.allCases.map(\.symbol), ["creditcard", "building.columns", "shield.lefthalf.filled",
      "calendar.badge.clock", "repeat", "chart.line.uptrend.xyaxis"])
  }

  func testAlertLimitsOffAndPaidMuted() {
    let bills = (1...5).map { row(name: "Demo \($0)") }
    let state = BillRadarState(alertsOn: true)
    let free = BillRadar.alerts(bills, state: state, limit: .count(3), includeAmounts: false, now: now, calendar: calendar)
    XCTAssertEqual(free.alerts.count, 3)
    XCTAssertEqual(free.lockedCount, 2)
    let all = BillRadar.alerts(bills, state: state, limit: .unlimited, includeAmounts: false, now: now, calendar: calendar)
    XCTAssertEqual(all.alerts.count, 5)
    XCTAssertEqual(all.lockedCount, 0)
    let off = BillRadar.alerts(bills, state: BillRadarState(), limit: .count(3), includeAmounts: true, now: now, calendar: calendar)
    XCTAssertTrue(off.alerts.isEmpty)
    XCTAssertEqual(off.lockedCount, 0)
    let excluded = BillRadar.alerts([row(paid: true), row(muted: true)], state: state,
      limit: .count(0), includeAmounts: true, now: now, calendar: calendar)
    XCTAssertTrue(excluded.alerts.isEmpty)
    XCTAssertEqual(excluded.lockedCount, 0)
  }

  func testLeadDaysAndAmountsRequireBothPreferences() {
    for lead in [1, 3, 7] {
      let state = BillRadarState(leadDays: lead, alertsOn: true)
      let bill = row("2026-04-10")
      let result = BillRadar.alerts([bill], state: state, limit: .unlimited, includeAmounts: true, now: now, calendar: calendar)
      XCTAssertEqual(result.alerts.first?.fireAt, date(String(format: "2026-04-%02dT09:00:00+05:30", 10 - lead)))
      XCTAssertEqual(result.alerts.first?.title, "Card bill \(BillRadar.dueText(lead).lowercased())")
      XCTAssertEqual(result.alerts.first?.body, "Demo card · 10 Apr")
    }
    let state = BillRadarState(alertsOn: true, amountsInAlerts: true)
    for include in [false, true] {
      let result = BillRadar.alerts([row()], state: state, limit: .unlimited, includeAmounts: include, now: now, calendar: calendar)
      XCTAssertEqual(result.alerts.first?.body, "Demo card · 3 Apr" + (include ? " · \(Money.format(10000))" : ""))
    }
    let nilAmount = BillRadar.alerts([row(amount: nil)], state: state, limit: .unlimited,
      includeAmounts: true, now: now, calendar: calendar)
    XCTAssertEqual(nilAmount.alerts.first?.body, "Demo card · 3 Apr")
  }

  func testPastFireRulesAndDueText() {
    let state = BillRadarState(alertsOn: true)
    let result = BillRadar.alerts([row("2026-03-28"), row("2026-03-29"), row("2026-03-27")],
      state: state, limit: .unlimited, includeAmounts: false, now: now, calendar: calendar)
    XCTAssertEqual(result.alerts.map(\.fireAt), [now.addingTimeInterval(60), date("2026-03-29T09:00:00+05:30")])
    XCTAssertEqual(result.alerts.map(\.title), ["Card bill due today", "Card bill due today"])
    let early = date("2026-03-28T08:00:00+05:30")
    XCTAssertEqual(BillRadar.alerts([row("2026-03-28")], state: state, limit: .unlimited,
      includeAmounts: false, now: early, calendar: calendar).alerts.first?.fireAt, date("2026-03-28T09:00:00+05:30"))
    XCTAssertEqual(BillRadar.dueText(0), "Due today")
    XCTAssertEqual(BillRadar.dueText(1), "Due tomorrow")
    XCTAssertEqual(BillRadar.dueText(7), "Due in 7 days")
  }

  func testNotificationNamesOmitAccountNumbers() {
    let state = BillRadarState(alertsOn: true)
    for name in ["Demo card 1234567890", "Demo card 1234 5678 9012", "Demo card 1234-5678-9012", "Demo card 9012"] {
      let result = BillRadar.alerts([row(name: name)], state: state, limit: .unlimited,
        includeAmounts: false, now: now, calendar: calendar)
      XCTAssertEqual(result.alerts.first?.body, "Demo card · 3 Apr")
    }
  }

  func testDefensiveStateDecodeRetentionAndWowRoundTrip() throws {
    for text in ["{}", "null", "[]", #"{"paid":7,"muted":false,"leadDays":2,"alertsOn":"yes","amountsInAlerts":1}"#] {
      XCTAssertEqual(try JSONDecoder().decode(BillRadarState.self, from: Data(text.utf8)), BillRadarState())
    }
    let ids = (0...200).map { String(format: "card:demo-%03d:2026-04-01", $0) }
    let state = BillRadarState(paid: ids + ["card:demo-old:2025-01-01", ids[0]],
      muted: ["card:demo-z", "card:demo-a", "card:demo-z"], leadDays: 99, alertsOn: true)
    XCTAssertEqual(state.paid.count, 200)
    XCTAssertFalse(state.paid.contains("card:demo-old:2025-01-01"))
    XCTAssertEqual(state.paid, state.paid.sorted())
    XCTAssertEqual(state.muted, ["card:demo-a", "card:demo-z"])
    XCTAssertEqual(state.leadDays, 3)
    let wow = WowState(bills: state)
    XCTAssertEqual(try JSONDecoder().decode(WowState.self, from: JSONEncoder().encode(wow)), wow)
    XCTAssertEqual(try JSONDecoder().decode(WowState.self, from: Data(#"{"bills":42}"#.utf8)).bills, BillRadarState())
  }

  private struct Fixture: Decodable {
    var now: String
    var timezone: String
    var accounts: [Account]
    var debts: [Debt]
    var sips: [SIP]
    var fees: [WowFee]
    var subscriptions: [FixtureSubscription]
    var plannedCancels: [String]
    var state: BillRadarState
    var expected: Expected
  }

  private struct FixtureSubscription: Decodable {
    var id: String
    var name: String
    var amount: Int64
    var nextDate: String
    var cadence: String
    var lapsed: Bool
  }

  private struct Expected: Decodable {
    struct Bill: Decodable {
      var id: String
      var daysLeft: Int
      var kind: BillKind
      var amount: Int64
      var paid: Bool
      var muted: Bool
    }
    struct Summary: Decodable {
      var dueThisWeek: Int
      var dueThisWeekPaise: Int64
      var next: String
    }
    struct Alert: Decodable {
      var id: String
      var billId: String
      var fireAt: String
      var title: String
      var body: String
    }
    struct Limit: Decodable {
      var alertIds: [String]
      var lockedCount: Int
    }
    var bills: [Bill]
    var summary: Summary
    var alerts: [Alert]
    var limit3: Limit
    var unlimited: Limit
  }

  func testGoldenFixture() throws {
    let root = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let url = root.appendingPathComponent("packages/shared/fixtures/bill-radar.json")
    guard let data = try? Data(contentsOf: url) else { throw XCTSkip("Shared bill radar fixture is unreachable") }
    let fixture = try JSONDecoder().decode(Fixture.self, from: data)
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = try XCTUnwrap(TimeZone(identifier: fixture.timezone))
    let at = date(fixture.now)
    let subscriptions = fixture.subscriptions.map { input in
      var item = subscription(SubscriptionCadence(rawValue: input.cadence)!, next: input.nextDate)
      item.id = input.id
      item.name = input.name
      item.lastPaise = input.amount
      item.typicalPaise = input.amount
      item.flags = input.lapsed ? [.lapsed("1 Jan")] : []
      return item
    }
    let bills = BillRadar.build(accounts: fixture.accounts, debts: fixture.debts, sips: fixture.sips,
      fees: fixture.fees, subscriptions: subscriptions, plannedCancels: Set(fixture.plannedCancels),
      state: fixture.state, now: at, calendar: cal)
    XCTAssertEqual(bills.map(\.id), fixture.expected.bills.map(\.id))
    for (actual, expected) in zip(bills, fixture.expected.bills) {
      XCTAssertEqual(actual.daysLeft, expected.daysLeft)
      XCTAssertEqual(actual.kind, expected.kind)
      XCTAssertEqual(actual.amount, expected.amount)
      XCTAssertEqual(actual.paid, expected.paid)
      XCTAssertEqual(actual.muted, expected.muted)
    }
    let summary = BillRadar.summary(bills)
    XCTAssertEqual(summary.dueThisWeek, fixture.expected.summary.dueThisWeek)
    XCTAssertEqual(summary.dueThisWeekPaise, fixture.expected.summary.dueThisWeekPaise)
    XCTAssertEqual(summary.next?.id, fixture.expected.summary.next)
    for (limit, expected) in [(FeatureLimit.count(3), fixture.expected.limit3), (.unlimited, fixture.expected.unlimited)] {
      let result = BillRadar.alerts(bills, state: fixture.state, limit: limit, includeAmounts: true, now: at, calendar: cal)
      XCTAssertEqual(result.lockedCount, expected.lockedCount)
      XCTAssertEqual(result.alerts.map(\.id), expected.alertIds)
      for actual in result.alerts {
        let wanted = try XCTUnwrap(fixture.expected.alerts.first { $0.id == actual.id })
        XCTAssertEqual(actual.billId, wanted.billId)
        XCTAssertEqual(actual.fireAt, date(wanted.fireAt))
        XCTAssertEqual(actual.title, wanted.title)
        XCTAssertEqual(actual.body, wanted.body)
      }
    }
  }
}
