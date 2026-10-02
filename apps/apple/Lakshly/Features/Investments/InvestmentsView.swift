import Charts
import SwiftUI

struct InvestmentsView: View {
  let store: DataStore
  private var holdings: [Account] {
    (store.dataset?.accounts ?? []).filter {
      ["mutual_fund", "stocks", "epf", "ppf", "nps"].contains($0.type)
    }
  }
  private var projection: [ProjectionPoint] {
    let monthly = Double(
      (store.dataset?.sips ?? []).filter { $0.status == "active" }.reduce(Int64(0)) {
        $0 + $1.amount
      })
    var value = Double(holdings.reduce(Int64(0)) { $0 + $1.balance })
    var result = [ProjectionPoint(month: 0, amount: value)]
    let rate = pow(1.12, 1.0 / 12) - 1
    for month in 1...120 {
      value = value * (1 + rate) + monthly
      if month % 12 == 0 { result.append(ProjectionPoint(month: month / 12, amount: value)) }
    }
    return result
  }
  var body: some View {
    Page(title: "Investments & SIPs", subtitle: "Small habits. A longer horizon.") {
      ForEach(holdings) { account in
        Card(title: account.name) {
          MetricRow(title: "Current value", value: Money.format(account.balance))
          if let invested = account.invested {
            MetricRow(title: "Invested", value: Money.format(invested))
            MetricRow(
              title: "Gain",
              value:
                "\(Money.format(account.balance - invested)) · \(String(format: "%.1f", Double(account.balance - invested) / Double(max(1, invested)) * 100))%"
            )
          } else {
            Text("Invested amount not provided").foregroundStyle(Theme.secondaryText)
          }
        }
      }
      Card(title: "Your SIPs") {
        ForEach(store.dataset?.sips ?? []) { sip in
          VStack(alignment: .leading, spacing: 8) {
            Text(sip.scheme).font(.headline)
            MetricRow(title: sip.status.capitalized, value: Money.format(sip.amount))
            Text(
              sip.status == "active"
                ? "Next: \(nextMonthlyDate(day: sip.dayOfMonth))"
                : "No scheduled debit while \(sip.status)"
            ).font(.caption)
            if let step = sip.stepUpPctYearly {
              Text("Annual step-up: \(String(format: "%.0f", step))%").font(.caption)
                .foregroundStyle(Theme.secondaryText)
            }
            Divider()
          }
        }
      }
      Card(title: "A possible ten-year horizon") {
        Chart(projection) { point in
          LineMark(x: .value("Years", point.month), y: .value("Value", point.amount))
            .foregroundStyle(Theme.invest).interpolationMethod(.monotone)
        }.modifier(MoneyChartAxis()).frame(height: 210)
        Text(
          "Illustrative 12% CAGR, fixed monthly SIPs paid at month-end. Excludes step-ups, taxes and fees. Returns are not guaranteed; this is not investment advice."
        ).font(.caption).foregroundStyle(Theme.secondaryText)
      }
    }
  }
}
