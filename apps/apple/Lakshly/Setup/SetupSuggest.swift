import Foundation

let variableCategories = [
  "groceries", "dining", "shopping", "entertainment", "travel", "transport", "fuel", "gifts", "other", "subscriptions",
]

/// Gregorian UTC date math that matches `Date.UTC` / `toISOString`, including day overflow.
enum SetupISO {
  static func ymd(_ text: String) -> (y: Int, m: Int, d: Int) {
    let bytes = Array(text.utf8)
    func num(_ start: Int, _ count: Int) -> Int {
      var value = 0
      for index in start..<(start + count) { value = value * 10 + Int(bytes[index] - 48) }
      return value
    }
    return (num(0, 4), num(5, 2), num(8, 2))
  }

  static func ymdString(y: Int, m: Int, d: Int) -> String {
    String(format: "%04d-%02d-%02d", y, m, d)
  }

  static func daysFromCivil(y yearIn: Int, m month: Int, d day: Int) -> Int64 {
    var year = yearIn
    if month <= 2 { year -= 1 }
    let era = (year >= 0 ? year : year - 399) / 400
    let yoe = year - era * 400
    let doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return Int64(era) * 146097 + Int64(doe) - 719468
  }

  static func civilFromDays(_ dayNumber: Int64) -> (y: Int, m: Int, d: Int) {
    let z = dayNumber + 719468
    let era = (z >= 0 ? z : z - 146096) / 146097
    let doe = Int(z - era * 146097)
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    var year = yoe + Int(era) * 400
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    let mp = (5 * doy + 2) / 153
    let day = doy - (153 * mp + 2) / 5 + 1
    var month = mp + (mp < 10 ? 3 : -9)
    if month <= 2 { year += 1 }
    return (year, month, day)
  }

  static func unixMillis(y: Int, m: Int, d: Int, hh: Int = 0, mm: Int = 0, ss: Int = 0, ms: Int = 0) -> Int64 {
    daysFromCivil(y: y, m: m, d: d) * 86_400_000
      + Int64(hh) * 3_600_000
      + Int64(mm) * 60_000
      + Int64(ss) * 1_000
      + Int64(ms)
  }

  static func parts(from millis: Int64) -> (y: Int, m: Int, d: Int, hh: Int, mm: Int, ss: Int, millis: Int) {
    var days = millis / 86_400_000
    var rem = millis % 86_400_000
    if rem < 0 {
      rem += 86_400_000
      days -= 1
    }
    let hh = Int(rem / 3_600_000)
    rem %= 3_600_000
    let minute = Int(rem / 60_000)
    rem %= 60_000
    let ss = Int(rem / 1_000)
    let date = civilFromDays(days)
    return (date.y, date.m, date.d, hh, minute, ss, Int(rem % 1_000))
  }

  static func dayMillis(_ text: String) -> Int64 {
    let date = ymd(text)
    return unixMillis(y: date.y, m: date.m, d: date.d)
  }

  static func addDays(_ text: String, days: Int) -> String {
    let date = ymd(text)
    let shifted = parts(from: unixMillis(y: date.y, m: date.m, d: date.d) + Int64(days) * 86_400_000)
    return ymdString(y: shifted.y, m: shifted.m, d: shifted.d)
  }

  /// February clamps to the 28th. Other months keep the day. Matches `addYears` in suggest.ts.
  static func addYears(_ text: String, n: Int = 1) -> String {
    let date = ymd(text)
    let day = date.m == 2 ? min(date.d, 28) : date.d
    return ymdString(y: date.y + n, m: date.m, d: day)
  }

  /// `Date.UTC(year, month + 1, day)`, so a day past the month length rolls forward.
  static func monthAfter(_ text: String, day: Int) -> String {
    let date = ymd(text)
    var year = date.y
    var month = date.m + 1
    if month > 12 {
      month = 1
      year += 1
    }
    let shifted = parts(from: unixMillis(y: year, m: month, d: 1) + Int64(day - 1) * 86_400_000)
    return ymdString(y: shifted.y, m: shifted.m, d: shifted.d)
  }

  static func parseIntPrefix(_ text: String) -> Int {
    var value = 0
    var any = false
    for character in text {
      guard let digit = character.wholeNumberValue else { break }
      any = true
      value = value * 10 + digit
    }
    return any ? value : 0
  }

