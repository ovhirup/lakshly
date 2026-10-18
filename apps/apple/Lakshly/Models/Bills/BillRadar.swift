import Foundation

extension FeatureLimit {
  /// Bridges the tier API (`Int.max` = unlimited) to the planner limit.
  init(tierLimit: Int) { self = tierLimit == .max ? .unlimited : .count(max(0, tierLimit)) }
}

struct BillAlert: Equatable, Sendable {
  var id: String { "lakshly.bill.\(billId)" }
  var billId: String
  var fireAt: Date
  var title: String
  var body: String
}

enum BillRadar {
  static let horizonDays = 45

  static func build(
    accounts: [Account], debts: [Debt], sips: [SIP], fees: [WowFee],
    subscriptions: [SubscriptionItem], plannedCancels: Set<String>, state: BillRadarState,
    now: Date, calendar: Calendar = .current
  ) -> [RadarBill] {
    let today = calendar.startOfDay(for: now)
    var bills: [RadarBill] = []
    let paid = Set(state.paid)
    let muted = Set(state.muted)
    func append(_ sourceId: String, _ kind: BillKind, _ name: String, _ due: Date?, _ amount: Int64?) {
      guard let due else { return }
      let days = calendar.dateComponents([.day], from: today, to: due).day ?? -1
      guard (0...horizonDays).contains(days) else { return }
      var bill = RadarBill(
        sourceId: sourceId, kind: kind, name: name, due: ymd(due, calendar: calendar),
        daysLeft: days, amount: amount, paid: false, muted: muted.contains("\(kind.rawValue):\(sourceId)"))
      bill.paid = paid.contains(bill.id)
      bills.append(bill)
    }
    for account in accounts where account.type == "credit_card" {
      guard account.balance != 0 || account.dueDay != nil else { continue }
      let amount = account.balance == .min ? Int64.max : Int64(account.balance.magnitude)
      append(account.id, .card, account.name, nextDue(account.dueDay ?? 1, today: today, calendar: calendar), amount)
    }
    for debt in debts where debt.emi > 0 && debt.outstanding > 0 {
      guard let day = Int(debt.startDate.split(separator: "-").last ?? "") else { continue }
      append(debt.id, .emi, debt.name, nextDue(day, today: today, calendar: calendar), debt.emi)
    }
    for sip in sips where sip.status == "active" {
      append(sip.id, .sip, sip.scheme, nextDue(sip.dayOfMonth, today: today, calendar: calendar), sip.amount)
    }
    // FeeRunway owns annual roll-forward, including leap-day behaviour and expired one-off fees.
    for fee in FeeRunway.plan(fees: fees, setAside: [:], now: now, calendar: calendar).fees {
      let words = fee.name.lowercased().split { !$0.isLetter }.map(String.init)
      let insurance = words.contains("lic") || ["insurance", "insur", "policy", "mediclaim", "term plan"]
        .contains { fee.name.lowercased().contains($0) }
      append(fee.id, insurance ? .insurance : .fee, fee.name, day(fee.due, calendar: calendar), fee.amount)
    }
    for item in subscriptions where !item.lapsed && !plannedCancels.contains(item.id) {
      guard let text = item.nextDate, let original = day(text, calendar: calendar) else { continue }
      var due = original
      var offset = 0
      while due < today {
        let component: Calendar.Component
        let step: Int
        switch item.cadence {
        case .weekly: component = .day; step = 7
        case .monthly: component = .month; step = 1
        case .quarterly: component = .month; step = 3
        case .yearly: component = .year; step = 1
        case .irregular: component = .day; step = 0
        }
        guard step > 0 else { break }
        offset += step
        guard let next = calendar.date(byAdding: component, value: offset, to: original), next > due else { break }
        due = next
      }
      append(item.id, .subscription, item.name, due, item.typicalPaise)
    }
    return bills.sorted {
      if $0.daysLeft != $1.daysLeft { return $0.daysLeft < $1.daysLeft }
      if $0.kind != $1.kind { return $0.kind.rank < $1.kind.rank }
      if $0.name != $1.name { return $0.name < $1.name }
      return $0.id < $1.id
    }
  }

