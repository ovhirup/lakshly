import XCTest

@testable import Lakshly

// Weekly review + Worth-it: golden tests ported 1:1 from apps/web/tests/review.test.ts (SYNTHETIC rows, no real data).
final class ReviewTests: XCTestCase {
  private func tx(_ id: String, _ date: String, _ amount: Int64, _ merchant: String, _ category: String, nwv: Nwv? = nil, tags: [String]? = nil, by: String = "rule") -> ReviewTxn {
    ReviewTxn(id: id, date: date, amount: amount, description: merchant, merchant: merchant, category: category, tags: tags, categorisedBy: by, nwv: nwv)
  }
  private func local(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0) -> Date {
    Calendar.current.date(from: DateComponents(year: y, month: m, day: d, hour: h))!
  }
  private lazy var now = local(2026, 11, 8, 19)
  private lazy var txns: [ReviewTxn] = [
    tx("t_veg1", "2026-11-02", -64000, "Demo Veggie Cart", "groceries", nwv: .need),
    tx("t_late1", "2026-11-02", -38000, "Midnight Momo Delivery", "dining", nwv: .vice),
    tx("t_gift1", "2026-11-03", -20000, "UPI Ravi (demo)", "other", nwv: .want),
    tx("t_bus1", "2026-11-03", -30000, "Demo Bus Pass", "transport"),
    tx("t_tv1", "2026-11-04", -14900, "Sample Stream Box", "subscriptions"),
    tx("t_shoe1", "2026-11-04", -329900, "Example Shoe Studio", "shopping"),
    tx("t_xfer1", "2026-11-05", -500000, "Self transfer", "transfers"),
    tx("t_sal1", "2026-11-05", 7_000_000, "Demo Employer", "income"),
    tx("t_ref1", "2026-11-06", 29900, "Example Shoe Studio", "shopping", tags: ["refund"]),
    tx("t_pow1", "2026-11-06", -99000, "Demo Power Co", "utilities"),
    tx("t_med1", "2026-11-07", -25000, "Sample Chemist", "health"),
    tx("t_cafe1", "2026-11-07", -18000, "Demo Filter Coffee", "dining"),
    tx("t_user1", "2026-11-07", -45000, "Demo Book Shop", "education", by: "user"),
    tx("t_old1", "2026-09-20", -52000, "Sample Mart (old import)", "shopping"),
    tx("t_prev1", "2026-11-01", -11100, "Before last review", "dining"),
  ]
  private let importedAt = ["t_old1": "2026-11-08T10:00:00+05:30"]
  private var before: ReviewState {
    var s = ReviewState()
    s.lastReviewedAt = "2026-11-01T20:00:00+05:30"
    s.lastClearedWeek = "2026-W44"
    s.clearedWeeks = ["2026-W44"]
    s.streak = 2
    s.bestStreak = 6
    s.xp = 100
    s.weekXP = ["2026-W45": 0]
    s.decisions = ["t_prev1": ReviewDecision(category: "dining", nwv: .want, action: .confirm, at: "2026-11-01T20:00:00+05:30")]
    return s
  }
  private var ctx: ReviewContext { ReviewContext(txns: txns, now: now, importedAt: importedAt) }
  private let session: [ReviewAction] = [
    .confirm("t_veg1"), .confirm("t_bus1"), .confirm("t_tv1"), .confirm("t_pow1"), .confirm("t_med1"),
    .change("t_gift1", category: "gifts", nwv: .want, rememberMerchant: true), .change("t_late1", category: "dining", nwv: .want),
    .skip("t_shoe1"), .confirm("t_ref1"), .confirm("t_cafe1"), .confirm("t_shoe1"),
  ]
  private func run(_ s: ReviewState, _ actions: [ReviewAction], _ c: ReviewContext? = nil) -> ReviewState {
    actions.reduce(s) { Review.apply($0, $1, c ?? ctx).state }
  }
  private func inbox(_ s: ReviewState, _ t: [ReviewTxn]? = nil, at: Date? = nil) -> ReviewInbox {
    Review.buildInbox(t ?? txns, s, now: at ?? now, importedAt: importedAt)
  }

  func testISOWeeks() {
    XCTAssertEqual(ReviewDates.isoWeek("2026-11-08"), "2026-W45")
    XCTAssertEqual(ReviewDates.isoWeek("2026-11-02"), "2026-W45")
    XCTAssertEqual(ReviewDates.isoWeek("2026-01-01"), "2026-W01")
    XCTAssertEqual(ReviewDates.isoWeek("2027-01-01"), "2026-W53")
    XCTAssertEqual(ReviewDates.weekMonday("2026-W45"), "2026-11-02")
  }

