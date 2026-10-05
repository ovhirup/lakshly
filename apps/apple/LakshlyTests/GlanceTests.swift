import XCTest

@testable import Lakshly

final class GlanceTests: XCTestCase {
  private var utc: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    return calendar
  }

  private func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 12) -> Date {
    utc.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
  }

  private func sample() throws -> Dataset {
    let url = try XCTUnwrap(Bundle.main.url(forResource: "sample.synthetic", withExtension: "json"))
    return try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: url))
  }

  func testBudgetPaceUsesSpendThroughToday() throws {
    let snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 10), includeAmounts: true, tier: .premium, calendar: utc)
    XCTAssertEqual(snapshot.budget.monthSpendPercent, 1_344_900.0 / 2_650_000.0 * 100, accuracy: 0.001)
    XCTAssertEqual(snapshot.budget.monthElapsedPercent, 10.0 / 30.0 * 100, accuracy: 0.001)
    XCTAssertEqual(snapshot.budget.status, .over)
    XCTAssertEqual(snapshot.budget.safeToSpendPerDay, 62_147)
    // Personal loan plus the zero-EMI family loan. A zero EMI is still debt, but it is not a bill.
    let principal = 31_000_000.0
    let outstanding = 19_100_000.0
    XCTAssertEqual(snapshot.debtRepaidPercent, (principal - outstanding) / principal * 100, accuracy: 0.001)
    XCTAssertEqual(snapshot.netWorth, 56_153_800)
    XCTAssertEqual(snapshot.debtOutstanding, 19_100_000)
    XCTAssertEqual(snapshot.netWorthTrend, .down)
    XCTAssertEqual(snapshot.tier, .premium)
    XCTAssertEqual(snapshot.version, GlanceSnapshot.currentVersion)
  }

  func testNextBillOnTheTenthIsTheCard() throws {
    let snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 10), includeAmounts: true, tier: .free, calendar: utc)
    let bill = try XCTUnwrap(snapshot.nextBill)
    XCTAssertEqual(bill.name, "Rewards Card")
    XCTAssertEqual(bill.kind, .card)
    XCTAssertEqual(bill.amount, 1_385_900)
    XCTAssertEqual(bill.dueDate, utc.startOfDay(for: date(2026, 9, 25)))
    XCTAssertEqual(snapshot.tier, .free)
  }

  func testNextBillRollsToTheFollowingMonthEMI() throws {
    let snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 26), includeAmounts: true, tier: .free, calendar: utc)
    let bill = try XCTUnwrap(snapshot.nextBill)
    XCTAssertEqual(bill.name, "Personal Loan")
    XCTAssertEqual(bill.kind, .emi)
    XCTAssertEqual(bill.amount, 850_000)
    XCTAssertEqual(bill.dueDate, utc.startOfDay(for: date(2026, 10, 5)))
  }

  func testDueDayThirtyOneClampsInFebruary() {
    let card = Account(
      id: "card", name: "Rewards Card", type: "credit_card", institution: "Sample Card Co", mask: nil,
      currency: "INR", balance: -2_000, invested: nil, creditLimit: nil, statementDay: nil, dueDay: 31,
      asOf: "2026-02-01", source: nil)
    let snapshot = GlanceBuilder.build(
      dataset: makeDataset(accounts: [card]), now: date(2026, 2, 1), includeAmounts: true, tier: .free, calendar: utc)
    XCTAssertEqual(snapshot.nextBill?.dueDate, utc.startOfDay(for: date(2026, 2, 28)))
  }

  func testMissingDueDayFallsBackToTheFirstAndInactiveSIPsAreSkipped() {
    let card = Account(
      id: "card", name: "Rewards Card", type: "credit_card", institution: "Sample Card Co", mask: nil,
      currency: "INR", balance: -500, invested: nil, creditLimit: nil, statementDay: nil, dueDay: nil,
      asOf: "2026-09-10", source: nil)
    let paused = SIP(
      id: "sip", scheme: "Paused Fund", platform: nil, amount: 100, dayOfMonth: 10, startDate: "2026-01-10",
      stepUpPctYearly: nil, status: "paused", accountId: nil)
    let snapshot = GlanceBuilder.build(
      dataset: makeDataset(accounts: [card], sips: [paused]), now: date(2026, 9, 10),
      includeAmounts: true, tier: .free, calendar: utc)
    XCTAssertEqual(snapshot.nextBill?.kind, .card)
    XCTAssertEqual(snapshot.nextBill?.dueDate, utc.startOfDay(for: date(2026, 10, 1)))
  }

  func testSameDayCardBeatsEMI() {
    let card = Account(
      id: "card", name: "Rewards Card", type: "credit_card", institution: "Sample Card Co", mask: nil,
      currency: "INR", balance: -500, invested: nil, creditLimit: nil, statementDay: nil, dueDay: 10,
      asOf: "2026-09-10", source: nil)
    let debt = Debt(
      id: "debt", name: "Personal Loan", kind: "personal", lender: nil, principal: 1_000, outstanding: 800,
      annualRatePct: 10, emi: 100, startDate: "2026-01-10", tenureMonths: 12, accountId: nil)
    let snapshot = GlanceBuilder.build(
      dataset: makeDataset(accounts: [card], debts: [debt]), now: date(2026, 9, 9),
      includeAmounts: false, tier: .free, calendar: utc)
    XCTAssertEqual(snapshot.nextBill?.kind, .card)
    XCTAssertNil(snapshot.nextBill?.amount)
  }

  func testAmountsAreOmittedWhenDisabled() throws {
    let snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 10), includeAmounts: false, tier: .premium, calendar: utc)
    XCTAssertNil(snapshot.budget.safeToSpendPerDay)
    XCTAssertNil(snapshot.nextBill?.amount)
    XCTAssertNil(snapshot.netWorth)
    XCTAssertNil(snapshot.debtOutstanding)
    XCTAssertGreaterThan(snapshot.budget.monthSpendPercent, 0)
    XCTAssertEqual(snapshot.omittingAmounts().netWorth, nil)
  }

  func testPaceBands() {
    XCTAssertEqual(pace(spend: 10, elapsed: 50, limit: 100), .ahead)
    XCTAssertEqual(pace(spend: 40, elapsed: 42, limit: 100), .onTrack)
    XCTAssertEqual(pace(spend: 110, elapsed: 50, limit: 100), .over)
    XCTAssertEqual(pace(spend: 0, elapsed: 50, limit: 0), .onTrack)
  }

  func testSnapshotRoundTripAndMissingVersion() throws {
    let snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 10), includeAmounts: true, tier: .premium,
      themeID: "monochromeGold", appearance: "dark", calendar: utc)
    let data = try GlanceCoding.encoder().encode(snapshot)
    let decoded = try GlanceCoding.decoder().decode(GlanceSnapshot.self, from: data)
    XCTAssertEqual(decoded, snapshot)

    var object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    object.removeValue(forKey: "version")
    let stripped = try JSONSerialization.data(withJSONObject: object)
    let legacy = try GlanceCoding.decoder().decode(GlanceSnapshot.self, from: stripped)
    XCTAssertEqual(legacy.version, 1)
    XCTAssertEqual(legacy.themeID, "monochromeGold")
    XCTAssertEqual(legacy.appearance, .dark)
    XCTAssertEqual(legacy.netWorth, snapshot.netWorth)
  }

  func testStoreOmitsAmountsWhenThePreferenceIsOff() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    let domain = "app.lakshly.glance-test.\(UUID().uuidString)"
    let preferences = try XCTUnwrap(UserDefaults(suiteName: domain))
    defer {
      preferences.removePersistentDomain(forName: domain)
      try? FileManager.default.removeItem(at: directory)
    }
    XCTAssertTrue(GlancePreferences.showAmounts(in: preferences))
    XCTAssertFalse(GlancePreferences.lockScreenAmounts(in: preferences))
    XCTAssertTrue(GlancePreferences.liveActivities(in: preferences))
    XCTAssertTrue(GlancePreferences.menuBarExtra(in: preferences))

    let snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 10), includeAmounts: true, tier: .premium, calendar: utc)
    preferences.set(false, forKey: GlancePreferences.showAmountsKey)
    try GlanceStore.write(snapshot, directory: directory, preferences: preferences)
    let stored = try Data(contentsOf: directory.appendingPathComponent(GlanceStore.fileName))
    let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: stored) as? [String: Any])
    XCTAssertNil(json["netWorth"])
    XCTAssertNil(json["debtOutstanding"])
    let readBack = try XCTUnwrap(GlanceStore.read(directory: directory, preferences: preferences))
    XCTAssertNil(readBack.netWorth)
    XCTAssertNil(readBack.budget.safeToSpendPerDay)

    preferences.set(true, forKey: GlancePreferences.showAmountsKey)
    try GlanceStore.write(snapshot, directory: directory, preferences: preferences)
    let withAmounts = try XCTUnwrap(GlanceStore.read(directory: directory, preferences: preferences))
    XCTAssertEqual(withAmounts.netWorth, snapshot.netWorth)
  }

  func testGroupIdentifierRejectsPlaceholders() {
    XCTAssertEqual(GlanceStore.normalizedGroupID("group.app.lakshly.shared"), "group.app.lakshly.shared")
    XCTAssertNil(GlanceStore.normalizedGroupID("$(LAKSHLY_APP_GROUP)"))
    XCTAssertNil(GlanceStore.normalizedGroupID("  "))
    XCTAssertNil(GlanceStore.normalizedGroupID("app.lakshly.shared"))
    XCTAssertNil(GlanceStore.normalizedGroupID("group.app.lakshly.shared extra"))
  }

  func testBillDueTodayBeatsTheBudgetAlert() throws {
    var snapshot = try paced(percent: 95)
    snapshot.nextBill = GlanceBill(name: "Rewards Card", dueDate: date(2026, 9, 10), kind: .card, amount: 100)
    let plan = LiveActivityPlanner.select(
      snapshot: snapshot, now: date(2026, 9, 10), calendar: utc, budgetAlertMonth: nil)
    let selected = try XCTUnwrap(plan)
    XCTAssertEqual(selected.kind, .bill)
    XCTAssertEqual(selected.title, "Rewards Card")
    XCTAssertEqual(selected.subtitle, "Due today")
    XCTAssertNil(selected.budgetAlertMonth)
    XCTAssertEqual(selected.endOfDay, utc.startOfDay(for: date(2026, 9, 11, 0)))
  }

  func testBudgetAlertStartsOncePerMonth() throws {
    let snapshot = try paced(percent: 80)
    let now = date(2026, 9, 10)
    let first = try XCTUnwrap(LiveActivityPlanner.select(snapshot: snapshot, now: now, calendar: utc))
    XCTAssertEqual(first.kind, .budget)
    XCTAssertEqual(first.budgetAlertMonth, "2026-09")
    XCTAssertEqual(first.subtitle, "Over 80% of this month")

    XCTAssertNil(LiveActivityPlanner.select(
      snapshot: snapshot, now: now, calendar: utc, budgetAlertMonth: "2026-09", budgetActivityRunningToday: false))

    let refresh = try XCTUnwrap(LiveActivityPlanner.select(
      snapshot: snapshot, now: now, calendar: utc, budgetAlertMonth: "2026-09", budgetActivityRunningToday: true))
    XCTAssertEqual(refresh.kind, .budget)
    XCTAssertNil(refresh.budgetAlertMonth)

    let nextMonth = try XCTUnwrap(LiveActivityPlanner.select(
      snapshot: snapshot, now: date(2026, 10, 2), calendar: utc, budgetAlertMonth: "2026-09"))
    XCTAssertEqual(nextMonth.budgetAlertMonth, "2026-10")
  }

  func testPlannerIsNilBelowTheThreshold() throws {
    let snapshot = try paced(percent: 79.9)
    XCTAssertNil(LiveActivityPlanner.select(snapshot: snapshot, now: date(2026, 9, 10), calendar: utc))
  }

  func testWidgetGating() {
    for kind in [GlanceWidgetKind.budgetPace, .upcomingBill] {
      XCTAssertTrue(GlanceWidgetAccess.allows(kind, tier: .free))
      XCTAssertTrue(GlanceWidgetAccess.allows(kind, tier: .premium))
    }
    for kind in [GlanceWidgetKind.netWorth, .debt] {
      XCTAssertFalse(GlanceWidgetAccess.allows(kind, tier: .free))
      XCTAssertTrue(GlanceWidgetAccess.allows(kind, tier: .premium))
    }
  }

  func testLockScreenAmountPolicy() {
    XCTAssertEqual(
      GlanceAmounts.display(100, surface: .home, showAmounts: true, lockScreenAmounts: false).text,
      Money.format(100))
    XCTAssertEqual(
      GlanceAmounts.display(100, surface: .home, showAmounts: false, lockScreenAmounts: true).text,
      "••••")
    XCTAssertEqual(
      GlanceAmounts.display(100, surface: .lockScreen, showAmounts: true, lockScreenAmounts: false).text,
      "••••")
    XCTAssertEqual(
      GlanceAmounts.display(100, surface: .lockScreen, showAmounts: true, lockScreenAmounts: true).text,
      Money.format(100))
    XCTAssertEqual(
      GlanceAmounts.display(nil, surface: .home, showAmounts: true, lockScreenAmounts: true).text,
      "••••")
    XCTAssertTrue(GlanceAmounts.display(100, surface: .home, showAmounts: true, lockScreenAmounts: false).isPrivate)
  }

  func testDeepLinksDeferWhileLocked() throws {
    let budget = try XCTUnwrap(URL(string: "lakshly://budget"))
    XCTAssertEqual(GlanceLinks.tab(from: budget), "budget")
    XCTAssertEqual(GlanceLinks.effect(for: budget, locked: false), .select("budget"))
    XCTAssertEqual(GlanceLinks.effect(for: budget, locked: true), .deferUntilUnlock("budget"))
    let path = try XCTUnwrap(URL(string: "lakshly:///debt"))
    XCTAssertEqual(GlanceLinks.tab(from: path), "debt")
    XCTAssertEqual(GlanceLinks.effect(for: URL(string: "https://example.com")!, locked: false), .ignore)
    XCTAssertEqual(GlanceWidgetKind.budgetPace.deepLink, "lakshly://budget")
    XCTAssertEqual(GlanceWidgetKind.debt.deepLink, "lakshly://debt")
  }

  func testTimelineIncludesMidnightAndTheNextBill() {
    let now = date(2026, 9, 10, 15)
    let due = date(2026, 9, 25, 0)
    let dates = GlanceTimeline.dates(now: now, nextBill: due, calendar: utc)
    XCTAssertEqual(dates.count, 3)
    XCTAssertEqual(dates[0], now)
    XCTAssertEqual(dates[1], utc.startOfDay(for: date(2026, 9, 11, 0)))
    XCTAssertEqual(dates[2], due)
    XCTAssertEqual(GlanceTimeline.dates(now: now, nextBill: date(2026, 9, 1), calendar: utc).count, 2)
  }

  func testAccountNumbersDoNotTravelInNames() {
    XCTAssertEqual(GlancePrivacy.displayName("Card 4111111111114242"), "Card ••••4242")
    XCTAssertEqual(GlancePrivacy.displayName("  "), "")
  }

  private func paced(percent: Double) throws -> GlanceSnapshot {
    var snapshot = GlanceBuilder.build(
      dataset: try sample(), now: date(2026, 9, 10), includeAmounts: true, tier: .free, calendar: utc)
    snapshot.nextBill = nil
    snapshot.budget.monthSpendPercent = percent
    return snapshot
  }

  private func pace(spend: Double, elapsed: Double, limit: Int64) -> GlancePace {
    let budget = Budget(id: "b", month: "2026-09", category: "groceries", limit: limit, rollover: nil)
    let spent = Int64((Double(limit) * spend / 100).rounded())
    let transaction = Transaction(
      id: "t", accountId: "a", date: "2026-09-01", amount: -spent, description: "Groceries", merchant: nil,
      category: "groceries", method: nil, recurring: nil, tags: nil, categorisedBy: nil)
    let snapshot = GlanceBuilder.build(
      dataset: makeDataset(transactions: limit > 0 ? [transaction] : [], budgets: limit > 0 ? [budget] : []),
      now: date(2026, 9, Int((elapsed / 100 * 30).rounded())), includeAmounts: false, tier: .free, calendar: utc)
    return snapshot.budget.status
  }

  private func makeDataset(
    accounts: [Account] = [], transactions: [Transaction] = [], budgets: [Budget] = [],
    debts: [Debt] = [], sips: [SIP] = []
  ) -> Dataset {
    Dataset(
      schemaVersion: "1", generatedAt: "2026-09-10", synthetic: true, notice: nil, currency: "INR",
      accounts: accounts, transactions: transactions, budgets: budgets, debts: debts, sips: sips, rewards: nil)
  }
}

