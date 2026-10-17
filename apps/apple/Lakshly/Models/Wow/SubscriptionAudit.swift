import Foundation

enum SubscriptionCadence: String, Equatable, Sendable {
  case weekly, monthly, quarterly, yearly, irregular

  var label: String {
    switch self {
    case .weekly: "Weekly"
    case .monthly: "Monthly"
    case .quarterly: "Quarterly"
    case .yearly: "Yearly"
    case .irregular: "Irregular"
    }
  }

  /// Nominal length used for "1.6 × cadence days". Irregular has none.
  var lengthDays: Int? {
    switch self {
    case .weekly: 7
    case .monthly: 30
    case .quarterly: 91
    case .yearly: 365
    case .irregular: nil
    }
  }
}

enum SubscriptionFlag: Equatable, Sendable {
  case priceUp(Int)
  case doubleCharge(String)
  case lapsed(String)
  case overlap(String, Int)

  var text: String {
    switch self {
    case .priceUp(let pct):
      "Price up \(pct)%"
    case .doubleCharge(let month):
      "Charged twice in \(month)"
    case .lapsed(let since):
      "No charge since \(since), may be cancelled already"
    case .overlap(let kind, let count):
      "\(count) \(kind) services"
    }
  }
}

struct SubscriptionItem: Equatable, Identifiable, Sendable {
  var id: String
  var name: String
  var kind: String
  var charges: Int
  var lastDate: String
  var lastPaise: Int64
  var typicalPaise: Int64
  var cadence: SubscriptionCadence
  var monthlyPaise: Int64
  var yearlyPaise: Int64
  var nextDate: String?
  var flags: [SubscriptionFlag]
  var verdict: String

  var lapsed: Bool {
    flags.contains { if case .lapsed = $0 { return true }; return false }
  }
}

struct AuditResult: Equatable, Sendable {
  var items: [SubscriptionItem]
  var monthlyTotalPaise: Int64
  var yearlyTotalPaise: Int64
  var plannedSavingsYearlyPaise: Int64
  var yearlyAfterPlanPaise: Int64
  var overlaps: [String: [String]]
}