  func testInboxRowsOrderAndExclusions() {
    let i = inbox(before)
    XCTAssertEqual(i.week, "2026-W45")
    XCTAssertEqual(i.rows.map(\.id), ["t_med1", "t_cafe1", "t_ref1", "t_pow1", "t_tv1", "t_shoe1", "t_gift1", "t_bus1", "t_veg1", "t_late1"])
    XCTAssertEqual(i.count, 10)
    for id in ["t_xfer1", "t_sal1", "t_user1", "t_prev1", "t_old1"] { XCTAssertFalse(i.rows.map(\.id).contains(id)) }
    XCTAssertEqual(i.older.map(\.id), ["t_old1"])
  }

  func testFirstRunShowsLastSevenDays() {
    let ids = inbox(ReviewState()).rows.map(\.id)
    XCTAssertTrue(ids.contains("t_veg1"))
    XCTAssertTrue(ids.contains("t_prev1"))
    XCTAssertFalse(inbox(ReviewState(), at: local(2026, 11, 12, 9)).rows.map(\.id).contains("t_veg1"))
  }

  func testSuggestionsAndRefunds() {
    let rows = inbox(before).rows
    func by(_ id: String) -> InboxRow { rows.first { $0.id == id }! }
    XCTAssertEqual(by("t_bus1").suggestion, ReviewSuggestion(category: "transport", nwv: .need))
    XCTAssertEqual(by("t_shoe1").suggestion, ReviewSuggestion(category: "shopping", nwv: .want))
    XCTAssertNil(by("t_ref1").suggestion.nwv)
    XCTAssertTrue(by("t_ref1").refund)
    XCTAssertEqual(Review.countLabel(50), "50")
    XCTAssertEqual(Review.countLabel(51), "50+")
  }

  func testFullSession() {
    let s = run(before, session)
    XCTAssertEqual(inbox(s).count, 0)
    XCTAssertEqual(s.weekXP["2026-W45"], 42)
    XCTAssertEqual(s.xp, 142)
    XCTAssertEqual([s.streak, s.bestStreak, s.freezesLeft], [3, 6, 1])
    XCTAssertEqual(s.lastClearedWeek, "2026-W45")
    XCTAssertEqual(s.merchantRules, ["upi ravi (demo)": MerchantRule(category: "gifts", nwv: .want)])
    XCTAssertEqual(s.decisions.count, 11)
    XCTAssertEqual(s.decisions["t_ref1"]?.category, "shopping")
    XCTAssertNil(s.decisions["t_ref1"]?.nwv)
    XCTAssertEqual(s.decisions["t_ref1"]?.action, .confirm)
    XCTAssertEqual(s.decisions["t_late1"]?.nwv, .want)
    XCTAssertEqual(s.decisions["t_late1"]?.action, .change)
  }

  func testClearAnnouncement() {
    let s = run(before, Array(session.dropLast()))
    let r = Review.apply(s, session.last!, ctx)
    XCTAssertTrue(r.cleared)
    XCTAssertEqual(r.message, "Inbox zero. Week 45 done ✨")
    XCTAssertEqual(r.streakBonus, 15)
  }

  func testNewTransactionReopensInboxWithoutUndoingClear() {
    let s = run(before, session)
    let more = txns + [tx("t_veg2", "2026-11-08", -21000, "Demo Veggie Cart", "groceries")]
    XCTAssertEqual(inbox(s, more).count, 1)
    let r = Review.apply(s, .confirm("t_veg2"), ReviewContext(txns: more, now: now, importedAt: importedAt))
    XCTAssertFalse(r.cleared)
    XCTAssertEqual(r.state.lastClearedWeek, "2026-W45")
    XCTAssertEqual(r.state.xp, 143)
  }

  func testMerchantRulesFeedLaterSuggestionsOnly() {
    let s = run(before, session)
    let more = txns + [tx("t_gift2", "2026-11-08", -10000, "UPI Ravi (demo)", "other")]
    XCTAssertEqual(inbox(s, more).rows[0].suggestion, ReviewSuggestion(category: "gifts", nwv: .want))
    XCTAssertEqual(s.decisions["t_prev1"]?.category, "dining")
  }

  func testSkipConfirmWithNwvRefundOlderConfirmAll() {
    let skipped = inbox(run(before, [.skip("t_med1")])).rows.map(\.id)
    XCTAssertEqual(skipped.last, "t_med1")
    XCTAssertEqual(skipped.count, 10)
    let want = Review.apply(before, .confirm("t_bus1", nwv: .want), ctx)
    XCTAssertEqual(want.state.decisions["t_bus1"]?.action, .change)
    XCTAssertEqual(want.xpGained, 2)
    let refund = Review.apply(before, .change("t_ref1", category: "gifts", nwv: .vice), ctx).state.decisions["t_ref1"]
    XCTAssertEqual(refund?.category, "shopping")
    XCTAssertNil(refund?.nwv)
    let older = Review.apply(before, .confirm("t_old1"), ctx)
    XCTAssertNotNil(older.state.decisions["t_old1"])
    XCTAssertEqual(older.xpGained, 0)
    let all = Review.apply(before, .confirmAll, ctx)
    XCTAssertEqual(inbox(all.state).count, 0)
    XCTAssertTrue(all.cleared)
    XCTAssertEqual(all.state.weekXP["2026-W45"], 40)
  }

