import Foundation

enum GlanceBuilder {
  /// Spend within five points of the elapsed month stays on track. Further behind is ahead; further ahead, or over the limit, is over.
  static let paceBand = 5.0

  static func build(
    dataset: Dataset,
    now: Date,
    includeAmounts: Bool,
    tier: Tier,
    themeID: String = ThemeID.lakshmi.rawValue,
    appearance: String = "system",
    calendar: Calendar = .current
  ) -> GlanceSnapshot {
    let month = monthKey(now, calendar: calendar)
    let day = calendar.component(.day, from: now)
    let daysInMonth = calendar.range(of: .day, in: .month, for: now)?.count ?? 30
    let budgets = (dataset.budgets ?? []).filter { $0.month == month }
    let limit = budgets.reduce(Int64(0)) { $0 + $1.limit }
    let categories = Set(budgets.map(\.category))
    // Pace uses spending dated on or before `now`, so a later day in the file does not pretend it already happened.
    let spent = spend(dataset, month: month, throughDay: day, categories: categories)
    let spendPercent = limit > 0 ? Double(spent) / Double(limit) * 100 : 0
    let elapsedPercent = daysInMonth > 0 ? Double(day) / Double(daysInMonth) * 100 : 0
    let status = pace(spendPercent: spendPercent, elapsedPercent: elapsedPercent, limit: limit)
    let safe = safeToSpend(limit: limit, spent: spent, day: day, daysInMonth: daysInMonth, includeAmounts: includeAmounts)
    let bill = nextBill(dataset, now: now, calendar: calendar, includeAmounts: includeAmounts)
    let debts = dataset.debts ?? []
    let principal = debts.reduce(Int64(0)) { $0 + $1.principal }
    let outstanding = debts.reduce(Int64(0)) { $0 + $1.outstanding }
    let repaid = principal > 0 ? Double(principal - outstanding) / Double(principal) * 100 : 0
    let assets = dataset.accounts.filter { $0.balance > 0 }.reduce(Int64(0)) { $0 + $1.balance }
    let liabilities = -dataset.accounts.filter { $0.balance < 0 }.reduce(Int64(0)) { $0 + $1.balance }
    return GlanceSnapshot(
      generatedAt: now,
      tier: GlanceTier(tier),
      themeID: themeID,
      appearance: GlanceAppearance(stored: appearance),
      budget: GlanceBudgetPace(
        monthSpendPercent: spendPercent,
        monthElapsedPercent: elapsedPercent,
        status: status,
        safeToSpendPerDay: safe),
      nextBill: bill,
      debtRepaidPercent: min(100, max(0, repaid)),
      netWorthTrend: trend(dataset, now: now, calendar: calendar),
      netWorth: includeAmounts ? assets - liabilities : nil,
      debtOutstanding: includeAmounts ? outstanding : nil)
  }

  private static func pace(spendPercent: Double, elapsedPercent: Double, limit: Int64) -> GlancePace {
    guard limit > 0 else { return .onTrack }
    if spendPercent > 100 || spendPercent > elapsedPercent + paceBand { return .over }
    if spendPercent + paceBand < elapsedPercent { return .ahead }
    return .onTrack
  }

  private static func safeToSpend(
    limit: Int64, spent: Int64, day: Int, daysInMonth: Int, includeAmounts: Bool
  ) -> Int64? {
    guard includeAmounts, limit > 0 else { return nil }
    let daysLeft = max(1, daysInMonth - day + 1)
    let remaining = max(Int64(0), limit - spent)
    return remaining / Int64(daysLeft)
  }

  private static func spend(_ dataset: Dataset, month: String, throughDay: Int, categories: Set<String>) -> Int64 {
    dataset.transactions.reduce(0) { total, transaction in
      guard transaction.amount < 0, categories.contains(transaction.category),
            isOnOrBefore(transaction.date, month: month, day: throughDay) else { return total }
      return total - transaction.amount
    }
  }

