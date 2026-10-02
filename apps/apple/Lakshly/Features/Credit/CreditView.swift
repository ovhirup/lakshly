import SwiftUI

struct CreditView: View {
  let store: DataStore
  var body: some View {
    Page(title: "Credit", subtitle: "Keep your headroom healthy.") {
      ForEach((store.dataset?.accounts ?? []).filter { $0.type == "credit_card" }) { account in
        let utilisation = Double(abs(account.balance)) / Double(max(1, account.creditLimit ?? 0))
        Card(title: account.name) {
          Gauge(value: min(utilisation, 1)) {
            Text("Utilisation")
          } currentValueLabel: {
            Text("\(Int(utilisation * 100))%")
          }.gaugeStyle(.accessoryCircular).tint(utilisation > 0.3 ? .pink : .orange).scaleEffect(
            1.3
          ).padding(12)
          MetricRow(title: "Balance", value: Money.format(abs(account.balance)))
          MetricRow(title: "Credit limit", value: Money.format(account.creditLimit ?? 0))
          MetricRow(title: "Statement day", value: "\(account.statementDay ?? 1) of each month")
          MetricRow(title: "Next due", value: nextMonthlyDate(day: account.dueDay ?? 1))
          Text(
            "Aim to keep utilisation below 30% and pay the statement balance in full. This demo is a snapshot, not a credit score."
          ).font(.subheadline).foregroundStyle(.secondary)
        }
      }
    }
  }
}
