import Charts
import SwiftUI

struct SpendView: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  private var outflows: [Transaction] { store.transactions.filter { $0.amount < 0 } }
  private var merchants: [AmountGroup] {
    store.totals(outflows, by: { $0.merchant ?? $0.description })
  }
  private var daily: [AmountGroup] {
    store.totals(outflows, by: { $0.date }).sorted { $0.name < $1.name }
  }
  // Preserve category identity across months and reserve Other for the remaining spend.
  private var donutGroups: [AmountGroup] {
    let categories = store.categoryTotals.filter { $0.name != "other" }
    let top = Array(categories.prefix(6))
    let remainder =
      categories.dropFirst(6).reduce(Int64(0)) { $0 + $1.amount }
      + (store.categoryTotals.first { $0.name == "other" }?.amount ?? 0)
    return top + (remainder > 0 ? [AmountGroup(name: "other", amount: remainder)] : [])
  }
  var body: some View {
    Page(title: "Spend", subtitle: "Make room for what matters.") {
      MonthPicker(store: store)
      Card(title: "Where it went") {
        SemanticAmount(value: Money.format(-outflows.reduce(0) { $0 + $1.amount }), semantic: .spend,
                       prominent: true)
          .font(.largeTitle.bold())
        Chart(donutGroups) { group in
          SectorMark(
            angle: .value("Spend", Double(group.amount)), innerRadius: .ratio(0.66), angularInset: 1.5
          ).foregroundStyle(by: .value("Category", group.name.capitalized)).cornerRadius(4)
        }.chartForegroundStyleScale(
          domain: donutGroups.map { $0.name.capitalized },
          range: donutGroups.map { group in
            theme.category(group.name)
          }
        ).frame(height: 260)
      }
      Card(title: "Daily outflows") {
        Chart(daily) { group in
          AreaMark(
            x: .value("Day", String(group.name.suffix(2))), y: .value("Paise", Double(group.amount))
          ).foregroundStyle(theme.spend.opacity(0.15))
          LineMark(
            x: .value("Day", String(group.name.suffix(2))), y: .value("Paise", Double(group.amount))
          ).foregroundStyle(theme.spend).interpolationMethod(.monotone)
        }.modifier(MoneyChartAxis()).frame(height: 200)
      }
      Card(title: "Top merchants") {
        ForEach(Array(merchants.prefix(8))) { group in
          MetricRow(title: group.name, value: Money.format(group.amount), semantic: .spend)
        }
      }
    }
  }
}