@MainActor final class GlanceRevealTests: XCTestCase {
  func testSuccessfulRevealShowsAmountsUntilTheClockExpires() async throws {
    let auth = ScriptedAuthenticator()
    var clock = Date(timeIntervalSince1970: 1_700_000_000)
    let session = GlanceRevealSession(authenticator: auth, now: { clock })
    let dataset = try sample()
    await session.reveal(tier: .premium, themeID: "lakshmi", appearance: "dark") { dataset }
    XCTAssertEqual(auth.reason, GlanceRevealSession.revealReason)
    XCTAssertNotNil(session.snapshot?.netWorth)
    XCTAssertNil(session.message)
    clock = clock.addingTimeInterval(59)
    session.expireIfNeeded()
    XCTAssertNotNil(session.snapshot)
    clock = clock.addingTimeInterval(1)
    session.expireIfNeeded()
    XCTAssertNil(session.snapshot)
  }

  func testFailedAndUnavailableRevealStayHidden() async {
    let auth = ScriptedAuthenticator()
    auth.result = .success(false)
    let session = GlanceRevealSession(authenticator: auth, now: { Date() })
    await session.reveal(tier: .free, themeID: "lakshmi", appearance: "system") { self.emptyDataset() }
    XCTAssertNil(session.snapshot)
    XCTAssertEqual(session.message, GlanceRevealSession.failedMessage)

    auth.result = .failure(CocoaError(.userCancelled))
    await session.reveal(tier: .free, themeID: "lakshmi", appearance: "system") { self.emptyDataset() }
    XCTAssertNil(session.snapshot)
    XCTAssertEqual(session.message, GlanceRevealSession.failedMessage)

    auth.can = false
    await session.reveal(tier: .free, themeID: "lakshmi", appearance: "system") { self.emptyDataset() }
    XCTAssertEqual(session.message, GlanceRevealSession.unavailableMessage)
    XCTAssertNil(session.snapshot)
  }

