import Foundation

struct LiveActivityPlan: Equatable {
  enum Kind: String, Equatable {
    case bill, budget
  }

  var kind: Kind
  var title: String
  var subtitle: String
  var progress: Double
  /// Paise available to the app. The activity shows a string only when Lock Screen amounts are allowed.
  var amountPaise: Int64?
  var endOfDay: Date
  /// Set when starting this month's budget alert. Nil when the plan only refreshes an alert already counted.
  var budgetAlertMonth: String?
}

enum LiveActivityPlanner {
  static let budgetThreshold = 80.0

  /// A bill due today wins. Otherwise a budget that has reached 80% starts once per calendar month.
  /// Pass `budgetActivityRunningToday` so a later refresh the same day updates the activity instead of ending it.
  static func select(
    snapshot: GlanceSnapshot,
    now: Date,
    calendar: Calendar = .current,
    budgetAlertMonth: String? = nil,
    budgetActivityRunningToday: Bool = false
  ) -> LiveActivityPlan? {
    if let bill = snapshot.nextBill, calendar.isDate(bill.dueDate, inSameDayAs: now) {
      return LiveActivityPlan(
        kind: .bill,
        title: bill.name,
        subtitle: "Due today",
        progress: 1,
        amountPaise: bill.amount,
        endOfDay: endOfDay(now, calendar: calendar),
        budgetAlertMonth: nil)
    }
    guard snapshot.budget.monthSpendPercent >= budgetThreshold else { return nil }
    let month = monthKey(now, calendar: calendar)
    if budgetAlertMonth == month && !budgetActivityRunningToday { return nil }
    return LiveActivityPlan(
      kind: .budget,
      title: "Budget pace",
      subtitle: "Over 80% of this month",
      progress: min(max(snapshot.budget.monthSpendPercent, 0) / 100, 1.5),
      amountPaise: snapshot.budget.safeToSpendPerDay,
      endOfDay: endOfDay(now, calendar: calendar),
      budgetAlertMonth: budgetAlertMonth == month ? nil : month)
  }

  static func endOfDay(_ date: Date, calendar: Calendar) -> Date {
    let start = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: start) ?? start.addingTimeInterval(86_400)
  }

  static func monthKey(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month], from: date)
    return String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
  }
}
