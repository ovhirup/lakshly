import Foundation

/// Top spending category for one month. Named so `MonthlyStory` can synthesize `Equatable`.
struct StoryCategory: Equatable {
  var name: String
  var paise: Int64
  var sharePct: Double
}

/// Biggest want or vice merchant for one month. Named so `MonthlyStory` can synthesize `Equatable`.
struct StoryWant: Equatable {
  var merchant: String
  var paise: Int64
  var sharePct: Double
}

/// One month, told in percentages. Amounts stay in paise and never go on a share image.
struct MonthlyStory: Equatable {
  var month: String
  var label: String
  /// True when `month` is the month of `store.reviewNow` (the clock passed into `Story.build`).
  var partial: Bool
  var spendPaise: Int64
  var incomePaise: Int64
  /// `(income - spend) / income × 100`. Nil when the month has no income.
  var savingsRate: Double?
  /// Spend versus the previous calendar month. Nil when that month has no spend.
  var spendChangePct: Double?
  var topCategory: StoryCategory
  /// Biggest merchant whose effective Need/Want/Vice is want or vice. Share is of total spend.
  var topWant: StoryWant?
  /// Want + vice spend / spend × 100.
  var wantsSharePct: Double
  var budgetsKept: Int
  var budgetsTotal: Int
  var worth: WorthMonth
  var reviewXP: Int
  var win: String
}

struct StorySlide: Identifiable, Equatable {
  var id: String
  var label: String
  var headline: String
  var detail: String
}

/// Pure monthly story. No SwiftUI.
enum Story {
  static func build(
    month: String,
    transactions: [Transaction],
    budgets: [Budget],
    review: ReviewState,
    reviewTxns: [ReviewTxn],
    now: Date = Date(),
    calendar: Calendar = .current
  ) -> MonthlyStory {
    var spendByMonth: [String: Int64] = [:]
    var categorySpend: [String: Int64] = [:]
    var income = Int64(0)
    var monthSpendRows: [Transaction] = []

    for txn in transactions {
      let key = String(txn.date.prefix(7))
      if isIncome(txn) && key == month {
        income += txn.amount
      }
      guard isSpend(txn) else { continue }
      let paise = -txn.amount
      spendByMonth[key, default: 0] += paise
      if key == month {
        categorySpend[txn.category, default: 0] += paise
        monthSpendRows.append(txn)
      }
    }

    let spend = spendByMonth[month] ?? 0
    let previous = previousMonth(month)
    let previousSpend = previous.flatMap { spendByMonth[$0] } ?? 0
    let spendChange: Double? = previousSpend > 0
      ? (Double(spend) - Double(previousSpend)) / Double(previousSpend) * 100
      : nil
    let savings: Double? = income > 0 ? (Double(income - spend) / Double(income)) * 100 : nil

    let topCategory = categorySpend.max { lhs, rhs in
      lhs.value != rhs.value ? lhs.value < rhs.value : lhs.key > rhs.key
    }
    let topCategoryValue = topCategory.map {
      StoryCategory(name: $0.key, paise: $0.value, sharePct: share($0.value, of: spend))
    } ?? StoryCategory(name: "", paise: 0, sharePct: 0)

    let topWant = biggestWant(monthSpendRows, spend: spend, review: review, reviewTxns: reviewTxns)
    let wantPaise = wantViceSpend(monthSpendRows, review: review, reviewTxns: reviewTxns)

    let monthBudgets = budgets.filter { $0.month == month }
    let kept = monthBudgets.filter { (categorySpend[$0.category] ?? 0) <= $0.limit }.count

    let story = MonthlyStory(
      month: month,
      label: monthLabel(month),
      partial: month == monthID(now, calendar: calendar),
      spendPaise: spend,
      incomePaise: income,
      savingsRate: savings,
      spendChangePct: spendChange,
      topCategory: topCategoryValue,
      topWant: topWant,
      wantsSharePct: share(wantPaise, of: spend),
      budgetsKept: kept,
      budgetsTotal: monthBudgets.count,
      worth: Review.monthlyRatio(reviewTxns, review, month: month),
      reviewXP: reviewXP(review, month: month),
      win: "")
    var finished = story
    finished.win = win(finished, previousMonth: previous)
    return finished
  }

