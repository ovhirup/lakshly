import Charts
import SwiftUI

struct SpendView: View {
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
  private let categoryColors: KeyValuePairs<String, Color> = [
    "Income": Color(red: 0.10, green: 0.55, blue: 0.32),
    "Groceries": Color(red: 0.45, green: 0.65, blue: 0.15),
    "Dining": Color(red: 0.90, green: 0.25, blue: 0.30),
    "Transport": Color(red: 0.10, green: 0.55, blue: 0.85),
    "Fuel": Color(red: 0.80, green: 0.45, blue: 0.10),
    "Shopping": Color(red: 0.80, green: 0.20, blue: 0.65),
    "Utilities": Color(red: 0.10, green: 0.65, blue: 0.65),
    "Rent": Color(red: 0.50, green: 0.30, blue: 0.80),
    "Health": Color(red: 0.95, green: 0.50, blue: 0.55),
    "Education": Color(red: 0.25, green: 0.35, blue: 0.75),
    "Entertainment": Color(red: 0.70, green: 0.40, blue: 0.65),
    "Travel": Color(red: 0.15, green: 0.75, blue: 0.85),
    "Subscriptions": Color(red: 0.65, green: 0.55, blue: 0.15),
    "Insurance": Color(red: 0.35, green: 0.55, blue: 0.50),
    "Investments": Color(red: 0.30, green: 0.70, blue: 0.40),
    "Emi": Color(red: 0.65, green: 0.25, blue: 0.20),
    "Fees": Color(red: 0.55, green: 0.40, blue: 0.25),
    "Transfers": Color(red: 0.45, green: 0.50, blue: 0.70),
    "Cash": Color(red: 0.60, green: 0.70, blue: 0.35),
    "Gifts": Color(red: 0.90, green: 0.40, blue: 0.80),
    "Other": Color(red: 0.50, green: 0.50, blue: 0.55),
  ]
  var body: some View {
    Page(title: "Spend", subtitle: "Make room for what matters.") {
      MonthPicker(store: store)
      Card(title: "Where it went") {
        Text(Money.format(-outflows.reduce(0) { $0 + $1.amount })).font(.largeTitle.bold())
        Chart(donutGroups) { group in
          SectorMark(
            angle: .value("Spend", Double(group.amount)), innerRadius: .ratio(0.66), angularInset: 2
          ).foregroundStyle(by: .value("Category", group.name.capitalized)).cornerRadius(5)
        }.chartForegroundStyleScale(categoryColors).frame(height: 260)
      }
      Card(title: "Daily outflows") {
        Chart(daily) { group in
          AreaMark(
            x: .value("Day", String(group.name.suffix(2))), y: .value("Paise", Double(group.amount))
          ).foregroundStyle(.pink.opacity(0.15))
          LineMark(
            x: .value("Day", String(group.name.suffix(2))), y: .value("Paise", Double(group.amount))
          ).foregroundStyle(.pink).interpolationMethod(.monotone)
        }.modifier(MoneyChartAxis()).frame(height: 200)
      }
      Card(title: "Top merchants") {
        ForEach(Array(merchants.prefix(8))) { group in
          MetricRow(title: group.name, value: Money.format(group.amount))
        }
      }
    }
  }
}