  func testHideDuringAuthenticationDropsTheResult() async {
    let auth = ScriptedAuthenticator()
    let session = GlanceRevealSession(authenticator: auth, now: { Date() })
    auth.onEvaluate = { session.hide() }
    await session.reveal(tier: .premium, themeID: "lakshmi", appearance: "system") { self.emptyDataset() }
    XCTAssertNil(session.snapshot)
    XCTAssertNil(session.message)
    await session.reveal(tier: .free, themeID: "lakshmi", appearance: "system") { self.emptyDataset() }
    session.noteClosed()
    XCTAssertNil(session.snapshot)
    await session.reveal(tier: .free, themeID: "lakshmi", appearance: "system") { self.emptyDataset() }
    session.noteLocked()
    XCTAssertFalse(session.isRevealed)
  }

  private func sample() throws -> Dataset {
    let url = try XCTUnwrap(Bundle.main.url(forResource: "sample.synthetic", withExtension: "json"))
    return try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: url))
  }

  private func emptyDataset() -> Dataset {
    Dataset(
      schemaVersion: "1", generatedAt: "2026-09-10", synthetic: true, notice: nil, currency: "INR",
      accounts: [], transactions: [], budgets: nil, debts: nil, sips: nil, rewards: nil)
  }
}

private final class ScriptedAuthenticator: GlanceAuthenticating, @unchecked Sendable {
  var can = true
  var result: Result<Bool, Error> = .success(true)
  var reason: String?
  var onEvaluate: (@MainActor () -> Void)?
  func canEvaluate() -> Bool { can }
  func evaluate(reason: String) async throws -> Bool {
    self.reason = reason
    await MainActor.run { self.onEvaluate?() }
    switch result {
    case .success(let value): return value
    case .failure(let error): throw error
    }
  }
}

final class GlanceMoneyTests: XCTestCase {
  func testGlanceAmountsRoundToWholeRupees() {
    XCTAssertEqual(Money.glance(62_147), "₹621")
    XCTAssertEqual(Money.glance(62_150), "₹622")
    XCTAssertEqual(Money.glance(1_38_59_00), "₹13,859")
    XCTAssertEqual(Money.glance(-62_150), "−₹622")
  }
}
