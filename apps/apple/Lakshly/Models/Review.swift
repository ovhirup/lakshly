import Foundation

// Weekly review inbox + Worth-it tags: pure logic, a 1:1 port of apps/web/lib/review.ts.
// buildInbox(txns, state, now) decides what needs a look this week;
// apply(state, action, ctx) is the single reducer every input path (buttons, swipe, keys, VoiceOver) goes through.

enum Nwv: String, Codable, CaseIterable, Sendable {
  case need, want, vice
  var label: String {
    switch self {
    case .need: "Need"
    case .want: "Want"
    case .vice: "Vice"
    }
  }
  var icon: String {
    switch self {
    case .need: "🧺"
    case .want: "✨"
    case .vice: "🎲"
    }
  }
}

enum Worth: String, Codable, Sendable { case yes, no }

/// A transaction as the review sees it. `nwv` is the proposed optional schema field.
struct ReviewTxn: Equatable, Sendable {
  var id: String
  var date: String
  var amount: Int64
  var description: String
  var merchant: String?
  var category: String
  var tags: [String]?
  var categorisedBy: String?
  var nwv: Nwv?
  var name: String { merchant ?? description }
}

extension ReviewTxn {
  init(_ t: Transaction) {
    self.init(
      id: t.id, date: t.date, amount: t.amount, description: t.description, merchant: t.merchant,
      category: t.category, tags: t.tags, categorisedBy: t.categorisedBy, nwv: nil)
  }
}

enum ReviewRules {
  static let windowDays = 35
  static let firstRunDays = 7
  static let xpConfirm = 1
  static let xpChange = 2
  static let xpWeekCleared = 15
  static let streakBonusPer = 5
  static let streakBonusMaxWeeks = 4
  static let weeklyCap = 60
  static let undoSeconds: Double = 5
  static let refillEveryClears = 4

  static let categories = [
    "groceries", "dining", "transport", "fuel", "shopping", "utilities", "rent", "health", "education",
    "entertainment", "travel", "subscriptions", "insurance", "investments", "emi", "fees", "transfers", "cash",
    "gifts", "other", "income",
  ]

  /// Default Need/Want/Vice suggestion when a row has none. A suggestion only; the user always decides.
  static let nwvByCategory: [String: Nwv] = [
    "income": .need, "groceries": .need, "dining": .want, "transport": .need, "fuel": .need, "shopping": .want,
    "utilities": .need, "rent": .need, "health": .need, "education": .need, "entertainment": .want, "travel": .want,
    "subscriptions": .want, "insurance": .need, "investments": .need, "emi": .need, "fees": .need, "transfers": .need,
    "cash": .want, "gifts": .want, "other": .want,
  ]
}

struct ReviewDecision: Codable, Equatable, Sendable {
  enum Action: String, Codable, Sendable { case confirm, change }
  var category: String
  var nwv: Nwv?
  var action: Action
  var at: String
  var worth: Worth?
}

struct MerchantRule: Codable, Equatable, Sendable {
  var category: String
  var nwv: Nwv?
}

struct ActiveQuest: Codable, Equatable, Sendable {
  var merchant: String
  var until: String
}

/// Stored encrypted inside the SecureStore payload (`review.state`). Device-local.
struct ReviewState: Codable, Equatable, Sendable {
  var v = 2
  var lastReviewedAt: String?
  var lastClearedWeek: String?
  var streak = 0
  var bestStreak = 0
  var freezesLeft = 1
  /// Cleared weeks since the freeze was last refilled (refills at 4).
  var clearsTowardFreeze = 0
  var xp = 0
  var weekXP: [String: Int] = [:]
  var decisions: [String: ReviewDecision] = [:]
  var merchantRules: [String: MerchantRule] = [:]
  /// Mirror of decisions[tx].worth for quick reads (also holds ratings made outside the review).
  var worth: [String: Worth] = [:]
  /// Skipped rows, oldest skip first; they sort to the bottom of the inbox.
  var skipped: [String] = []
  /// Every ISO week cleared, oldest first.
  var clearedWeeks: [String] = []
  /// Worth-it "Not now" snoozes: merchant -> ISO time.
  var snoozed: [String: String] = [:]
  var quest: ActiveQuest?