  static func splitOffset(_ iso: String) -> (local: String, label: String, minutes: Int) {
    if iso.hasSuffix("Z") { return (String(iso.dropLast()), "Z", 0) }
    guard iso.count >= 6 else { return (iso, "Z", 0) }
    let signIndex = iso.index(iso.endIndex, offsetBy: -6)
    let sign = iso[signIndex]
    guard sign == "+" || sign == "-", iso[iso.index(signIndex, offsetBy: 3)] == ":" else { return (iso, "Z", 0) }
    let label = String(iso[signIndex...])
    let hours = Int(label.dropFirst().prefix(2)) ?? 0
    let mins = Int(label.suffix(2)) ?? 0
    let magnitude = hours * 60 + mins
    return (String(iso[..<signIndex]), label, sign == "-" ? -magnitude : magnitude)
  }

  /// Parse a local clock `YYYY-MM-DDTHH:mm:ss[.sss]` as if it were UTC.
  static func parseClock(_ local: String) -> Int64 {
    let date = ymd(local)
    let time = local[local.index(local.startIndex, offsetBy: 11)...]
    func take(_ offset: Int) -> Int {
      let start = time.index(time.startIndex, offsetBy: offset)
      return Int(time[start..<time.index(start, offsetBy: 2)]) ?? 0
    }
    var millis = 0
    if let dot = time.firstIndex(of: ".") {
      let digits = String(time[time.index(after: dot)...].prefix(3))
      if let value = Int(digits) {
        if digits.count == 3 { millis = value }
        else if digits.count == 2 { millis = value * 10 }
        else { millis = value * 100 }
      }
    }
    return unixMillis(y: date.y, m: date.m, d: date.d, hh: take(0), mm: take(3), ss: take(6), ms: millis)
  }

  static func parseInstantMillis(_ iso: String) -> Int64? {
    let parts = splitOffset(iso)
    guard parts.local.count >= 19 else { return nil }
    return parseClock(parts.local) - Int64(parts.minutes) * 60_000
  }

  /// Subtract whole days in the timestamp's stated offset. Milliseconds survive; `.000` is omitted.
  static func subtractDaysWithOffset(_ now: String, days: Int) -> String {
    let parts = splitOffset(now)
    let shifted = self.parts(from: parseClock(parts.local) - Int64(days) * 86_400_000)
    var text = String(format: "%04d-%02d-%02dT%02d:%02d:%02d", shifted.y, shifted.m, shifted.d, shifted.hh, shifted.mm, shifted.ss)
    if shifted.millis != 0 { text += String(format: ".%03d", shifted.millis) }
    return text + parts.label
  }

  /// Date prefix of an ISO timestamp (`now.slice(0, 10)`), the calendar day written in that offset.
  static func todayPrefix(_ isoNow: String) -> String {
    String(isoNow.prefix(10))
  }

  /// Device calendar day. Tests pass an Asia/Kolkata calendar and a fixed instant.
  static func today(instant: Date, calendar: Calendar = .current) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: instant)
    return ymdString(y: parts.year ?? 0, m: parts.month ?? 0, d: parts.day ?? 0)
  }
}

func addYears(_ text: String, _ n: Int = 1) -> String {
  SetupISO.addYears(text, n: n)
}

struct SetupTransaction: Codable, Equatable {
  var id: String
  var date: String
  var amount: Int64
  var category: String
  var merchant: String?
  var tags: [String]?
}

struct SetupAccountBalance: Codable, Equatable {
  var type: String
  var balance: Int64
}

struct SetupBudgetRef: Codable, Equatable {
  var id: String?
  var month: String
  var category: String?
  var limit: Int64?
  var rollover: Bool?
}

struct SetupGoalRef: Codable, Equatable {
  var id: String
}

struct SetupDataset: Codable, Equatable {
  var transactions: [SetupTransaction]
  var accounts: [SetupAccountBalance]?
  var budgets: [SetupBudgetRef]?
  var goals: [SetupGoalRef]?
}

struct BudgetLine: Codable, Equatable {
  var id: String
  var month: String
  var category: String
  var limit: Int64
  var rollover: Bool
}

struct SuggestedBudgetLine: Codable, Equatable {
  var id: String
  var month: String
  var category: String
  var limit: Int64
  var median: Int64
  var rollover: Bool
}

