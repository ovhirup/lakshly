import Foundation

enum FeeRunwayStatus: String, Equatable, Sendable {
  case funded
  case onTrack
  case behind
}

struct RunwayFee: Equatable, Identifiable, Sendable {
  var id: String
  var name: String
  var amount: Int64
  var due: String
  var yearly: Bool
  var monthsLeft: Int
  var daysLeft: Int
  var toGoPaise: Int64
  var perMonthPaise: Int64
  var fraction: Double
  var status: FeeRunwayStatus
  var setAside: Int64
}

struct RunwayPlan: Equatable, Sendable {
  var fees: [RunwayFee]
  var monthlyNeedPaise: Int64
  var totalPaise: Int64
  var fundedPaise: Int64
  var fundedFraction: Double
}

struct FeeLogResult: Equatable, Sendable {
  var setAside: [String: Int64]
  var fundedNow: Bool
  var changed: Bool
}

/// Yearly-fee runway. Amounts are paise. No SwiftUI.
enum FeeRunway {
  static let potMax: Int64 = 1_000_000_000_000

  static func plan(fees: [WowFee], setAside: [String: Int64], now: Date, calendar: Calendar = .current) -> RunwayPlan {
    let ready = prepared(fees: fees, setAside: setAside, now: now, calendar: calendar)
    let today = anchor(now, calendar: calendar)
    let rows: [RunwayFee] = ready.fees.map { fee in
      row(fee, pot: max(0, ready.setAside[fee.id] ?? 0), today: today, calendar: calendar)
    }.sorted { lhs, rhs in
      if lhs.due != rhs.due { return lhs.due < rhs.due }
      if lhs.name != rhs.name { return lhs.name < rhs.name }
      return lhs.id < rhs.id
    }
    let monthly = rows.reduce(Int64(0)) { $0 + $1.perMonthPaise }
    let total = rows.reduce(Int64(0)) { $0 + max(0, $1.amount) }
    let funded = rows.reduce(Int64(0)) { $0 + min(max(0, $1.setAside), max(0, $1.amount)) }
    let share = total > 0 ? Double(funded) / Double(total) : 0
    return RunwayPlan(
      fees: rows, monthlyNeedPaise: monthly, totalPaise: total, fundedPaise: funded, fundedFraction: share)
  }

  /// Adds `paise` into the pot. Ignores values below 1. The pot stays inside 0...1e12.
  /// `fundedNow` is true only on the add that first reaches the fee amount.
  static func log(fees: [WowFee], setAside: [String: Int64], feeId: String, paise: Int64) -> FeeLogResult {
    guard paise > 0, let fee = fees.first(where: { $0.id == feeId }) else {
      return FeeLogResult(setAside: setAside, fundedNow: false, changed: false)
    }
    let before = clampPot(setAside[feeId] ?? 0)
    let room = potMax - before
    let next = before + min(paise, room)
    var pots = setAside
    pots[feeId] = next
    let fundedNow = before < fee.amount && next >= fee.amount
    return FeeLogResult(setAside: pots, fundedNow: fundedNow, changed: next != (setAside[feeId] ?? 0))
  }

  static func reset(setAside: [String: Int64], feeId: String) -> [String: Int64] {
    var pots = setAside
    pots[feeId] = 0
    return pots
  }

  /// Detected fees. They stay suggestions until the caller adds them.
  static func suggestions(
    transactions: [Transaction], now: Date, fees: [WowFee] = [], calendar: Calendar = .current
  ) -> [WowFee] {
    let today = anchor(now, calendar: calendar)
    let takenIDs = Set(fees.map(\.id))
    let takenSlugs = Set(fees.map { slug($0.name) })
    var bands: [String: FeeBand] = [:]
    for txn in transactions where isFeeSpend(txn) {
      let name = display(txn)
      let group = slug(name)
      guard !group.isEmpty else { continue }
      var band = bands[group] ?? FeeBand(name: name, dates: [], lastDate: "", lastAmount: 0)
      band.dates.append(txn.date)
      if band.lastDate.isEmpty || txn.date >= band.lastDate {
        band.lastDate = txn.date
        band.lastAmount = magnitude(txn.amount)
        band.name = name
      }
      bands[group] = band
    }
    var found: [WowFee] = []
    for (group, band) in bands {
      let id = "sugg-\(group)"
      if takenIDs.contains(id) || takenSlugs.contains(group) { continue }
      guard qualifies(band, today: today, calendar: calendar) else { continue }
      guard let due = addYears(1, to: band.lastDate, calendar: calendar) else { continue }
      found.append(WowFee(id: id, name: band.name, amount: band.lastAmount, due: due, yearly: true))
    }
    return found.sorted { lhs, rhs in
      if lhs.due != rhs.due { return lhs.due < rhs.due }
      return lhs.id < rhs.id
    }
  }