  init() {}

  enum CodingKeys: String, CodingKey {
    case v, lastReviewedAt, lastClearedWeek, streak, bestStreak, freezesLeft, clearsTowardFreeze, xp, weekXP,
      decisions, merchantRules, worth, skipped, clearedWeeks, snoozed, quest
  }

  /// Accepts v1 (spec) or v2 state and fills gaps defensively (normaliseState on web).
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
      ((try? c.decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback
    }
    lastReviewedAt = value(.lastReviewedAt, String?.none)
    lastClearedWeek = value(.lastClearedWeek, String?.none)
    streak = value(.streak, 0)
    bestStreak = value(.bestStreak, 0)
    freezesLeft = value(.freezesLeft, 1)
    clearsTowardFreeze = value(.clearsTowardFreeze, 0)
    xp = value(.xp, 0)
    weekXP = value(.weekXP, [:])
    decisions = value(.decisions, [:])
    merchantRules = value(.merchantRules, [:])
    worth = value(.worth, [:])
    for (id, d) in decisions where d.worth != nil && worth[id] == nil { worth[id] = d.worth }
    skipped = value(.skipped, [])
    clearedWeeks = value(.clearedWeeks, lastClearedWeek.map { [$0] } ?? [])
    snoozed = value(.snoozed, [:])
    if let q = value(.quest, ActiveQuest?.none), !q.merchant.trimmingCharacters(in: .whitespaces).isEmpty,
      q.until.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    {
      quest = q
    }
  }
}

// MARK: - Dates & ISO weeks (device-local)

enum ReviewDates {
  private static let utc: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
  }()
  private static let isoUTC: Calendar = {
    var c = Calendar(identifier: .iso8601)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
  }()

  static func localDate(_ d: Date, calendar: Calendar = .current) -> String {
    let p = calendar.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", p.year!, p.month!, p.day!)
  }

  /// ISO string with the device's offset, e.g. 2026-10-04T19:00:00+05:30.
  static func isoLocal(_ d: Date, timeZone: TimeZone = .current) -> String {
    let f = ISO8601DateFormatter()
    f.timeZone = timeZone
    f.formatOptions = [.withInternetDateTime]
    return f.string(from: d)
  }

  static func parse(_ s: String) -> Date? {
    let f = ISO8601DateFormatter()
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.date(from: s)
  }

  static func ymd(_ s: String) -> Date? {
    let parts = s.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  static func addDays(_ s: String, _ n: Int) -> String {
    guard let d = ymd(s), let r = utc.date(byAdding: .day, value: n, to: d) else { return s }
    return localDate(r, calendar: utc)
  }

  /// ISO week id (YYYY-Www) of a calendar date string.
  static func isoWeek(_ s: String) -> String {
    guard let d = ymd(s) else { return "" }
    let p = isoUTC.dateComponents([.yearForWeekOfYear, .weekOfYear], from: d)
    return String(format: "%04d-W%02d", p.yearForWeekOfYear!, p.weekOfYear!)
  }

  /// Monday of an ISO week id.
  static func weekMonday(_ id: String) -> String {
    let parts = id.components(separatedBy: "-W").compactMap { Int($0) }
    guard parts.count == 2,
      let d = isoUTC.date(from: DateComponents(weekday: 2, weekOfYear: parts[1], yearForWeekOfYear: parts[0]))
    else { return "" }
    return localDate(d, calendar: utc)
  }

  static func weeksBetween(_ a: String, _ b: String) -> Int {
    guard let x = ymd(weekMonday(a)), let y = ymd(weekMonday(b)) else { return Int.max }
    return Int((y.timeIntervalSince(x) / (7 * 86_400)).rounded())
  }

  static func weekNumber(_ id: String) -> Int { Int(id.components(separatedBy: "-W").last ?? "") ?? 0 }
}

// MARK: - Suggestions & inbox