  private static func nextBill(
    _ dataset: Dataset, now: Date, calendar: Calendar, includeAmounts: Bool
  ) -> GlanceBill? {
    var candidates: [GlanceBill] = []
    for account in dataset.accounts where account.type == "credit_card" {
      guard let due = nextDue(day: account.dueDay ?? 1, now: now, calendar: calendar) else { continue }
      candidates.append(GlanceBill(
        name: named(account.name, fallback: "Card"),
        dueDate: due,
        kind: .card,
        amount: includeAmounts ? magnitude(account.balance) : nil))
    }
    for debt in dataset.debts ?? [] where debt.emi > 0 {
      guard let day = dayNumber(debt.startDate), let due = nextDue(day: day, now: now, calendar: calendar) else { continue }
      candidates.append(GlanceBill(
        name: named(debt.name, fallback: "EMI"),
        dueDate: due,
        kind: .emi,
        amount: includeAmounts ? debt.emi : nil))
    }
    for sip in dataset.sips ?? [] where sip.status == "active" {
      guard let due = nextDue(day: sip.dayOfMonth, now: now, calendar: calendar) else { continue }
      candidates.append(GlanceBill(
        name: named(sip.scheme, fallback: "SIP"),
        dueDate: due,
        kind: .sip,
        amount: includeAmounts ? sip.amount : nil))
    }
    candidates.sort { lhs, rhs in
      if lhs.dueDate != rhs.dueDate { return lhs.dueDate < rhs.dueDate }
      if lhs.kind != rhs.kind { return rank(lhs.kind) < rank(rhs.kind) }
      return lhs.name < rhs.name
    }
    return candidates.first
  }

  private static func trend(_ dataset: Dataset, now: Date, calendar: Calendar) -> GlanceTrend {
    let day = calendar.component(.day, from: now)
    let current = net(dataset, month: monthKey(now, calendar: calendar), throughDay: day)
    guard let previousDate = calendar.date(byAdding: .month, value: -1, to: now) else {
      return direction(current)
    }
    let previousMonth = monthKey(previousDate, calendar: calendar)
    let previousLength = calendar.range(of: .day, in: .month, for: previousDate)?.count ?? day
    let previous = net(dataset, month: previousMonth, throughDay: min(day, previousLength))
    let previousExists = dataset.transactions.contains { $0.date.hasPrefix(previousMonth) }
    return direction(previousExists ? current - previous : current)
  }

  private static func direction(_ delta: Int64) -> GlanceTrend {
    if delta > 0 { return .up }
    if delta < 0 { return .down }
    return .flat
  }

  private static func net(_ dataset: Dataset, month: String, throughDay: Int) -> Int64 {
    dataset.transactions.reduce(0) { total, transaction in
      guard isOnOrBefore(transaction.date, month: month, day: throughDay) else { return total }
      return total + transaction.amount
    }
  }

  /// Next date on or after today for a day-of-month, clamped to short months (31st → 28th in February).
  private static func nextDue(day: Int, now: Date, calendar: Calendar) -> Date? {
    guard (1...31).contains(day) else { return nil }
    let start = calendar.startOfDay(for: now)
    for offset in 0...14 {
      guard let monthDate = calendar.date(byAdding: .month, value: offset, to: start) else { continue }
      var parts = calendar.dateComponents([.year, .month], from: monthDate)
      let length = calendar.range(of: .day, in: .month, for: monthDate)?.count ?? day
      parts.day = min(day, length)
      guard let date = calendar.date(from: parts), date >= start else { continue }
      return date
    }
    return nil
  }

  private static func isOnOrBefore(_ date: String, month: String, day: Int) -> Bool {
    guard date.count >= 10, date.hasPrefix(month) else { return false }
    let start = date.index(date.startIndex, offsetBy: 8)
    let end = date.index(start, offsetBy: 2)
    guard let txDay = Int(date[start..<end]) else { return false }
    return txDay >= 1 && txDay <= day
  }

  private static func dayNumber(_ isoDate: String) -> Int? {
    let parts = isoDate.split(separator: "-")
    guard parts.count >= 3, let day = Int(parts[2]), (1...31).contains(day) else { return nil }
    return day
  }

  private static func monthKey(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month], from: date)
    return String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
  }

  private static func named(_ value: String, fallback: String) -> String {
    let name = GlancePrivacy.displayName(value)
    return name.isEmpty ? fallback : name
  }

  private static func rank(_ kind: GlanceBillKind) -> Int {
    switch kind {
    case .card: 0
    case .emi: 1
    case .sip: 2
    }
  }

  private static func magnitude(_ value: Int64) -> Int64 {
    value < 0 ? -value : value
  }
}