  func testWeeklyCap() {
    let many = (0..<70).map { tx("m\($0)", "2026-11-05", -1000 - Int64($0), "Demo Stall \($0)", "dining") }
    let s = run(before, many.map { .change($0.id, category: "dining", nwv: .want) }, ReviewContext(txns: many, now: now))
    XCTAssertEqual(s.weekXP["2026-W45"], 60)
    XCTAssertEqual(s.xp, 160)
  }

  func testUndoWindow() {
    let at = Date(timeIntervalSince1970: 1)
    XCTAssertTrue(Review.canUndo(at: at, now: at.addingTimeInterval(4.9)))
    XCTAssertFalse(Review.canUndo(at: at, now: at.addingTimeInterval(5.1)))
    XCTAssertEqual(inbox(before).count, 10)
  }

  private func clearAt(_ s: ReviewState, _ week: Int) -> ReviewState {
    let monday = ReviewDates.weekMonday("2026-W\(week)")
    let p = monday.split(separator: "-").map { Int($0)! }
    var start = s
    start.lastReviewedAt = nil
    let c = ReviewContext(txns: [tx("w\(week)", monday, -5000, "Demo Kiosk", "groceries")], now: local(p[0], p[1], p[2] + 6, 19))
    return Review.apply(start, .confirmAll, c).state
  }

  func testStreaksAndFreezes() {
    let after = run(before, session)
    XCTAssertEqual([clearAt(after, 47).streak, clearAt(after, 47).freezesLeft], [4, 0])
    XCTAssertEqual([clearAt(after, 48).streak, clearAt(after, 48).freezesLeft], [1, 0])
    var noFreeze = after
    noFreeze.freezesLeft = 0
    XCTAssertEqual([clearAt(noFreeze, 47).streak, clearAt(noFreeze, 47).freezesLeft], [1, 0])
    var s = after
    s.freezesLeft = 0
    s.clearsTowardFreeze = 1
    for w in [46, 47, 48] { s = clearAt(s, w) }
    XCTAssertEqual(s.freezesLeft, 1)
    XCTAssertEqual(s.streak, 6)
    XCTAssertEqual(Review.streakText(after, now: now), "🔥 3-week streak")
    XCTAssertEqual(Review.streakText(after, now: local(2026, 12, 20)), "Streak resting. Pick it up anytime 🌱")
  }

  private lazy var worthTxns: [ReviewTxn] = [
    tx("w1", "2026-10-03", -40000, "Midnight Momo Delivery", "dining", nwv: .vice),
    tx("w2", "2026-10-10", -42000, "Midnight Momo Delivery", "dining", nwv: .vice),
    tx("w3", "2026-10-17", -39000, "Midnight Momo Delivery", "dining", nwv: .want),
    tx("w4", "2026-10-18", -250000, "Example Shoe Studio", "shopping", nwv: .want),
    tx("w5", "2026-10-24", -60000, "Demo Cinema Hall", "entertainment", nwv: .want),
    tx("w6", "2026-10-25", -70000, "Demo Veggie Cart", "groceries", nwv: .need),
  ]
  private var worthState: ReviewState {
    var s = ReviewState()
    s.worth = ["w1": .no, "w2": .no, "w3": .no, "w4": .yes, "w5": .yes, "w6": .yes]
    return s
  }

  func testWorthItRatioAndRegrets() {
    XCTAssertEqual(Review.monthlyRatio(worthTxns, worthState, month: "2026-10"), WorthMonth(month: "2026-10", rated: 5, yes: 2, no: 3, ratio: 0.4))
    XCTAssertNil(Review.monthlyRatio(Array(worthTxns.prefix(4)), worthState, month: "2026-10").ratio)
    let r = Review.regretMerchants(worthTxns, worthState, now: local(2026, 11, 1))
    XCTAssertEqual(r, ["Midnight Momo Delivery"])
    XCTAssertEqual(Review.questFor(r[0], category: "dining", premium: false).id, .noDeliveryWeek)
    XCTAssertEqual(Review.questFor("Example Shoe Studio", category: "shopping", premium: false).id, .wishlistThree)
    XCTAssertTrue(Review.questFor("Example Shoe Studio", category: "shopping", premium: true).premium)
    XCTAssertEqual(Review.regretMerchants(worthTxns, worthState, now: local(2027, 1, 30)), [])
    var s2 = worthState
    s2.decisions = ["w4": ReviewDecision(category: "shopping", nwv: .need, action: .change, at: "x")]
    XCTAssertEqual(Review.monthlyRatio(worthTxns, s2, month: "2026-10").rated, 4)
    XCTAssertNil(Review.monthlyRatio(worthTxns, s2, month: "2026-10").ratio)
    XCTAssertEqual(s2.worth["w4"], .yes)
  }

