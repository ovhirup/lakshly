import Charts
import SwiftUI

struct OverviewView: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  let showFeedback: () -> Void
  private var accounts: [Account] { store.dataset?.accounts ?? [] }
  private var assets: Int64 { accounts.filter { $0.balance > 0 }.reduce(0) { $0 + $1.balance } }
  private var liabilities: Int64 {
    -accounts.filter { $0.balance < 0 }.reduce(0) { $0 + $1.balance }
  }
  var body: some View {
    Page(title: "Every rupee on target.", subtitle: "Your money, in a little more focus.") {
      Button(action: showFeedback) {
        HStack {
          Text("Have an idea? Tell us →").font(.subheadline.weight(.semibold))
          Spacer()
        }.frame(maxWidth: .infinity).modifier(GlassCard())
      }.buttonStyle(.plain)
      Card(title: "Net worth") {
        Text(Money.format(assets - liabilities)).font(
          .system(size: 38, weight: .bold, design: .rounded)
        ).foregroundStyle(theme.gold).minimumScaleFactor(0.5)
        Pill(text: "Demo data")
        MetricRow(title: "Assets", value: Money.format(assets))
        MetricRow(title: "Liabilities", value: Money.format(liabilities))
      }
      Card(title: "Cash flow") {
        MetricRow(title: "Income", value: Money.format(store.transactions.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }), semantic: .income)
        MetricRow(title: "Spend", value: Money.format(-store.transactions.filter { $0.amount < 0 }.reduce(0) { $0 + $1.amount }), semantic: .spend)
        Chart {
          ForEach(store.months, id: \.self) { month in
            let rows = (store.dataset?.transactions ?? []).filter { $0.date.hasPrefix(month) }
            let income = rows.filter { $0.amount > 0 }.reduce(Int64(0)) { $0 + $1.amount }
            let spend = -rows.filter { $0.amount < 0 }.reduce(Int64(0)) { $0 + $1.amount }
            BarMark(x: .value("Month", month), y: .value("Paise", Double(income))).foregroundStyle(
              by: .value("Flow", "Income")
            ).position(by: .value("Flow", "Income"))
            BarMark(x: .value("Month", month), y: .value("Paise", Double(spend))).foregroundStyle(
              by: .value("Flow", "Spend")
            ).position(by: .value("Flow", "Spend"))
          }
        }.chartForegroundStyleScale(["Income": theme.income, "Spend": theme.spend]).modifier(
          MoneyChartAxis()
        ).frame(height: 220)
        Text("All inflows and outflows, including investments and EMI.").font(.caption)
          .foregroundStyle(theme.secondaryText)
      }
      Card(title: "Top categories · \(store.selectedMonth)") {
        MonthPicker(store: store)
        ForEach(Array(store.categoryTotals.prefix(5))) { group in
          MetricRow(title: group.name.capitalized, value: Money.format(group.amount), semantic: group.name == "investments" ? .invest : .spend)
        }
      }
      Card(title: "Upcoming dues") {
        ForEach(accounts.filter { $0.type == "credit_card" }) { account in
          MetricRow(
            title: "\(account.name) · \(nextMonthlyDate(day: account.dueDay ?? 1))",
            value: Money.format(abs(account.balance)))
        }
        ForEach(store.dataset?.debts ?? []) { debt in
          MetricRow(
            title: "\(debt.name) EMI · \(nextMonthlyDate(day: Int(debt.startDate.suffix(2)) ?? 1))",
            value: Money.format(debt.emi), semantic: .spend)
        }
        ForEach((store.dataset?.sips ?? []).filter { $0.status == "active" }) { sip in
          MetricRow(
            title: "SIP · \(nextMonthlyDate(day: sip.dayOfMonth))", value: Money.format(sip.amount), semantic: .invest)
        }
      }
    }
  }
}