  /// Three synthetic yearly fees placed against `now`. Paise, demo names only.
  static func demoSeed(now: Date, calendar: Calendar = .current) -> (fees: [WowFee], setAside: [String: Int64]) {
    let rows: [(id: String, name: String, rupees: Int64, months: Int, savedRupees: Int64)] = [
      ("demo-car-insurance", "Demo Car Insurance", 14_500, 4, 9_000),
      ("sample-card-annual-fee", "Sample Card Co annual fee", 2_999, 7, 0),
      ("example-professional-licence", "Example Professional Licence", 9_000, 11, 2_000),
    ]
    var fees: [WowFee] = []
    var setAside: [String: Int64] = [:]
    for row in rows {
      let due = format(calendar.date(byAdding: .month, value: row.months, to: now) ?? now, calendar: calendar)
      fees.append(WowFee(id: row.id, name: row.name, amount: row.rupees * 100, due: due, yearly: true))
      setAside[row.id] = row.savedRupees * 100
    }
    return (fees, setAside)
  }

  private struct FeeBand {
    var name: String
    var dates: [String]
    var lastDate: String
    var lastAmount: Int64
  }

  private static let hints = ["annual fee", "renewal", "membership", "licence", "license", "premium"]

  private static func prepared(
    fees: [WowFee], setAside: [String: Int64], now: Date, calendar: Calendar
  ) -> (fees: [WowFee], setAside: [String: Int64]) {
    let today = anchor(now, calendar: calendar)
    var pots = setAside
    var kept: [WowFee] = []
    for fee in fees {
      guard var dueDate = day(fee.due, calendar: calendar) else { continue }
      var copy = fee
      var drop = false
      var hops = 0
      while dueDate < today {
        if !copy.yearly {
          drop = true
          break
        }
        hops += 1
        if hops > 30 { drop = true; break }
        guard let next = calendar.date(byAdding: .year, value: 1, to: dueDate), next != dueDate else {
          drop = true
          break
        }
        dueDate = next
        let pot = pots[copy.id] ?? 0
        pots[copy.id] = pot > copy.amount ? pot - copy.amount : 0
      }
      if drop {
        pots[copy.id] = nil
        continue
      }
      copy.due = format(dueDate, calendar: calendar)
      kept.append(copy)
    }
    return (kept, pots)
  }

  private static func row(_ fee: WowFee, pot: Int64, today: Date, calendar: Calendar) -> RunwayFee {
    let dueDate = day(fee.due, calendar: calendar) ?? today
    let months = calendar.dateComponents([.month], from: today, to: dueDate).month ?? 0
    let monthsLeft = max(1, months)
    let days = calendar.dateComponents([.day], from: today, to: dueDate).day ?? 0
    let daysLeft = max(0, days)
    let amount = max(0, fee.amount)
    let toGo = max(0, amount - pot)
    let perMonth = ceilDivide(toGo, monthsLeft)
    let fraction = amount > 0 ? min(1, Double(pot) / Double(amount)) : 1
    let expected = expectedPaise(amount: amount, due: dueDate, yearly: fee.yearly, today: today, calendar: calendar)
    let status: FeeRunwayStatus
    if pot >= amount {
      status = .funded
    } else if pot >= expected {
      status = .onTrack
    } else {
      status = .behind
    }
    return RunwayFee(
      id: fee.id, name: fee.name, amount: fee.amount, due: fee.due, yearly: fee.yearly,
      monthsLeft: monthsLeft, daysLeft: daysLeft, toGoPaise: toGo, perMonthPaise: perMonth,
      fraction: fraction, status: status, setAside: pot)
  }