  static func slides(_ story: MonthlyStory) -> [StorySlide] {
    let name = monthName(story.month)
    let intro = "Your \(name)" + (story.partial ? " (so far)" : "")
    let wantHeadline = story.topWant.map(\.merchant) ?? "No want stood out"
    let wantDetail = "Wants share \(formatNumber(story.wantsSharePct))%"
    let savingsHeadline: String = {
      guard let rate = story.savingsRate else { return "No income this month" }
      return "Saved \(formatNumber(rate))% of income"
    }()
    let worthHeadline: String = {
      guard story.worth.rated >= 5, let ratio = story.worth.ratio else {
        return "Rate a few Wants in Review to see this"
      }
      return "\(formatNumber(ratio * 100))% worth it"
    }()
    let categoryDetail = story.topCategory.paise > 0
      ? "\(formatNumber(story.topCategory.sharePct))% of spend"
      : "No spend in this month"
    return [
      slide("intro", "Intro", intro, story.label),
      slide("win", "Win", story.win, ""),
      slide("category", "Top category", story.topCategory.name, categoryDetail),
      slide("want", "Top want", wantHeadline, wantDetail),
      slide("budgets", "Budgets", "Kept \(story.budgetsKept) of \(story.budgetsTotal)", ""),
      slide("savings", "Savings", savingsHeadline, ""),
      slide("worth", "Worth it", worthHeadline, ""),
      slide("xp", "Review XP", "+\(story.reviewXP)", ""),
      slide("outro", "Share", "Share your \(name)", "The image shows percentages only, never amounts."),
    ]
  }

  /// Percentages only. Amounts never appear here.
  static func shareTiles(_ story: MonthlyStory) -> [(label: String, value: String)] {
    let savings = story.savingsRate.map { formatPercent($0) } ?? "—"
    let change = story.spendChangePct.map { formatPercent($0, signed: true) } ?? "—"
    let worth: String = {
      guard story.worth.rated >= 5, let ratio = story.worth.ratio else { return "—" }
      return formatPercent(ratio * 100)
    }()
    let rows = [
      ("Savings rate", savings),
      ("Wants share", formatPercent(story.wantsSharePct)),
      ("Spend vs last month", change),
      ("Budgets kept", "\(story.budgetsKept)/\(story.budgetsTotal)"),
      ("Worth it", worth),
      ("Review XP", "+\(story.reviewXP)"),
    ]
    return rows.map { (label: shareSafe($0.0), value: shareSafe($0.1)) }
  }

  /// Strips ₹/$/€ amounts (commas and decimals included) so a share image cannot leak money.
  static func shareSafe(_ text: String) -> String {
    text.replacingOccurrences(
      of: #"[−+\-]?\s*[₹$€]\s*[0-9][0-9,]*(?:\.[0-9]+)?"#,
      with: "",
      options: .regularExpression)
  }

  // MARK: - Spend rules

  /// Card bill payments are transfers by category, or read as one from the description or merchant.
  private static let cardBillPattern =
    #"(?i)\b(transfer|trf|cc\s*bill|card\s*bill|card\s*payment|payment\s*received|autopay\s*thank|bbps|own\s+account|to\s+self)\b"#

  private static func isCardBill(_ txn: Transaction) -> Bool {
    if txn.category == "transfers" { return true }
    let blob = "\(txn.description) \(txn.merchant ?? "")"
    return blob.range(of: cardBillPattern, options: .regularExpression) != nil
  }

  private static func isSpend(_ txn: Transaction) -> Bool {
    txn.amount < 0 && txn.category != "investments" && !isCardBill(txn)
  }

  private static func isIncome(_ txn: Transaction) -> Bool {
    txn.amount > 0 && txn.category == "income" && !isCardBill(txn)
  }

  private static func share(_ part: Int64, of total: Int64) -> Double {
    guard total > 0 else { return 0 }
    return Double(part) / Double(total) * 100
  }

