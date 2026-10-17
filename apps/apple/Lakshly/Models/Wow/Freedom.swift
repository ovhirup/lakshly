import Foundation

struct DebtPayoff: Equatable, Sendable, Identifiable {
  var id: String
  var name: String
  /// `yyyy-MM` of the payment that clears this debt. Nil when it never clears.
  var month: String?
}

struct FreedomPlan: Equatable, Sendable {
  /// Month of the final payment. Nil when a scheduled debt never clears.
  var freedomMonth: String?
  /// Months simulated. The payoff length when `freedomMonth` is set, otherwise the cap (600).
  var months: Int
  var payoffs: [DebtPayoff]
  var totalInterestPaise: Int64
  /// Debts left out of the date: no balance, or no EMI (for example a family loan).
  var unscheduled: [Debt]
}

/// Days until the 1st of the month after a freedom month. A labeled one-element tuple is illegal in Swift.
struct FreedomCountdown: Equatable, Sendable {
  var days: Int
}

/// Pure payoff date. Amounts are paise. No SwiftUI.
enum Freedom {
  static let maxMonths = 600

  /// `yyyy-MM` for `store.reviewNow` (pinned demo clock, or the real clock for My data).
  static func startMonth(now: Date, calendar: Calendar = .current) -> String {
    let parts = calendar.dateComponents([.year, .month], from: now)
    let year = parts.year ?? 1
    let month = min(max(parts.month ?? 1, 1), 12)
    return String(format: "%04d-%02d", year, month)
  }

  /// Only debts with `outstanding > 0` and `emi > 0` are scheduled.
  /// Each month: interest `balance * annualRatePct / 1200` (nearest paise), then the EMI.
  /// `extraPaise`, plus rolled EMIs of debts cleared in earlier months, goes to one avalanche
  /// target (highest rate, then smallest balance). Leftover extra moves to the next target
  /// in the same month. A debt whose EMI never reduces the balance, and which gets no
  /// rescuing extra, leaves `freedomMonth` nil.
  static func simulate(debts: [Debt], from month: String, extraPaise: Int64, rollOver: Bool) -> FreedomPlan {
    let extra = max(Int64(0), extraPaise)
    let unscheduled = debts.filter { $0.outstanding <= 0 || $0.emi <= 0 }
    var slots: [Slot] = debts.compactMap { debt in
      guard debt.outstanding > 0, debt.emi > 0 else { return nil }
      return Slot(
        id: debt.id, name: debt.name, emi: debt.emi, annualRatePct: debt.annualRatePct,
        balance: debt.outstanding, payoff: nil)
    }
    guard parse(month) != nil else {
      return FreedomPlan(
        freedomMonth: nil, months: 0, payoffs: [], totalInterestPaise: 0, unscheduled: debts)
    }
    guard !slots.isEmpty else {
      return FreedomPlan(
        freedomMonth: nil, months: 0, payoffs: [], totalInterestPaise: 0, unscheduled: unscheduled)
    }

    var totalInterest = Int64(0)
    var rolled = Int64(0)
    var freedomMonth: String?
    var monthsRun = 0

    for offset in 0..<maxMonths {
      guard let current = shift(month, by: offset) else { break }
      monthsRun = offset + 1

      for index in slots.indices where slots[index].balance > 0 {
        let interest = interestPaise(slots[index].balance, rate: slots[index].annualRatePct)
        totalInterest = add(totalInterest, interest)
        let owed = add(slots[index].balance, interest)
        let payment = min(owed, slots[index].emi)
        slots[index].balance = owed - payment
        if slots[index].balance == 0 { slots[index].payoff = current }
      }

      var pool = add(extra, rollOver ? rolled : 0)
      while pool > 0 {
        guard let target = avalancheIndex(slots) else { break }
        let payment = min(pool, slots[target].balance)
        if payment == 0 { break }
        slots[target].balance -= payment
        pool -= payment
        if slots[target].balance == 0 { slots[target].payoff = current }
      }

      if slots.allSatisfy({ $0.balance == 0 }) {
        freedomMonth = current
        break
      }
      if rollOver {
        rolled = slots.reduce(Int64(0)) { slot, item in
          item.balance == 0 ? add(slot, item.emi) : slot
        }
      }
    }

    return FreedomPlan(
      freedomMonth: freedomMonth,
      months: monthsRun,
      payoffs: slots.map { DebtPayoff(id: $0.id, name: $0.name, month: $0.payoff) },
      totalInterestPaise: totalInterest,
      unscheduled: unscheduled)
  }

  /// Months the what-if date sits ahead of the baseline. Zero when either date is missing.
  static func pullIn(baseline: FreedomPlan, whatIf: FreedomPlan) -> Int {
    guard let base = baseline.freedomMonth, let faster = whatIf.freedomMonth,
      let baseIndex = monthIndex(base), let fasterIndex = monthIndex(faster)
    else { return 0 }
    return max(0, baseIndex - fasterIndex)
  }

  /// Interest the what-if plan avoids, in paise. Never negative.
  static func interestSaved(baseline: FreedomPlan, whatIf: FreedomPlan) -> Int64 {
    max(0, baseline.totalInterestPaise - whatIf.totalInterestPaise)
  }

