import Charts
import SwiftUI

struct DebtView: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  @State private var paywallPresented = false
  private var premium: Bool { entitlements.can(.debtPlanner) }
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
    Page(title: "Debt", subtitle: "One payment closer to freedom.", showsPremiumLock: !entitlements.isPremium) {
      ForEach(store.dataset?.debts ?? []) { debt in
        Card(title: debt.name) {
          Text(Money.format(debt.outstanding)).font(.largeTitle.bold())
          MetricRow(title: "Monthly EMI", value: Money.format(debt.emi), semantic: .spend)
          MetricRow(title: "Annual interest", value: String(format: "%.2f%%", debt.annualRatePct))
          ProgressView(
            value: max(0, min(1, 1 - Double(debt.outstanding) / Double(max(1, debt.principal))))
          ).tint(theme.spend)
          Text(
            "Repaid \(Money.format(max(0, debt.principal - debt.outstanding))) of \(Money.format(debt.principal))"
          ).font(.caption).foregroundStyle(theme.secondaryText)
          Chart(projection(debt)) { point in
            AreaMark(
              x: .value("Months from now", point.month), y: .value("Outstanding", point.amount)
            ).foregroundStyle(theme.spend.opacity(0.16))
            LineMark(
              x: .value("Months from now", point.month), y: .value("Outstanding", point.amount)
            ).foregroundStyle(theme.spend)
          }.modifier(MoneyChartAxis()).frame(height: 190)
          Text(
            "Illustrative reducing-balance amortisation at the current rate and EMI; excludes fees and rate changes. Horizontal axis: months from now."
          ).font(.caption).foregroundStyle(theme.secondaryText)
          if projection(debt).count == 1 {
            Text("The EMI does not cover monthly interest.").foregroundStyle(theme.danger)
          }
        }
      }
      Card(title: "Payoff planner", access: premium ? .unlocked : .locked) {
        if premium {
          Text(
            "Avalanche puts extra money on the highest rate. Snowball puts it on the smallest balance. This demo has one loan, so both start there."
          ).foregroundStyle(theme.secondaryText)
        } else {
          Text(
            "See how avalanche and snowball would order repayments, with the highest rate or the smallest balance first."
          ).foregroundStyle(theme.secondaryText)
          Button("See Premium") { paywallPresented = true }
            .buttonStyle(ThemedSubmitStyle())
            .accessibilityIdentifier("debt.seePremium")
            .accessibilityHint("Opens Lakshly Premium")
        }
      }
      .accessibilityIdentifier("debt.planner")
    }
    .sheet(isPresented: $paywallPresented) { PaywallView(context: .feature(.debtPlanner)) }
  }
}
