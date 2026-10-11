import XCTest

@testable import Lakshly

/// Review state lives inside the encrypted StoredData payload and survives a reload; undo is 5 s only.
@MainActor final class ReviewStoreTests: XCTestCase {
  private var defaults: UserDefaults!
  private var suiteName: String!

  override func setUp() {
    super.setUp()
    suiteName = "ReviewStoreTests.\(UUID().uuidString)"
    defaults = UserDefaults(suiteName: suiteName)
  }

  override func tearDown() {
    defaults.removePersistentDomain(forName: suiteName)
    super.tearDown()
  }

  func testDemoReviewStartsFromSeedAndPersistsEncryptedPayload() throws {
    let memory = MemoryStoredData()
    let store = DataStore(backing: memory, defaults: defaults)
    let inbox = store.reviewInbox
    XCTAssertGreaterThan(inbox.count, 0)
    XCTAssertEqual(store.reviewState.streak, 2)
    let first = try XCTUnwrap(inbox.rows.first)
    let r = store.applyReview(.confirm(first.id))
    XCTAssertGreaterThan(r.xpGained, 0)
    XCTAssertEqual(store.reviewInbox.count, inbox.count - 1)
    XCTAssertNotNil(store.reviewDemo?.decisions[first.id])
    XCTAssertNil(store.review, "demo actions never touch My data review state")
    let reloaded = DataStore(backing: memory, defaults: defaults)
    XCTAssertEqual(reloaded.reviewDemo, store.reviewDemo)
    XCTAssertEqual(reloaded.reviewInbox.count, inbox.count - 1)
    // Merchant names and decisions are inside the sealed payload, not in UserDefaults.
    XCTAssertNil(defaults.dictionaryRepresentation().keys.first { $0.hasPrefix("review.state") })
  }

  func testUndoWithinFiveSecondsRestoresRowAndXP() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let before = store.reviewState
    let first = try XCTUnwrap(store.reviewInbox.rows.first)
    let t0 = Date()
    store.applyReview(.confirm(first.id), now: t0)
    XCTAssertNotEqual(store.reviewState.xp, before.xp)
    XCTAssertEqual(store.undoReview(now: t0.addingTimeInterval(4)), "Undone.")
    XCTAssertEqual(store.reviewState, before)
    store.applyReview(.confirm(first.id), now: t0)
    XCTAssertNil(store.undoReview(now: t0.addingTimeInterval(6)))
    XCTAssertNotEqual(store.reviewState, before)
  }

  func testDecisionsOverlayCategoryForSpendTotals() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let row = try XCTUnwrap(store.reviewInbox.rows.first { !$0.refund && $0.tx.category != "gifts" })
    store.selectedMonth = String(row.tx.date.prefix(7))
    store.applyReview(.change(row.id, category: "gifts", nwv: .want))
    let shown = try XCTUnwrap(store.transactions.first { $0.id == row.id })
    XCTAssertEqual(shown.category, "gifts")
    XCTAssertEqual(shown.categorisedBy, "user")
    XCTAssertNotEqual(store.demoDataset?.transactions.first { $0.id == row.id }?.category, "gifts", "stored rows are never rewritten")
  }

  func testDeepLinkOpensReviewTab() {
    XCTAssertEqual(GlanceLinks.effect(for: URL(string: "lakshly://review")!, locked: false), .select("review"))
    XCTAssertEqual(GlanceLinks.effect(for: URL(string: "lakshly://review")!, locked: true), .deferUntilUnlock("review"))
  }

  func testReminderBodyHasCountsOnly() {
    XCTAssertEqual(ReviewReminder.body(count: 10, streak: 2), "10 to review this week · 🔥 2")
    XCTAssertEqual(ReviewReminder.body(count: 60, streak: 0), "50+ to review this week")
    XCTAssertFalse(ReviewReminder.body(count: 3, streak: 1).contains("₹"))
  }
}