  /// `sum(principal - outstanding) / sum(principal)` across every debt. Zero when there is no principal.
  static func clearedFraction(debts: [Debt]) -> Double {
    let principal = debts.reduce(Int64(0)) { $0 + $1.principal }
    guard principal > 0 else { return 0 }
    let cleared = debts.reduce(Int64(0)) { $0 + ($1.principal - $1.outstanding) }
    return Double(cleared) / Double(principal)
  }

  /// Days from `now` until the 1st of the month after `month`, in the current calendar. Never negative.
  static func countdown(to month: String, now: Date) -> FreedomCountdown {
    guard let next = shift(month, by: 1) else { return FreedomCountdown(days: 0) }
    let parts = next.split(separator: "-")
    guard parts.count == 2, let year = Int(parts[0]), let monthNumber = Int(parts[1]) else {
      return FreedomCountdown(days: 0)
    }
    var date = DateComponents()
    date.year = year
    date.month = monthNumber
    date.day = 1
    let calendar = Calendar.current
    guard let target = calendar.date(from: date) else { return FreedomCountdown(days: 0) }
    let days = calendar.dateComponents(
      [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: target)
    ).day ?? 0
    return FreedomCountdown(days: max(0, days))
  }

  static func message(pullIn months: Int) -> String {
    switch months {
    case ..<1:
      return "Steady and sure, the tortoise also won 🐢"
    case 1:
      return "1 month sooner, nice nudge 🎉"
    case 2...5:
      return "\(months) months sooner, nice nudge 🎉"
    case 6...11:
      return "\(months) months sooner, half a year back in your pocket 🚀"
    default:
      return "\(months) months sooner, freedom speedrun unlocked 🏁"
    }
  }

  /// ₹500, in paise. The what-if slider steps by this.
  static let extraStepPaise: Int64 = 50_000

  /// Slider ceiling: 2× the scheduled EMI, rounded up to a ₹500 step, and never below ₹500.
  /// Scheduled means outstanding and EMI are both above zero.
  static func extraSliderMaximum(debts: [Debt]) -> Int64 {
    let step = extraStepPaise
    let doubled = saturatingDouble(scheduledEMI(debts))
    return max(step, ceilToStep(doubled, step: step))
  }

  /// True when a scheduled EMI is at or below one month of interest, so the balance never falls.
  static func emiDoesNotCoverInterest(_ debt: Debt) -> Bool {
    guard debt.outstanding > 0, debt.emi > 0 else { return false }
    return debt.emi <= interestPaise(debt.outstanding, rate: debt.annualRatePct)
  }

  private struct Slot {
    var id: String
    var name: String
    var emi: Int64
    var annualRatePct: Double
    var balance: Int64
    var payoff: String?
  }

  private static func avalancheIndex(_ slots: [Slot]) -> Int? {
    var best: Int?
    for (index, slot) in slots.enumerated() where slot.balance > 0 {
      guard let chosen = best else {
        best = index
        continue
      }
      let current = slots[chosen]
      if slot.annualRatePct > current.annualRatePct
        || (slot.annualRatePct == current.annualRatePct && slot.balance < current.balance) {
        best = index
      }
    }
    return best
  }

  /// Nearest paise, half away from zero. Matches the reducing-balance formula in Debt.
  private static func interestPaise(_ balance: Int64, rate annualRatePct: Double) -> Int64 {
    guard balance > 0, annualRatePct > 0 else { return 0 }
    let raw = Double(balance) * annualRatePct / 1200
    guard raw.isFinite, raw > 0 else { return 0 }
    if raw >= Double(Int64.max) { return Int64.max }
    return Int64(raw.rounded())
  }

  private static func add(_ lhs: Int64, _ rhs: Int64) -> Int64 {
    let (sum, overflow) = lhs.addingReportingOverflow(rhs)
    return overflow ? Int64.max : sum
  }

  private static func scheduledEMI(_ debts: [Debt]) -> Int64 {
    debts.reduce(Int64(0)) { sum, debt in
      guard debt.outstanding > 0, debt.emi > 0 else { return sum }
      return add(sum, debt.emi)
    }
  }

  private static func saturatingDouble(_ value: Int64) -> Int64 {
    guard value > 0 else { return 0 }
    if value > Int64.max / 2 { return Int64.max }
    return value * 2
  }

  /// Smallest multiple of `step` that is at least `value`. Zero stays zero.
  private static func ceilToStep(_ value: Int64, step: Int64) -> Int64 {
    guard value > 0, step > 0 else { return 0 }
    let remainder = value % step
    if remainder == 0 { return value }
    let gap = step - remainder
    if value > Int64.max - gap { return (Int64.max / step) * step }
    return value + gap
  }

  private static func parse(_ text: String) -> (year: Int, month: Int)? {
    let parts = text.split(separator: "-", omittingEmptySubsequences: false)
    guard parts.count == 2, let year = Int(parts[0]), let month = Int(parts[1]),
      year > 0, (1...12).contains(month)
    else { return nil }
    return (year, month)
  }

  private static func monthIndex(_ text: String) -> Int? {
    guard let parsed = parse(text) else { return nil }
    return parsed.year * 12 + (parsed.month - 1)
  }

  private static func shift(_ text: String, by offset: Int) -> String? {
    guard let index = monthIndex(text) else { return nil }
    let next = index + offset
    guard next >= 0 else { return nil }
    return String(format: "%04d-%02d", next / 12, next % 12 + 1)
  }
}