/// Subscription audit over statement rows. Amounts are paise. No SwiftUI.
enum SubscriptionAudit {
  private static let blocked: Set<String> = [
    "rent", "emi", "investments", "income", "transfers", "insurance", "utilities", "groceries", "fuel",
  ]
  private static let overlapKinds: Set<String> = ["video", "music", "cloud"]
  private static let shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  private static let longMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]

  static func build(transactions: [Transaction], now: Date, planned: Set<String>) -> AuditResult {
    let calendar = Calendar.current
    let groups = Dictionary(grouping: transactions.filter { isCandidate($0) }) { slug(of: $0) }
    var items: [SubscriptionItem] = groups.compactMap { slug, rows in
      guard !slug.isEmpty else { return nil }
      let kept = rows.count >= 2 || rows.contains { $0.category.lowercased() == "subscriptions" }
      guard kept else { return nil }
      return makeItem(slug: slug, rows: rows, now: now, calendar: calendar)
    }
    items.sort { lhs, rhs in
      if lhs.yearlyPaise != rhs.yearlyPaise { return lhs.yearlyPaise > rhs.yearlyPaise }
      if lhs.name != rhs.name { return lhs.name < rhs.name }
      return lhs.id < rhs.id
    }
    let overlaps = overlapMap(items)
    items = items.map { item in
      var copy = item
      if let names = overlaps[item.kind], !item.lapsed {
        copy.flags.append(.overlap(item.kind, names.count))
      }
      copy.verdict = verdict(for: copy.flags)
      return copy
    }
    let active = items.filter { !$0.lapsed }
    let monthly = active.reduce(Int64(0)) { $0 + $1.monthlyPaise }
    let yearly = active.reduce(Int64(0)) { $0 + $1.yearlyPaise }
    let saved = active.reduce(Int64(0)) { sum, item in
      planned.contains(item.id) ? sum + item.yearlyPaise : sum
    }
    return AuditResult(
      items: items,
      monthlyTotalPaise: monthly,
      yearlyTotalPaise: yearly,
      plannedSavingsYearlyPaise: saved,
      yearlyAfterPlanPaise: max(0, yearly - saved),
      overlaps: overlaps)
  }

  static func kindTitle(_ kind: String) -> String {
    switch kind {
    case "video": "Video"
    case "music": "Music"
    case "cloud": "Cloud"
    case "news": "News"
    default: "Other"
    }
  }

  static func scheduleLine(_ item: SubscriptionItem) -> String {
    guard let next = item.nextDate else { return item.cadence.label }
    return "\(item.cadence.label) · next \(shortDay(next))"
  }

  static func shortDay(_ ymd: String) -> String {
    guard let parts = parts(ymd), (1...12).contains(parts.month), (1...31).contains(parts.day) else { return ymd }
    return "\(parts.day) \(shortMonths[parts.month - 1])"
  }

  private static func isCandidate(_ txn: Transaction) -> Bool {
    guard txn.amount < 0 else { return false }
    let category = txn.category.lowercased()
    if category == "subscriptions" || category == "entertainment" { return true }
    return txn.recurring == true && !blocked.contains(category)
  }

  private static func slug(of txn: Transaction) -> String {
    shownName(txn).lowercased()
  }

  private static func shownName(_ txn: Transaction) -> String {
    let merchant = txn.merchant?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !merchant.isEmpty { return merchant }
    return txn.description.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func makeItem(
    slug: String, rows: [Transaction], now: Date, calendar: Calendar
  ) -> SubscriptionItem? {
    let sorted = rows.sorted { lhs, rhs in
      if lhs.date != rhs.date { return lhs.date < rhs.date }
      return lhs.id < rhs.id
    }
    guard let latest = sorted.last, let lastDay = day(latest.date, calendar: calendar) else { return nil }
    let amounts = sorted.map { magnitude($0.amount) }
    let typical = median(amounts)
    let gaps = gapDays(sorted, calendar: calendar)
    let category = latest.category.lowercased()
    let cadence = cadence(medianGap: gaps.isEmpty ? nil : medianGap(gaps), count: sorted.count, category: category)
    let span = gaps.reduce(0, +)
    let monthly = normalisedMonthly(cadence: cadence, typical: typical, total: amounts.reduce(0, +), spanDays: span)
    let yearly = monthly * 12
    let next = nextDay(lastDay, cadence: cadence, calendar: calendar)
    var flags: [SubscriptionFlag] = []
    if amounts.count >= 2 {
      let earlier = median(Array(amounts.dropLast()))
      if earlier > 0, Double(amounts[amounts.count - 1]) > Double(earlier) * 1.10 {
        let pct = Int((Double(amounts[amounts.count - 1] - earlier) / Double(earlier) * 100).rounded())
        flags.append(.priceUp(max(pct, 1)))
      }
    }
    if cadence == .monthly {
      var counts: [String: Int] = [:]
      for row in sorted {
        counts[String(row.date.prefix(7)), default: 0] += 1
      }
      let doubled = counts.filter { $0.value >= 2 }.map(\.key).sorted()
      for month in doubled {
        flags.append(.doubleCharge(longMonth(month)))
      }
    }
    if let length = cadence.lengthDays {
      let elapsed = calendar.dateComponents(
        [.day], from: calendar.startOfDay(for: lastDay), to: calendar.startOfDay(for: now)
      ).day ?? 0
      if Double(elapsed) > Double(length) * 1.6 {
        flags.append(.lapsed(shortDay(latest.date)))
      }
    }
    return SubscriptionItem(
      id: slug,
      name: shownName(latest),
      kind: kind(of: shownName(latest)),
      charges: sorted.count,
      lastDate: latest.date,
      lastPaise: amounts.last ?? 0,
      typicalPaise: typical,
      cadence: cadence,
      monthlyPaise: monthly,
      yearlyPaise: yearly,
      nextDate: next,
      flags: flags,
      verdict: verdict(for: flags))
  }

  private static func kind(of name: String) -> String {
    let hay = name.lowercased()
    let table: [(String, [String])] = [
      ("video", ["stream", "tv", "video", "flix", "prime", "play"]),
      ("music", ["tune", "music", "song", "radio"]),
      ("cloud", ["cloud", "drive", "storage", "backup"]),
      ("news", ["news", "times", "post", "mag"]),
    ]
    for (kind, words) in table where words.contains(where: { hay.contains($0) }) {
      return kind
    }
    return "other"
  }

  private static func cadence(medianGap: Double?, count: Int, category: String) -> SubscriptionCadence {
    if let gap = medianGap {
      if gap <= 10 { return .weekly }
      if gap <= 45 { return .monthly }
      if gap <= 120 { return .quarterly }
      if gap >= 300 && gap <= 400 { return .yearly }
    }
    if count == 1 && category == "subscriptions" { return .monthly }
    return .irregular
  }

  /// Weekly ×52/12, quarterly /3, yearly /12, from the typical charge. Irregular is the total over the day span in 30-day months.
  private static func normalisedMonthly(
    cadence: SubscriptionCadence, typical: Int64, total: Int64, spanDays: Int
  ) -> Int64 {
    switch cadence {
    case .weekly: return typical * 52 / 12
    case .monthly: return typical
    case .quarterly: return typical / 3
    case .yearly: return typical / 12
    case .irregular: return total * 30 / Int64(max(spanDays, 1))
    }
  }

  private static func verdict(for flags: [SubscriptionFlag]) -> String {
    if flags.contains(where: { if case .lapsed = $0 { return true }; return false }) {
      return "Looks cancelled"
    }
    let worth = flags.contains { flag in
      switch flag {
      case .priceUp, .doubleCharge, .overlap: return true
      case .lapsed: return false
      }
    }
    return worth ? "Worth a look" : "Keep"
  }

  private static func overlapMap(_ items: [SubscriptionItem]) -> [String: [String]] {
    var names: [String: [String]] = [:]
    for item in items where !item.lapsed && overlapKinds.contains(item.kind) {
      names[item.kind, default: []].append(item.name)
    }
    return names.filter { $0.value.count >= 2 }
  }

  private static func gapDays(_ rows: [Transaction], calendar: Calendar) -> [Int] {
    let days = rows.compactMap { day($0.date, calendar: calendar) }
    guard days.count >= 2 else { return [] }
    return (1..<days.count).map { index in
      calendar.dateComponents([.day], from: days[index - 1], to: days[index]).day ?? 0
    }
  }

  private static func median(_ values: [Int64]) -> Int64 {
    guard !values.isEmpty else { return 0 }
    let sorted = values.sorted()
    let mid = sorted.count / 2
    if sorted.count % 2 == 1 { return sorted[mid] }
    return (sorted[mid - 1] + sorted[mid]) / 2
  }

  private static func medianGap(_ values: [Int]) -> Double {
    let sorted = values.sorted()
    let mid = sorted.count / 2
    if sorted.count % 2 == 1 { return Double(sorted[mid]) }
    return Double(sorted[mid - 1] + sorted[mid]) / 2
  }

  private static func magnitude(_ value: Int64) -> Int64 {
    if value == .min { return .max }
    return value < 0 ? -value : value
  }

  private static func day(_ ymd: String, calendar: Calendar) -> Date? {
    guard let parts = parts(ymd) else { return nil }
    return calendar.date(from: DateComponents(year: parts.year, month: parts.month, day: parts.day))
  }

  private static func parts(_ ymd: String) -> (year: Int, month: Int, day: Int)? {
    let bits = ymd.split(separator: "-").compactMap { Int($0) }
    guard bits.count == 3 else { return nil }
    return (bits[0], bits[1], bits[2])
  }

  private static func nextDay(_ last: Date, cadence: SubscriptionCadence, calendar: Calendar) -> String? {
    let shifted: Date?
    switch cadence {
    case .weekly: shifted = calendar.date(byAdding: .day, value: 7, to: last)
    case .monthly: shifted = calendar.date(byAdding: .month, value: 1, to: last)
    case .quarterly: shifted = calendar.date(byAdding: .month, value: 3, to: last)
    case .yearly: shifted = calendar.date(byAdding: .year, value: 1, to: last)
    case .irregular: shifted = nil
    }
    guard let shifted else { return nil }
    let bits = calendar.dateComponents([.year, .month, .day], from: shifted)
    guard let year = bits.year, let month = bits.month, let day = bits.day else { return nil }
    return String(format: "%04d-%02d-%02d", year, month, day)
  }

  private static func longMonth(_ yyyyMM: String) -> String {
    let bits = yyyyMM.split(separator: "-").compactMap { Int($0) }
    guard bits.count == 2, (1...12).contains(bits[1]) else { return yyyyMM }
    return longMonths[bits[1] - 1]
  }
}