struct BudgetSuggestion: Codable, Equatable {
  var mode: String
  var confidence: String?
  var months: [String]
  var factorPct: Int?
  var dropped: [String]?
  var lines: [SuggestedBudgetLine]
  var total: Int64?
}

enum GoalKind: String, Codable, Equatable {
  case emergency, sinking, custom
}

struct GoalSuggestion: Codable, Equatable {
  var rule: String
  var kind: GoalKind
  var name: String
  var target: Int64?
  var saved: Int64?
  var monthly: Int64?
  var due: String?
  var monthsCovered: Double?
  var medianMonthlySpend: Int64?
  var fromTransaction: String?
  var monthsLeft: Int?
}

struct SetupGoal: Codable, Equatable {
  var id: String
  var name: String
  var kind: GoalKind
  var target: Int64
  var saved: Int64
  var monthly: Int64
  var due: String
  var createdAt: String
  var createdBy: String
}

func isOut(_ transaction: SetupTransaction) -> Bool {
  transaction.amount < 0 && !(transaction.tags ?? []).contains { $0 == "refund" || $0 == "big-ticket" }
}

func completeMonths(_ dataset: SetupDataset, today: String) -> [String] {
  let dates = dataset.transactions.map(\.date).sorted()
  guard let first = dates.first else { return [] }
  let start = SetupISO.ymd(first)
  var year = start.y
  var month = start.m
  if start.d > 5 {
    month += 1
    if month > 12 {
      month = 1
      year += 1
    }
  }
  let end = String(today.prefix(7))
  var result: [String] = []
  while true {
    let key = String(format: "%04d-%02d", year, month)
    if key >= end { break }
    result.append(key)
    month += 1
    if month > 12 {
      month = 1
      year += 1
    }
  }
  return result.count > 3 ? Array(result.suffix(3)) : result
}

private func median(_ values: [Int64]) -> Int64 {
  guard !values.isEmpty else { return 0 }
  let sorted = values.sorted()
  let low = sorted[(sorted.count - 1) / 2]
  let high = sorted[sorted.count / 2]
  return (low + high) / 2
}

private func ceilTo(_ value: Int64, _ step: Int64) -> Int64 {
  if step == 0 || value <= 0 { return value > 0 ? value : 0 }
  return ((value + step - 1) / step) * step
}

func suggestBudget(_ dataset: SetupDataset, today: String, factorPct: Int = 95) -> BudgetSuggestion {
  let months = completeMonths(dataset, today: today)
  if months.isEmpty {
    return BudgetSuggestion(mode: "starter", confidence: nil, months: months, factorPct: nil, dropped: nil, lines: [], total: nil)
  }
  let candidates = variableCategories.map { category -> (category: String, median: Int64) in
    let spends = months.map { month -> Int64 in
      dataset.transactions.reduce(Int64(0)) { total, transaction in
        guard isOut(transaction), transaction.category == category, String(transaction.date.prefix(7)) == month else { return total }
        return total - transaction.amount
      }
    }
    return (category, median(spends))
  }
  .filter { $0.median >= 50_000 }
  .sorted { lhs, rhs in
    if lhs.median != rhs.median { return lhs.median > rhs.median }
    return lhs.category < rhs.category
  }
  let monthKey = String(today.prefix(7))
  let stamp = monthKey.replacingOccurrences(of: "-", with: "")
  let lines = candidates.prefix(6).map { candidate -> SuggestedBudgetLine in
    let scaled = candidate.median * Int64(factorPct)
    let step: Int64 = scaled >= 500_000 * 100 ? 50_000 : 10_000
    let limit = ((scaled + step * 50) / (step * 100)) * step
    return SuggestedBudgetLine(
      id: "bud_\(stamp)\(candidate.category)",
      month: monthKey,
      category: candidate.category,
      limit: limit,
      median: candidate.median,
      rollover: false
    )
  }
  return BudgetSuggestion(
    mode: "history",
    confidence: months.count >= 2 ? "ok" : "low",
    months: months,
    factorPct: factorPct,
    dropped: candidates.dropFirst(6).map(\.category),
    lines: lines,
    total: lines.reduce(Int64(0)) { $0 + $1.limit }
  )
}