struct ReviewSuggestion: Equatable, Sendable {
  var category: String
  var nwv: Nwv?
}

struct InboxRow: Identifiable, Equatable, Sendable {
  var tx: ReviewTxn
  var suggestion: ReviewSuggestion
  var refund: Bool
  var older: Bool
  var id: String { tx.id }
  var ratable: Bool { suggestion.nwv == .want || suggestion.nwv == .vice }
}

struct ReviewInbox: Equatable, Sendable {
  var week: String
  var rows: [InboxRow]
  var older: [InboxRow]
  var count: Int { rows.count }
}

enum ReviewAction: Equatable, Sendable {
  case confirm(String, nwv: Nwv? = nil)
  case change(String, category: String, nwv: Nwv?, rememberMerchant: Bool = false)
  case skip(String)
  case confirmAll
  case rate(String, Worth?)
  case snooze(merchant: String, until: String)
  case startQuest(merchant: String, until: String)
  case clearQuest
}

struct ReviewContext {
  var txns: [ReviewTxn]
  var now: Date
  var importedAt: [String: String] = [:]
  var calendar: Calendar = .current
}

struct ReviewResult: Equatable {
  var state: ReviewState
  var xpGained = 0
  var cleared = false
  var streakBonus = 0
  var message = ""
}

struct WorthMonth: Equatable {
  var month: String
  var rated: Int
  var yes: Int
  var no: Int
  var ratio: Double?
}

struct QuestSuggestion: Equatable {
  enum Kind: String { case noDeliveryWeek = "no_delivery_week", qcTwoRuns = "qc_two_runs", wishlistThree = "wishlist_three", custom }
  var id: Kind
  var title: String
  var premium: Bool
}

struct ReviewLevel: Equatable, Sendable {
  var level: Int
  var minXP: Int
  var name: String
}

enum Review {
  /// Mirrors packages/shared/levels.json (checked by ReviewTests).
  static let levels: [ReviewLevel] = [
    .init(level: 1, minXP: 0, name: "Seed"), .init(level: 2, minXP: 50, name: "Sprout"),
    .init(level: 3, minXP: 150, name: "Bud"), .init(level: 4, minXP: 300, name: "Bloom"),
    .init(level: 5, minXP: 500, name: "Lotus"), .init(level: 6, minXP: 800, name: "Golden Lotus"),
    .init(level: 7, minXP: 1200, name: "Steady Hand"), .init(level: 8, minXP: 1700, name: "Money Sage"),
    .init(level: 9, minXP: 2400, name: "Lakshmi's Keeper"), .init(level: 10, minXP: 3300, name: "Every Rupee on Target"),
  ]