  private static func biggestWant(
    _ rows: [Transaction], spend: Int64, review: ReviewState, reviewTxns: [ReviewTxn]
  ) -> StoryWant? {
    struct Bucket {
      var name: String
      var paise: Int64
      var order: Int
    }
    let byID = Dictionary(reviewTxns.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    var buckets: [String: Bucket] = [:]
    var order = 0
    for txn in rows {
      let reviewTxn = byID[txn.id] ?? ReviewTxn(txn)
      guard isWantOrVice(reviewTxn, fallbackCategory: txn.category, review: review) else { continue }
      let name = displayMerchant(txn)
      let key = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
      if var existing = buckets[key] {
        existing.paise += -txn.amount
        buckets[key] = existing
      } else {
        buckets[key] = Bucket(name: name, paise: -txn.amount, order: order)
        order += 1
      }
    }
    guard let top = buckets.values.max(by: { lhs, rhs in
      lhs.paise != rhs.paise ? lhs.paise < rhs.paise : lhs.order > rhs.order
    }) else { return nil }
    return StoryWant(merchant: top.name, paise: top.paise, sharePct: share(top.paise, of: spend))
  }

  private static func wantViceSpend(
    _ rows: [Transaction], review: ReviewState, reviewTxns: [ReviewTxn]
  ) -> Int64 {
    let byID = Dictionary(reviewTxns.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    return rows.reduce(Int64(0)) { sum, txn in
      let reviewTxn = byID[txn.id] ?? ReviewTxn(txn)
      return isWantOrVice(reviewTxn, fallbackCategory: txn.category, review: review) ? sum + -txn.amount : sum
    }
  }

  private static func isWantOrVice(_ txn: ReviewTxn, fallbackCategory: String, review: ReviewState) -> Bool {
    let nwv = Review.effectiveNwv(txn, review)
      ?? ReviewRules.nwvByCategory[txn.category]
      ?? ReviewRules.nwvByCategory[fallbackCategory]
    return nwv == .want || nwv == .vice
  }

  private static func displayMerchant(_ txn: Transaction) -> String {
    if let merchant = txn.merchant?.trimmingCharacters(in: .whitespacesAndNewlines), !merchant.isEmpty {
      return merchant
    }
    return txn.description
  }

  private static func reviewXP(_ review: ReviewState, month: String) -> Int {
    review.weekXP.reduce(0) { sum, item in
      ReviewDates.weekMonday(item.key).hasPrefix(month) ? sum + item.value : sum
    }
  }

  private static func win(_ story: MonthlyStory, previousMonth: String?) -> String {
    if story.budgetsKept == story.budgetsTotal, story.budgetsTotal > 0 {
      return "Every budget kept 🎯"
    }
    if let change = story.spendChangePct, change <= -5 || abs(change + 5) < 0.000_001 {
      let name = monthName(previousMonth ?? "")
      return "Spent \(formatNumber(abs(change)))% less than \(name) 📉"
    }
    if let rate = story.savingsRate, rate >= 20 || abs(rate - 20) < 0.000_001 {
      return "Saved \(formatNumber(rate))% of income 💪"
    }
    if story.budgetsKept > 0 {
      return "Kept \(story.budgetsKept) of \(story.budgetsTotal) budgets ✅"
    }
    return "You showed up and looked. That counts ✍️"
  }

  // MARK: - Copy

  private static func slide(_ id: String, _ label: String, _ headline: String, _ detail: String) -> StorySlide {
    StorySlide(id: id, label: label, headline: shareSafe(headline), detail: shareSafe(detail))
  }

  private static func formatNumber(_ value: Double) -> String {
    let rounded = (abs(value) * 10).rounded() / 10
    if rounded == rounded.rounded() { return String(Int(rounded)) }
    return String(format: "%.1f", rounded)
  }

  private static func formatPercent(_ value: Double, signed: Bool = false) -> String {
    let body = formatNumber(value)
    if body == "0" { return "0%" }
    if signed { return (value > 0 ? "+" : "-") + body + "%" }
    return (value < 0 ? "-" : "") + body + "%"
  }

  /// The calendar month before `yyyy-MM`. Nil when the id is not a month.
  private static func previousMonth(_ month: String) -> String? {
    let parts = month.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 2, (1...12).contains(parts[1]) else { return nil }
    let year = parts[1] == 1 ? parts[0] - 1 : parts[0]
    let monthIndex = parts[1] == 1 ? 12 : parts[1] - 1
    guard year > 0 else { return nil }
    return String(format: "%04d-%02d", year, monthIndex)
  }

  private static func monthID(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month], from: date)
    return String(format: "%04d-%02d", parts.year ?? 1, min(max(parts.month ?? 1, 1), 12))
  }

  private static func monthDate(_ month: String) -> Date? {
    let parts = month.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 2 else { return nil }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1))
  }

  private static let labelFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "MMMM yyyy"
    return formatter
  }()

  private static let nameFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "MMMM"
    return formatter
  }()

  private static func monthLabel(_ month: String) -> String {
    guard let date = monthDate(month) else { return month }
    return labelFormatter.string(from: date)
  }

  private static func monthName(_ month: String) -> String {
    guard let date = monthDate(month) else { return month }
    return nameFormatter.string(from: date)
  }
}
