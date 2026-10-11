import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// The last review action, undoable for 5 s (takes back that XP too).
struct ReviewUndo {
  var previous: ReviewState
  var source: DataSource
  var at: Date
  var message: String
}

/// App Group keys for the review widget: counts only, never merchants or amounts.
enum ReviewGlance {
  static let countKey = "review.count"
  static let streakKey = "review.streak"
  static let reminderEnabledKey = "review.reminderEnabled"
  static let reminderWeekdayKey = "review.reminderWeekday"
  static let reminderHourKey = "review.reminderHour"
}

extension DataStore {
  /// Every transaction in the active dataset (all months), as the review sees it.
  var reviewTransactions: [ReviewTxn] { (dataset?.transactions ?? []).map(ReviewTxn.init) }

  /// Review clock: real time for My data; 19:00 on the demo's as-of day so the demo inbox stays meaningful.
  var reviewNow: Date {
    if source == .demo, let demoDataset { return Review.demoNow(demoDataset) }
    return Date()
  }

  var reviewState: ReviewState {
    switch source {
    case .demo: reviewDemo ?? demoReviewSeed
    case .mine: review ?? ReviewState()
    }
  }

  /// Late imports: rows from an import logged after the last review (35-day window still applies).
  var reviewImportedAt: [String: String] { [:] }

  /// Built once per demo dataset from the synthetic rows (no real data).
  var demoReviewSeed: ReviewState {
    if let reviewSeedCache { return reviewSeedCache }
    let seed = demoDataset.map { Review.demoSeed($0) } ?? ReviewState()
    reviewSeedCache = seed
    return seed
  }

  var reviewInbox: ReviewInbox {
    Review.buildInbox(reviewTransactions, reviewState, now: reviewNow, importedAt: reviewImportedAt)
  }

  var reviewContext: ReviewContext {
    ReviewContext(txns: reviewTransactions, now: reviewNow, importedAt: reviewImportedAt)
  }

  /// The one entry point for buttons, swipes, keys and VoiceOver actions.
  @discardableResult
  func applyReview(_ action: ReviewAction, now: Date = Date()) -> ReviewResult {
    let previous = reviewState
    let result = Review.apply(previous, action, reviewContext)
    setReviewState(result.state)
    switch action {
    case .skip, .snooze: reviewUndo = nil
    default: reviewUndo = ReviewUndo(previous: previous, source: source, at: now, message: result.message)
    }
    return result
  }

  /// Reverts the last action within 5 s. Returns nil once the window has passed.
  @discardableResult
  func undoReview(now: Date = Date()) -> String? {
    guard let undo = reviewUndo, undo.source == source, Review.canUndo(at: undo.at, now: now) else {
      reviewUndo = nil
      return nil
    }
    setReviewState(undo.previous)
    reviewUndo = nil
    return "Undone."
  }

  func setReviewState(_ state: ReviewState) {
    switch source {
    case .demo: reviewDemo = state
    case .mine: review = state
    }
    save()
    publishReviewGlance()
  }

  func publishReviewGlance() {
    let defaults = GlanceStore.preferences
    defaults.set(reviewInbox.count, forKey: ReviewGlance.countKey)
    defaults.set(reviewState.streak, forKey: ReviewGlance.streakKey)
    #if canImport(WidgetKit)
    WidgetCenter.shared.reloadAllTimelines()
    #endif
  }

  /// Applies review decisions for display (category; categorisedBy "user"). Never rewrites stored rows.
  func reviewed(_ rows: [Transaction]) -> [Transaction] {
    let decisions = reviewState.decisions
    guard !decisions.isEmpty else { return rows }
    return rows.map { t in
      guard let d = decisions[t.id], d.category != t.category || t.categorisedBy != "user" else { return t }
      return Transaction(
        id: t.id, accountId: t.accountId, date: t.date, amount: t.amount, description: t.description,
        merchant: t.merchant, category: d.category, method: t.method, recurring: t.recurring, tags: t.tags,
        categorisedBy: "user")
    }
  }
}