func suggestGoal(_ dataset: SetupDataset, today: String) -> GoalSuggestion {
  let months = completeMonths(dataset, today: today)
  let med: Int64 = months.isEmpty ? 0 : median(months.map { month in
    dataset.transactions.reduce(Int64(0)) { total, transaction in
      guard isOut(transaction), !["income", "transfers", "investments"].contains(transaction.category), String(transaction.date.prefix(7)) == month else {
        return total
      }
      return total - transaction.amount
    }
  })
  let liquid = (dataset.accounts ?? []).reduce(Int64(0)) { total, account in
    guard ["savings", "current", "cash", "fixed_deposit"].contains(account.type), account.balance > 0 else { return total }
    return total + account.balance
  }
  let cover10: Int64? = med == 0 ? nil : (liquid * 10) / med
  func emergency(_ monthsCovered: Int64, rule: String) -> GoalSuggestion {
    let target = ceilTo(monthsCovered * med, 1_000_000)
    let saved = min(liquid, target)
    let monthly: Int64 = target > saved ? max(50_000, ceilTo(max(target - saved, 0) / 12, 10_000)) : 0
    return GoalSuggestion(
      rule: rule,
      kind: .emergency,
      name: "Emergency fund · \(monthsCovered) months",
      target: target,
      saved: saved,
      monthly: monthly,
      due: addYears(today),
      monthsCovered: cover10.map { Double($0) / 10 },
      medianMonthlySpend: med,
      fromTransaction: nil,
      monthsLeft: nil
    )
  }
  if months.isEmpty {
    return GoalSuggestion(rule: "custom", kind: .custom, name: "Something that matters to you")
  }
  if (cover10 ?? 0) < 30 { return emergency(3, rule: "emergency3") }
  let cutoff = SetupISO.addDays(today, days: -365)
  let annual: Set<String> = ["insurance", "fees", "subscriptions", "education"]
  let order = dataset.transactions.indices.sorted { dataset.transactions[$0].date > dataset.transactions[$1].date }
  for index in order {
    let transaction = dataset.transactions[index]
    if !annual.contains(transaction.category) || !isOut(transaction) || -transaction.amount < 500_000 || transaction.date < cutoff { continue }
    let prior = dataset.transactions.indices.contains { otherIndex in
      guard otherIndex != index else { return false }
      let other = dataset.transactions[otherIndex]
      guard other.merchant == transaction.merchant else { return false }
      let delta = SetupISO.dayMillis(transaction.date) - SetupISO.dayMillis(other.date)
      return delta > 0 && delta <= 300 * 86_400_000
    }
    let due = addYears(transaction.date)
    if !prior && due > today && due <= addYears(today) {
      let left = wholeMonths(from: today, to: due)
      let target = ceilTo(-transaction.amount, 100_000)
      let perMonth = left == 0 ? target : (target + Int64(left) - 1) / Int64(left)
      return GoalSuggestion(
        rule: "annualPayment",
        kind: .sinking,
        name: "\(transaction.merchant ?? "undefined") renewal",
        target: target,
        saved: 0,
        monthly: ceilTo(perMonth, 10_000),
        due: due,
        monthsCovered: Double(cover10 ?? 0) / 10,
        medianMonthlySpend: med,
        fromTransaction: transaction.id,
        monthsLeft: left
      )
    }
  }
  if (cover10 ?? 0) < 60 { return emergency(6, rule: "emergency6") }
  return GoalSuggestion(rule: "custom", kind: .custom, name: "Something that matters to you")
}

private func wholeMonths(from today: String, to due: String) -> Int {
  let start = SetupISO.ymd(today)
  let end = SetupISO.ymd(due)
  var left = (end.y - start.y) * 12 + (end.m - start.m)
  if end.d < start.d { left -= 1 }
  return max(left, 1)
}

func goalFromSuggestion(_ dataset: SetupDataset, today: String, now: String) -> SetupGoal? {
  let suggestion = suggestGoal(dataset, today: today)
  guard let target = suggestion.target, let due = suggestion.due else { return nil }
  return SetupGoal(
    id: "goal_setup01",
    name: suggestion.name,
    kind: suggestion.kind,
    target: target,
    saved: suggestion.saved ?? 0,
    monthly: suggestion.monthly ?? 0,
    due: due,
    createdAt: now,
    createdBy: "setup"
  )
}
