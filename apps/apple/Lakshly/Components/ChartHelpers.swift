import Charts
import SwiftUI

struct MonthPicker: View {
  @Bindable var store: DataStore
  var identifier = "month.picker"
  var body: some View {
    Picker("Month", selection: $store.selectedMonth) {
      ForEach(store.months, id: \.self) { Text($0).tag($0) }
    }.pickerStyle(.menu)
      .accessibilityIdentifier(identifier)
  }
}
struct MoneyChartAxis: ViewModifier {
  func body(content: Content) -> some View {
    content.chartYAxis {
      AxisMarks { value in
        AxisGridLine()
        AxisValueLabel {
          if let amount = value.as(Double.self) { Text(Money.compact(Int64(amount))) }
        }
      }
    }
  }
}
struct ProjectionPoint: Identifiable {
  let month: Int
  let amount: Double
  var id: Int { month }
}
func nextMonthlyDate(day: Int) -> String {
  let calendar = Calendar.current
  let today = calendar.startOfDay(for: Date())
  var parts = calendar.dateComponents([.year, .month], from: today)
  parts.day = min(day, calendar.range(of: .day, in: .month, for: today)?.count ?? day)
  guard var date = calendar.date(from: parts) else { return "Day \(day)" }
  if date < today {
    let next = calendar.date(byAdding: .month, value: 1, to: today) ?? today
    parts = calendar.dateComponents([.year, .month], from: next)
    parts.day = min(day, calendar.range(of: .day, in: .month, for: next)?.count ?? day)
    date = calendar.date(from: parts) ?? next
  }
  return date.formatted(date: .abbreviated, time: .omitted)
}