  static func dueText(_ daysLeft: Int) -> String {
    switch daysLeft {
    case 0: "Due today"
    case 1: "Due tomorrow"
    default: "Due in \(daysLeft) days"
    }
  }

  struct Summary: Equatable {
    var dueThisWeek: Int
    var dueThisWeekPaise: Int64
    var next: RadarBill?
  }

  static func summary(_ bills: [RadarBill]) -> Summary {
    let unpaid = bills.filter { !$0.paid }
    let week = unpaid.filter { (0...6).contains($0.daysLeft) }
    return Summary(
      dueThisWeek: week.count, dueThisWeekPaise: week.reduce(0) { $0 + ($1.amount ?? 0) }, next: unpaid.first)
  }

  static func alerts(
    _ bills: [RadarBill], state: BillRadarState, limit: FeatureLimit, includeAmounts: Bool,
    now: Date, calendar: Calendar = .current, hour: Int = 9
  ) -> (alerts: [BillAlert], lockedCount: Int) {
    guard state.alertsOn else { return ([], 0) }
    let eligible = bills.filter { !$0.paid && !$0.muted }
    let maximum: Int
    switch limit {
    case .unlimited: maximum = eligible.count
    case .count(let count): maximum = max(0, count)
    }
    var alerts: [BillAlert] = []
    for bill in eligible.prefix(maximum) {
      guard let due = day(bill.due, calendar: calendar),
            let lead = calendar.date(byAdding: .day, value: -state.leadDays, to: due),
            let first = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: lead),
            let fallback = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: due) else { continue }
      var fire = first > now ? first : fallback
      if fire <= now {
        guard calendar.isDate(due, inSameDayAs: now) else { continue }
        fire = now.addingTimeInterval(60)
      }
      let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: fire), to: due).day ?? 0
      // Names may have imported account numbers, including spaced or hyphenated ones.
      // Notifications omit the entire number rather than retaining its last four digits.
      let name = bill.name.replacingOccurrences(
        of: "[0-9](?:[0-9 -]*[0-9])?", with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
      var body = "\(name.isEmpty ? bill.kind.title : name) · \(SubscriptionAudit.shortDay(bill.due))"
      if includeAmounts && state.amountsInAlerts, let amount = bill.amount {
        body += " · \(Money.format(amount))"
      }
      alerts.append(BillAlert(
        billId: bill.id, fireAt: fire, title: "\(bill.kind.title) \(dueText(days).lowercased())", body: body))
    }
    return (alerts, max(0, eligible.count - maximum))
  }

  private static func nextDue(_ day: Int, today: Date, calendar: Calendar) -> Date? {
    guard (1...31).contains(day) else { return nil }
    for offset in 0...14 {
      guard let month = calendar.date(byAdding: .month, value: offset, to: today),
            let length = calendar.range(of: .day, in: .month, for: month)?.count else { continue }
      var parts = calendar.dateComponents([.year, .month], from: month)
      parts.day = min(day, length)
      if let date = calendar.date(from: parts), date >= today { return date }
    }
    return nil
  }

  private static func day(_ text: String, calendar: Calendar) -> Date? {
    let parts = text.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3,
          let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
          ymd(date, calendar: calendar) == text else { return nil }
    return date
  }

  private static func ymd(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }
}

extension GlanceBuilder {
  /// App-only radar inputs; shared widget builds only receive the resulting value types.
  static func build(
    dataset: Dataset, now: Date, includeAmounts: Bool, tier: Tier,
    themeID: String = ThemeID.lakshmi.rawValue, appearance: String = "system",
    calendar: Calendar = .current, fees: [WowFee], subscriptions: [SubscriptionItem],
    plannedCancels: Set<String>, radarState: BillRadarState
  ) -> GlanceSnapshot {
    let bills = BillRadar.build(
      accounts: dataset.accounts, debts: dataset.debts ?? [], sips: dataset.sips ?? [],
      fees: fees, subscriptions: subscriptions, plannedCancels: plannedCancels,
      state: radarState, now: now, calendar: calendar)
    return build(dataset: dataset, now: now, includeAmounts: includeAmounts, tier: tier,
      themeID: themeID, appearance: appearance, calendar: calendar, radarBills: bills)
  }
}
