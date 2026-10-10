import SwiftUI

struct BudgetView: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  var body: some View {
    Page(title: "Budget", subtitle: "A gentle plan for your month.") {
      MonthPicker(store: store, identifier: "budget.month")
      ForEach((store.dataset?.budgets ?? []).filter { $0.month == store.selectedMonth }) { budget in
        let actual = -store.transactions.filter { $0.category == budget.category && $0.amount < 0 }
          .reduce(Int64(0)) { $0 + $1.amount }
        Card(title: budget.category.capitalized) {
          MetricRow(
            title: "Spent / planned",
            value: "\(Money.format(actual)) / \(Money.format(budget.limit))", semantic: .spend)
          ProgressView(value: min(Double(actual) / Double(max(1, budget.limit)), 1)).tint(
            actual > budget.limit ? theme.danger : theme.success)
          if actual > budget.limit {
            Text("\(Money.format(actual - budget.limit)) over budget").foregroundStyle(theme.danger).font(
              .subheadline.bold())
          } else {
            Text("\(Money.format(budget.limit - actual)) remaining").foregroundStyle(theme.success)
          }
          if budget.rollover == true {
            Text(
              "Rollover enabled. Unused amounts may carry forward; this view shows the base monthly limit."
            ).font(.caption).foregroundStyle(theme.secondaryText)
          }
        }
      }
    }
  }
}