  func testRatingNeverChangesXP() {
    let r = Review.apply(before, .rate("t_late1", .no), ctx)
    XCTAssertEqual(r.state.xp, before.xp)
    XCTAssertEqual(r.state.weekXP, before.weekXP)
    XCTAssertEqual(r.state.worth["t_late1"], .no)
    let withRatings = run(before, [.rate("t_late1", .no), .rate("t_shoe1", .yes)] + session)
    let without = run(before, session)
    XCTAssertEqual(withRatings.xp, without.xp)
    XCTAssertEqual(withRatings.weekXP, without.weekXP)
    XCTAssertEqual(withRatings.decisions["t_shoe1"]?.worth, .yes)
    let cleared = Review.apply(withRatings, .rate("t_shoe1", nil), ctx).state
    XCTAssertNil(cleared.worth["t_shoe1"])
    XCTAssertNil(cleared.decisions["t_shoe1"]?.worth)
  }

  func testOverlayLevelsAndQuest() {
    let s = run(before, session)
    let gift = Review.overlay(txns.first { $0.id == "t_gift1" }!, s)
    XCTAssertEqual(gift.category, "gifts")
    XCTAssertEqual(gift.categorisedBy, "user")
    XCTAssertEqual(Review.level(for: 0).current.level, 1)
    XCTAssertEqual(Review.level(for: 160).current.name, "Bud")
    XCTAssertNil(Review.level(for: 99999).next)
    XCTAssertEqual(Review.wishlistUntil("2026-10-04"), "2026-10-07")
    let started = Review.apply(ReviewState(), .startQuest(merchant: "Sample Bazaar Online", until: "2026-10-07"), ctx)
    XCTAssertEqual(started.state.quest, ActiveQuest(merchant: "Sample Bazaar Online", until: "2026-10-07"))
    XCTAssertEqual(started.xpGained, 0)
    XCTAssertTrue(Review.questWaiting(started.state.quest, today: "2026-10-06"))
    XCTAssertFalse(Review.questWaiting(started.state.quest, today: "2026-10-07"))
    XCTAssertNil(Review.apply(started.state, .clearQuest, ctx).state.quest)
  }

  func testStateDecodesV1AndRejectsBadQuest() throws {
    let v1 = #"{"v":1,"lastClearedWeek":"2026-W39","streak":2,"decisions":{"a":{"category":"dining","nwv":"want","action":"confirm","at":"x","worth":"no"}},"quest":{"merchant":"","until":"nope"}}"#
    let s = try JSONDecoder().decode(ReviewState.self, from: Data(v1.utf8))
    XCTAssertEqual(s.v, 2)
    XCTAssertEqual(s.clearedWeeks, ["2026-W39"])
    XCTAssertEqual(s.freezesLeft, 1)
    XCTAssertEqual(s.worth["a"], .no)
    XCTAssertNil(s.quest)
    let round = try JSONDecoder().decode(ReviewState.self, from: JSONEncoder().encode(s))
    XCTAssertEqual(round, s)
  }

  func testLevelsMatchSharedTable() throws {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../packages/shared/levels.json")
    guard let data = try? Data(contentsOf: url) else { throw XCTSkip("levels.json not reachable from this test host") }
    struct File: Decodable { struct L: Decodable { let level: Int; let minXP: Int; let name: String }; let levels: [L] }
    let shared = try JSONDecoder().decode(File.self, from: data).levels.map { ReviewLevel(level: $0.level, minXP: $0.minXP, name: $0.name) }
    XCTAssertEqual(shared, Review.levels)
  }

  @MainActor func testDemoSeedGivesAWeekWaitingAndFortyPercent() throws {
    guard let ds = try? DataStore.loadSeed() else { throw XCTSkip("synthetic seed not bundled") }
    let seed = Review.demoSeed(ds)
    let n = Review.demoNow(ds)
    let rows = ds.transactions.map(ReviewTxn.init)
    let i = Review.buildInbox(rows, seed, now: n)
    XCTAssertGreaterThanOrEqual(i.count, 5)
    XCTAssertLessThanOrEqual(i.count, 20)
    XCTAssertEqual(i.older.count, 0)
    XCTAssertEqual(seed.streak, 2)
    let month = String(rows.first { seed.worth[$0.id] != nil }!.date.prefix(7))
    XCTAssertEqual(Review.monthlyRatio(rows, seed, month: month).ratio, 0.4)
    XCTAssertEqual(Review.regretMerchants(rows, seed, now: n).count, 1)
  }
}
