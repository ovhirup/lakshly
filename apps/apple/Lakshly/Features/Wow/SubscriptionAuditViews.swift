import SwiftUI

/// Subscription audit on Spend. Free (`Feature.subscriptionAudit`). Lakshly never cancels a charge.
struct SubscriptionAuditCard: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore

  var body: some View {
    if entitlements.can(.subscriptionAudit) {
      card(SubscriptionAudit.build(
        transactions: store.reviewed(store.dataset?.transactions ?? []),
        now: store.reviewNow,
        planned: Set(store.wowState.plannedCancels)))
    }
  }

  private func card(_ audit: AuditResult) -> some View {
    Card(title: "Subscription audit") {
      if audit.items.isEmpty {
        Text("No subscriptions spotted yet. Import a few months of statements.")
          .foregroundStyle(theme.secondaryText)
          .fixedSize(horizontal: false, vertical: true)
      } else {
        MoneyText(headline(audit))
          .font(.system(.title3, design: .rounded, weight: .bold))
          .fixedSize(horizontal: false, vertical: true)
          .accessibilityIdentifier("wow.subscriptionAudit.headline")
        ForEach(audit.items) { item in
          row(item)
        }
        if audit.plannedSavingsYearlyPaise > 0 {
          MoneyText("Cancel the planned ones and save \(Money.format(audit.plannedSavingsYearlyPaise)) a year")
            .font(.subheadline.weight(.semibold))
            .fixedSize(horizontal: false, vertical: true)
        }
        Text("Lakshly never cancels anything for you. Cancel in the app or site you pay.")
          .font(.caption)
          .foregroundStyle(theme.secondaryText)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .accessibilityIdentifier("wow.subscriptionAudit.card")
  }

  private var planned: Set<String> { Set(store.wowState.plannedCancels) }

  private func headline(_ audit: AuditResult) -> String {
    let count = audit.items.filter { !$0.lapsed }.count
    let noun = count == 1 ? "subscription" : "subscriptions"
    return "\(Money.format(audit.monthlyTotalPaise)) a month · \(Money.format(audit.yearlyTotalPaise)) a year on \(count) \(noun)"
  }

  private func row(_ item: SubscriptionItem) -> some View {
    let marked = planned.contains(item.id)
    let flagColor = item.verdict == "Worth a look" ? theme.gold : theme.secondaryText
    return VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(item.name).font(.headline).fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 8)
        MoneyText(Money.format(item.monthlyPaise)).fontWeight(.semibold)
      }
      HStack(spacing: 8) {
        Pill(text: SubscriptionAudit.kindTitle(item.kind))
        Text(SubscriptionAudit.scheduleLine(item))
          .font(.subheadline)
          .foregroundStyle(theme.secondaryText)
          .fixedSize(horizontal: false, vertical: true)
      }
      if !item.flags.isEmpty {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(Array(item.flags.enumerated()), id: \.offset) { _, flag in
            Pill(text: flag.text, color: flagColor)
          }
        }
      }
      Button {
        toggle(item.id)
      } label: {
        Text(marked ? "Planned ✓" : "Plan to cancel")
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .padding(.vertical, 5)
          .foregroundStyle(marked ? theme.bg : theme.gold)
          .background(marked ? theme.gold : theme.gold.opacity(0.14), in: Capsule())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(marked ? "Planned to cancel \(item.name)" : "Plan to cancel \(item.name)")
      .accessibilityIdentifier("wow.subscriptionAudit.plan.\(item.id)")
      .accessibilityAddTraits(.isToggle)
      .accessibilityAddTraits(marked ? .isSelected : [])
    }
    .accessibilityIdentifier("wow.subscriptionAudit.item.\(item.id)")
  }

  private func toggle(_ id: String) {
    let current = store.wowState
    var marks = current.plannedCancels
    if let index = marks.firstIndex(of: id) {
      marks.remove(at: index)
    } else {
      marks.append(id)
    }
    store.setWowState(WowState(
      extraPaise: current.extraPaise,
      rollOver: current.rollOver,
      plannedCancels: marks,
      fees: current.fees,
      setAside: current.setAside))
  }
}