  static func merchantKey(_ t: ReviewTxn) -> String {
    let m = (t.merchant?.isEmpty == false ? t.merchant! : t.description)
    return m.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private static let refundPattern = #"(?i)\b(refund|refunded|reversal|reversed|chargeback|cashback|return(ed)? credit)\b"#
  private static let spendCategories: Set<String> = [
    "groceries", "dining", "transport", "fuel", "shopping", "utilities", "health", "education", "entertainment",
    "travel", "subscriptions", "fees",
  ]

  /// Statement parsers don't tag refunds, so also recognise refund wording and credits in a spending category.
  static func isRefund(_ t: ReviewTxn) -> Bool {
    guard t.amount > 0 else { return false }
    return (t.tags ?? []).contains("refund")
      || "\(t.description) \(t.merchant ?? "")".range(of: refundPattern, options: .regularExpression) != nil
      || spendCategories.contains(t.category)
  }

  static func suggest(_ t: ReviewTxn, _ state: ReviewState) -> ReviewSuggestion {
    let rule = state.merchantRules[merchantKey(t)]
    let category = rule?.category ?? t.category
    if isRefund(t) { return ReviewSuggestion(category: category, nwv: nil) }
    return ReviewSuggestion(category: category, nwv: rule?.nwv ?? t.nwv ?? ReviewRules.nwvByCategory[category] ?? .want)
  }

  private static func eligible(_ t: ReviewTxn, _ state: ReviewState) -> Bool {
    if t.category == "transfers" || t.category == "income" { return false }
    if t.categorisedBy == "user" { return false }
    if state.decisions[t.id] != nil { return false }
    return t.amount < 0 || isRefund(t)
  }

  static func buildInbox(
    _ txns: [ReviewTxn], _ state: ReviewState, now: Date, importedAt: [String: String] = [:],
    calendar: Calendar = .current
  ) -> ReviewInbox {
    let today = ReviewDates.localDate(now, calendar: calendar)
    let windowStart = ReviewDates.addDays(today, -ReviewRules.windowDays)
    let last = state.lastReviewedAt.flatMap(ReviewDates.parse)
    let since = last.map { ReviewDates.localDate($0, calendar: calendar) } ?? ReviewDates.addDays(today, -ReviewRules.firstRunDays)
    let lastAt = last ?? .distantPast
    var rows: [InboxRow] = []
    var older: [InboxRow] = []
    for t in txns {
      guard eligible(t, state), t.date <= today else { continue }
      let lateImport = importedAt[t.id].flatMap(ReviewDates.parse).map { $0 > lastAt } ?? false
      guard t.date >= since || lateImport else { continue }
      let row = InboxRow(tx: t, suggestion: suggest(t, state), refund: isRefund(t), older: t.date < windowStart)
      if row.older { older.append(row) } else { rows.append(row) }
    }
    var skipRank: [String: Int] = [:]
    for (i, id) in state.skipped.enumerated() { skipRank[id] = i }
    func sorted(_ list: [InboxRow]) -> [InboxRow] {
      // Stable: same date keeps source order.
      list.enumerated().sorted { a, b in
        let sa = skipRank[a.element.tx.id], sb = skipRank[b.element.tx.id]
        if sa != nil || sb != nil {
          guard let sa else { return true }
          guard let sb else { return false }
          return sa < sb
        }
        if a.element.tx.date != b.element.tx.date { return a.element.tx.date > b.element.tx.date }
        return a.offset < b.offset
      }.map(\.element)
    }
    return ReviewInbox(week: ReviewDates.isoWeek(today), rows: sorted(rows), older: sorted(older))
  }

  static func countLabel(_ n: Int) -> String { n > 50 ? "50+" : String(n) }

  private static func award(_ state: inout ReviewState, _ week: String, _ amount: Int) -> Int {
    let used = state.weekXP[week] ?? 0
    let gain = max(0, min(amount, ReviewRules.weeklyCap - used))
    state.weekXP[week] = used + gain
    state.xp += gain
    return gain
  }

  static func title(_ category: String) -> String { category.prefix(1).uppercased() + category.dropFirst() }

  /// One entry point for every input path. Pure: returns a new state.
  static func apply(_ prev: ReviewState, _ action: ReviewAction, _ ctx: ReviewContext) -> ReviewResult {
    var state = prev
    let inbox = buildInbox(ctx.txns, prev, now: ctx.now, importedAt: ctx.importedAt, calendar: ctx.calendar)
    let week = inbox.week
    let at = ReviewDates.isoLocal(ctx.now, timeZone: ctx.calendar.timeZone)
    let all = inbox.rows + inbox.older
    func find(_ id: String) -> InboxRow? { all.first { $0.tx.id == id } }
    var xpGained = 0
    var decided = 0
    var decidedRegular = 0
    var message = ""

    func decide(_ row: InboxRow, _ category: String, _ nwv: Nwv?, _ kind: ReviewDecision.Action, _ xp: Int) {
      state.decisions[row.tx.id] = ReviewDecision(category: category, nwv: nwv, action: kind, at: at, worth: state.worth[row.tx.id])
      state.skipped.removeAll { $0 == row.tx.id }
      // Older imports can be confirmed but earn no XP.
      if !row.older {
        xpGained += award(&state, week, xp)
        decidedRegular += 1
      }
      decided += 1
    }
    func nwvSuffix(_ n: Nwv?) -> String { n.map { ", \($0.label)" } ?? "" }

    switch action {
    case .confirm(let id, let picked):
      guard let row = find(id) else { break }
      let nwv = row.refund ? nil : (picked ?? row.suggestion.nwv)
      let changed = !row.refund && picked != nil && picked != row.suggestion.nwv
      decide(row, row.suggestion.category, nwv, changed ? .change : .confirm, changed ? ReviewRules.xpChange : ReviewRules.xpConfirm)
      message = "Confirmed \(row.tx.name) as \(title(row.suggestion.category))\(nwvSuffix(nwv))."
    case .change(let id, let category, let nwv, let remember):
      guard let row = find(id) else { break }
      if row.refund {  // refunds support Confirm only
        decide(row, row.suggestion.category, nil, .confirm, ReviewRules.xpConfirm)
        break
      }
      decide(row, category, nwv, .change, ReviewRules.xpChange)
      if remember { state.merchantRules[merchantKey(row.tx)] = MerchantRule(category: category, nwv: nwv) }
      message = "Changed \(row.tx.name) to \(title(category))\(nwvSuffix(nwv))."
    case .skip(let id):
      guard find(id) != nil else { break }
      state.skipped.removeAll { $0 == id }
      state.skipped.append(id)
      message = "Skipped for now."
    case .confirmAll:
      for row in inbox.rows { decide(row, row.suggestion.category, row.suggestion.nwv, .confirm, ReviewRules.xpConfirm) }
      message = "Confirmed \(inbox.rows.count) items."
    case .rate(let id, let worth):
      // Worth-it ratings never touch XP.
      state.worth[id] = worth
      state.decisions[id]?.worth = worth
      message = worth == .yes ? "Marked worth it." : worth == .no ? "Marked not really." : "Rating cleared."
    case .snooze(let merchant, let until):
      state.snoozed[merchant] = until
      message = "Okay, not now."
    case .startQuest(let merchant, let until):
      state.quest = ActiveQuest(merchant: merchant, until: until)
      message = "3-day wait started."
    case .clearQuest:
      state.quest = nil
      message = "Wait cleared."
    }

    var cleared = false
    var streakBonus = 0
    if decided > 0 {
      let after = buildInbox(ctx.txns, state, now: ctx.now, importedAt: ctx.importedAt, calendar: ctx.calendar)
      // Only clearing a regular inbox row can complete the week; older late imports earn nothing (incl. the clear bonus).
      if decidedRegular > 0 && after.count == 0 && state.lastClearedWeek != week {
        cleared = true
        let gap = state.lastClearedWeek.map { ReviewDates.weeksBetween($0, week) } ?? Int.max
        if gap == 1 {
          state.streak += 1
        } else if gap >= 2 && state.freezesLeft > 0 {  // same as web: a first-ever clear (no previous week) also spends the freeze
          state.freezesLeft -= 1  // one freeze covers exactly one missed week
          state.streak = gap == 2 ? state.streak + 1 : 1
        } else {
          state.streak = 1
        }
        state.bestStreak = max(state.bestStreak, state.streak)
        state.clearsTowardFreeze += 1
        if state.clearsTowardFreeze >= ReviewRules.refillEveryClears {
          state.clearsTowardFreeze = 0
          state.freezesLeft = min(1, state.freezesLeft + 1)
        }
        state.lastClearedWeek = week
        state.clearedWeeks.removeAll { $0 == week }
        state.clearedWeeks.append(week)
        state.lastReviewedAt = at
        let bonusTarget = ReviewRules.streakBonusPer * min(state.streak, ReviewRules.streakBonusMaxWeeks)
        let base = award(&state, week, ReviewRules.xpWeekCleared)
        streakBonus = award(&state, week, bonusTarget)
        xpGained += base + streakBonus
        message = "Inbox zero. Week \(ReviewDates.weekNumber(week)) done ✨"
      } else if !message.isEmpty {
        message += " \(after.count) left."
      }
    }
    return ReviewResult(state: state, xpGained: xpGained, cleared: cleared, streakBonus: streakBonus, message: message)
  }

  /// Streak copy: never red, never shaming.
  static func streakText(_ state: ReviewState, now: Date, calendar: Calendar = .current) -> String {
    guard let last = state.lastClearedWeek, state.streak > 0 else { return "Clear a week to start a streak" }
    let gap = ReviewDates.weeksBetween(last, ReviewDates.isoWeek(ReviewDates.localDate(now, calendar: calendar)))
    if gap > 2 || (gap == 2 && state.freezesLeft == 0) { return "Streak resting. Pick it up anytime 🌱" }
    return "🔥 \(state.streak)-week streak"
  }

  static func level(for xp: Int) -> (current: ReviewLevel, next: ReviewLevel?, progress: Double) {
    let current = levels.last { xp >= $0.minXP } ?? levels[0]
    let next = levels.first { $0.minXP > xp }
    let progress = next.map { Double(xp - current.minXP) / Double($0.minXP - current.minXP) } ?? 1
    return (current, next, progress)
  }

  /// Effective category/Need-Want-Vice for display: the user's decision wins.
  static func overlay(_ t: ReviewTxn, _ state: ReviewState) -> ReviewTxn {
    guard let d = state.decisions[t.id] else { return t }
    var out = t
    out.category = d.category
    out.categorisedBy = "user"
    if let n = d.nwv { out.nwv = n }
    return out
  }

  static func effectiveNwv(_ t: ReviewTxn, _ state: ReviewState) -> Nwv? {
    if let d = state.decisions[t.id] { return d.nwv }
    return suggest(t, state).nwv
  }

  static func monthlyRatio(_ txns: [ReviewTxn], _ state: ReviewState, month: String) -> WorthMonth {
    var yes = 0, no = 0
    for t in txns {
      guard let w = state.worth[t.id], t.date.hasPrefix(month) else { continue }
      let n = effectiveNwv(t, state)
      guard n == .want || n == .vice else { continue }  // re-tagged as Need: rating kept, excluded from ratios
      if w == .yes { yes += 1 } else { no += 1 }
    }
    let rated = yes + no
    return WorthMonth(
      month: month, rated: rated, yes: yes, no: no,
      ratio: rated < 5 ? nil : (Double(yes) / Double(rated) * 100).rounded() / 100)
  }

  static func regretMerchants(_ txns: [ReviewTxn], _ state: ReviewState, now: Date, windowDays: Int = 60, calendar: Calendar = .current) -> [String] {
    let start = ReviewDates.addDays(ReviewDates.localDate(now, calendar: calendar), -windowDays)
    var by: [String: (name: String, no: Int, rated: Int)] = [:]
    var order: [String] = []
    for t in txns {
      guard let w = state.worth[t.id], t.date >= start else { continue }
      let n = effectiveNwv(t, state)
      guard n == .want || n == .vice else { continue }
      let k = merchantKey(t)
      if by[k] == nil { order.append(k) }
      var e = by[k] ?? (t.name, 0, 0)
      e.rated += 1
      if w == .no { e.no += 1 }
      by[k] = e
    }
    return order.compactMap { by[$0] }
      .filter { $0.no >= 3 && Double($0.no) / Double($0.rated) >= 0.6 }
      .sorted { $0.no != $1.no ? $0.no > $1.no : $0.name < $1.name }
      .map(\.name)
  }

  static func questFor(_ merchant: String, category: String?, premium: Bool) -> QuestSuggestion {
    if category == "dining", merchant.range(of: "(?i)deliver|biryani|pizza|food|eats|kitchen|bite", options: .regularExpression) != nil {
      return QuestSuggestion(id: .noDeliveryWeek, title: "a No-Delivery Week", premium: false)
    }
    if merchant.range(of: "(?i)instant|minute|quick ?mart|10 ?min|dash", options: .regularExpression) != nil {
      return QuestSuggestion(id: .qcTwoRuns, title: "Two quick-commerce runs this week", premium: false)
    }
    return premium
      ? QuestSuggestion(id: .custom, title: "a custom “skip \(merchant)” quest", premium: true)
      : QuestSuggestion(id: .wishlistThree, title: "the Wishlist-three habit (wait 3 days before buying)", premium: false)
  }

  /// The day the 3-day wait ends. Today counts as day zero.
  static func wishlistUntil(_ today: String) -> String { ReviewDates.addDays(today, 3) }
  static func questWaiting(_ quest: ActiveQuest?, today: String) -> Bool { quest.map { today < $0.until } ?? false }

  static func canUndo(at: Date?, now: Date) -> Bool {
    guard let at else { return false }
    return now.timeIntervalSince(at) <= ReviewRules.undoSeconds
  }

  // MARK: Demo (synthetic dataset only)

  /// Demo clock: 19:00 local on the demo dataset's as-of day. Keeps the demo inbox meaningful forever.
  static func demoNow(_ ds: Dataset, calendar: Calendar = .current) -> Date {
    let asOf = ds.accounts.map(\.asOf).max() ?? "2026-10-01"
    let parts = asOf.split(separator: "-").compactMap { Int($0) }
    let ymd = parts.count == 3 ? parts : [2026, 10, 1]
    return calendar.date(from: DateComponents(year: ymd[0], month: ymd[1], day: ymd[2], hour: 19)) ?? Date()
  }

  /// A believable starting point for the synthetic demo (mirrors web demoSeed): last review ten days before as-of,
  /// a 2-week streak, earlier rows already reviewed, and five Worth-it ratings on demo merchants.
  static func demoSeed(_ ds: Dataset, calendar: Calendar = .current) -> ReviewState {
    let now = demoNow(ds, calendar: calendar)
    let day = calendar.startOfDay(for: now)
    let reviewed = calendar.date(byAdding: DateComponents(day: -10, hour: 21), to: day) ?? now
    let reviewedDay = ReviewDates.localDate(reviewed, calendar: calendar)
    let week = ReviewDates.isoWeek(reviewedDay)
    func back(_ d: Int) -> String { ReviewDates.isoWeek(ReviewDates.addDays(reviewedDay, -d)) }
    var s = ReviewState()
    s.clearedWeeks = [back(21), back(7), week]
    s.lastReviewedAt = ReviewDates.isoLocal(reviewed, timeZone: calendar.timeZone)
    s.lastClearedWeek = week
    s.streak = 2
    s.bestStreak = 4
    s.freezesLeft = 1
    s.clearsTowardFreeze = 2
    s.xp = 86
    s.weekXP = [week: 22]
    let txns = ds.transactions.map(ReviewTxn.init)
    for t in txns where !(t.date > reviewedDay || t.amount >= 0 || t.category == "transfers" || t.category == "income") {
      s.decisions[t.id] = ReviewDecision(category: t.category, nwv: ReviewRules.nwvByCategory[t.category], action: .confirm, at: s.lastReviewedAt!)
    }
    let month = String(reviewedDay.prefix(7))
    let wants = txns.filter {
      $0.date.hasPrefix(month) && $0.date <= reviewedDay && $0.amount < 0 && ReviewRules.nwvByCategory[$0.category] == .want
    }.reversed()
    var byMerchant: [(String, [ReviewTxn])] = []
    for t in wants {
      if let i = byMerchant.firstIndex(where: { $0.0 == t.name }) { byMerchant[i].1.append(t) } else { byMerchant.append((t.name, [t])) }
    }
    func rate(_ t: ReviewTxn, _ w: Worth) {
      s.worth[t.id] = w
      s.decisions[t.id]?.worth = w
    }
    // Stable sort by count desc (JS sort is stable too).
    let ranked = byMerchant.enumerated().sorted { $0.element.1.count != $1.element.1.count ? $0.element.1.count > $1.element.1.count : $0.offset < $1.offset }.map(\.element)
    if let regret = ranked.first, regret.1.count >= 3 {
      regret.1.prefix(3).forEach { rate($0, .no) }
      byMerchant.filter { $0.0 != regret.0 }.prefix(2).forEach { rate($0.1[0], .yes) }
    }
    return s
  }
}