  /// For a yearly fee, the share of the 12 months before due that has already elapsed. Otherwise 0.
  private static func expectedPaise(
    amount: Int64, due: Date, yearly: Bool, today: Date, calendar: Calendar
  ) -> Int64 {
    guard yearly, amount > 0 else { return 0 }
    guard let start = calendar.date(byAdding: .month, value: -12, to: due) else { return 0 }
    let total = calendar.dateComponents([.day], from: start, to: due).day ?? 0
    guard total > 0 else { return 0 }
    let elapsed = calendar.dateComponents([.day], from: start, to: today).day ?? 0
    if elapsed <= 0 { return 0 }
    if elapsed >= total { return amount }
    return amount * Int64(elapsed) / Int64(total)
  }

  private static func qualifies(_ band: FeeBand, today: Date, calendar: Calendar) -> Bool {
    let unique = Array(Set(band.dates.filter { day($0, calendar: calendar) != nil })).sorted()
    guard let last = unique.last else { return false }
    if unique.count >= 2 {
      let previous = unique[unique.count - 2]
      guard let gap = dayGap(from: previous, to: last, calendar: calendar) else { return false }
      return (300...400).contains(gap)
    }
    guard let charge = day(last, calendar: calendar),
      let cutoff = calendar.date(byAdding: .month, value: -9, to: today)
    else { return false }
    return charge < cutoff
  }

  private static func isFeeSpend(_ txn: Transaction) -> Bool {
    guard txn.amount < 0 else { return false }
    if txn.category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "insurance" { return true }
    let merchant = txn.merchant ?? ""
    let blob = (merchant + " " + txn.description).lowercased()
    return hints.contains { blob.contains($0) }
  }

  private static func display(_ txn: Transaction) -> String {
    let merchant = txn.merchant?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !merchant.isEmpty { return merchant }
    return txn.description.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func slug(_ raw: String) -> String {
    var out = ""
    var dash = false
    for scalar in raw.lowercased().unicodeScalars {
      if CharacterSet.alphanumerics.contains(scalar) {
        out.unicodeScalars.append(scalar)
        dash = false
      } else if !dash && !out.isEmpty {
        out.append("-")
        dash = true
      }
    }
    while out.hasSuffix("-") { out.removeLast() }
    return out
  }

  private static func ceilDivide(_ numerator: Int64, _ denominator: Int) -> Int64 {
    if numerator <= 0 { return 0 }
    let span = Int64(max(denominator, 1))
    return (numerator - 1) / span + 1
  }

  private static func clampPot(_ value: Int64) -> Int64 {
    min(max(value, 0), potMax)
  }

  private static func magnitude(_ value: Int64) -> Int64 {
    if value == .min { return .max }
    return value < 0 ? -value : value
  }

  private static func dayGap(from earlier: String, to later: String, calendar: Calendar) -> Int? {
    guard let start = day(earlier, calendar: calendar), let end = day(later, calendar: calendar) else { return nil }
    return calendar.dateComponents([.day], from: start, to: end).day
  }

  private static func addYears(_ years: Int, to ymd: String, calendar: Calendar) -> String? {
    guard let due = day(ymd, calendar: calendar),
      let shifted = calendar.date(byAdding: .year, value: years, to: due)
    else { return nil }
    return format(shifted, calendar: calendar)
  }

  private static func day(_ ymd: String, calendar: Calendar) -> Date? {
    let bits = ymd.split(separator: "-").compactMap { Int($0) }
    guard bits.count >= 3 else { return nil }
    return calendar.date(from: DateComponents(year: bits[0], month: bits[1], day: bits[2], hour: 12))
  }

  private static func anchor(_ date: Date, calendar: Calendar) -> Date {
    let bits = calendar.dateComponents([.year, .month, .day], from: date)
    return calendar.date(from: DateComponents(year: bits.year, month: bits.month, day: bits.day, hour: 12)) ?? date
  }

  private static func format(_ date: Date, calendar: Calendar) -> String {
    let bits = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", bits.year ?? 0, bits.month ?? 1, bits.day ?? 1)
  }
}
