import SwiftUI

struct RewardsView: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  var body: some View {
    Page(title: "Rewards", subtitle: "Don't leave the little wins behind.") {
      ForEach(store.dataset?.rewards ?? []) { reward in
        Card(title: reward.program) {
          Text("\(reward.balance.formatted()) \(reward.kind)").font(.title.bold())
          if let unitValue = reward.valuePerUnitPaise {
            MetricRow(title: "Estimated value", value: Money.format(reward.balance * unitValue))
          } else {
            Text("Redemption value not provided").foregroundStyle(theme.secondaryText)
          }
          if let expiry = reward.expiresOn {
            Label(
              "Expires \(expiry) · redeem before expiry", systemImage: "clock.badge.exclamationmark"
            ).font(.subheadline).foregroundStyle(theme.gold)
          }
          Text("Values depend on each synthetic program's redemption rules.").font(.caption)
            .foregroundStyle(theme.secondaryText)
        }
      }
    }
  }
}
