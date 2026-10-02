import Charts
import SwiftUI

struct DebtView: View {
  let store: DataStore
  @AppStorage("settings.premium") private var premium = false
  private func projection(_ debt: Debt) -> [ProjectionPoint] {
    var balance = Double(debt.outstanding)
    var points = [ProjectionPoint(month: 0, amount: balance)]
    let rate = debt.annualRatePct / 1_200
    for month in 1...600 {
      let next = max(0, balance * (1 + rate) - Double(debt.emi))
      if next >= balance { break }
      balance = next
      points.append(ProjectionPoint(month: month, amount: balance))
      if balance == 0 { break }
    }
    return points
  }
  var body: some View {
    Page(title: "Debt", subtitle: "One payment closer to freedom.") {
      ForEach(store.dataset?.debts ?? []) { debt in
        Card(title: debt.name) {
          Text(Money.format(debt.outstanding)).font(.largeTitle.bold())
          MetricRow(title: "Monthly EMI", value: Money.format(debt.emi))
          MetricRow(title: "Annual interest", value: String(format: "%.2f%%", debt.annualRatePct))
          ProgressView(
            value: max(0, min(1, 1 - Double(debt.outstanding) / Double(max(1, debt.principal))))
          ).tint(Theme.spend)
          Text(
            "Repaid \(Money.format(max(0, debt.principal - debt.outstanding))) of \(Money.format(debt.principal))"
          ).font(.caption).foregroundStyle(Theme.secondaryText)
          Chart(projection(debt)) { point in
            AreaMark(
              x: .value("Months from now", point.month), y: .value("Outstanding", point.amount)
            ).foregroundStyle(Theme.spend.opacity(0.16))
            LineMark(
              x: .value("Months from now", point.month), y: .value("Outstanding", point.amount)
            ).foregroundStyle(Theme.spend)
          }.modifier(MoneyChartAxis()).frame(height: 190)
          Text(
            "Illustrative reducing-balance amortisation at the current rate and EMI; excludes fees and rate changes. Horizontal axis: months from now."
          ).font(.caption).foregroundStyle(Theme.secondaryText)
          if projection(debt).count == 1 {
            Text("The EMI does not cover monthly interest.").foregroundStyle(Theme.danger)
          }
        }
      }
      Card(title: "Payoff planner") {
        HStack {
          Image(systemName: premium ? "sparkles" : "lock.fill")
          Text("Avalanche / snowball")
          Spacer()
          Pill(text: "Premium", color: Theme.gold)
        }
        Text(
          premium
            ? "Preview: avalanche targets the highest rate; snowball targets the smallest balance. Your demo has one loan, so both start there."
            : "Preview Premium in Settings to explore repayment strategies."
        ).foregroundStyle(Theme.secondaryText)
      }
    }
  }
}
