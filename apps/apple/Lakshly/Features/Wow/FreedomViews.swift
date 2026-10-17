import SwiftUI

/// Freedom date for the debts on file. Free (`Feature.freedomDate`).
struct FreedomCard: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore

  var body: some View {
    if entitlements.can(.freedomDate) {
      let debts = store.dataset?.debts ?? []
      let plan = FreedomFormat.baseline(debts: debts, now: store.reviewNow)
      Card(title: "Freedom date") {
        if debts.isEmpty {
          Text("No loans. You are already free 🎉")
            .fixedSize(horizontal: false, vertical: true)
        } else {
          headline(debts: debts, plan: plan)
          clearedBar(Freedom.clearedFraction(debts: debts))
          ForEach(plan.payoffs) { payoff in
            MetricRow(
              title: payoff.name,
              value: payoff.month.map(FreedomFormat.monthLabel) ?? "Not clearing")
          }
          ForEach(plan.unscheduled) { debt in
            Text("Also tracked: \(debt.name) (no fixed schedule)")
              .font(.subheadline)
              .foregroundStyle(theme.secondaryText)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
      .accessibilityIdentifier("wow.freedomDate.card")
    }
  }

  @ViewBuilder private func headline(debts: [Debt], plan: FreedomPlan) -> some View {
    if let month = plan.freedomMonth {
      Text("Debt-free by \(FreedomFormat.monthLabel(month))")
        .font(.system(.largeTitle, design: .rounded, weight: .bold))
        .fixedSize(horizontal: false, vertical: true)
        .minimumScaleFactor(0.6)
      Text("\(FreedomFormat.dayCount(Freedom.countdown(to: month, now: store.reviewNow).days)) to go")
        .font(.title3.weight(.semibold))
        .foregroundStyle(theme.secondaryText)
    } else if plan.payoffs.isEmpty {
      Text("No fixed EMI yet")
        .font(.system(.title2, design: .rounded, weight: .bold))
        .fixedSize(horizontal: false, vertical: true)
    } else {
      ForEach(stuckLines(debts: debts, plan: plan), id: \.self) { line in
        Text(line)
          .font(.system(.title3, design: .rounded, weight: .bold))
          .foregroundStyle(theme.danger)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
  }

  private func stuckLines(debts: [Debt], plan: FreedomPlan) -> [String] {
    let open = plan.payoffs.filter { $0.month == nil }
    let lines = open.map { payoff -> String in
      let debt = debts.first { $0.id == payoff.id }
      if let debt, Freedom.emiDoesNotCoverInterest(debt) {
        return "\(payoff.name): the EMI does not cover interest."
      }
      return "\(payoff.name) is not clearing on this EMI yet."
    }
    return lines.isEmpty ? ["This plan is not clearing yet."] : lines
  }

  private func clearedBar(_ fraction: Double) -> some View {
    let clamped = min(1, max(0, fraction))
    let label = "\(Int((clamped * 100).rounded()))% cleared"
    return VStack(alignment: .leading, spacing: 8) {
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(theme.secondaryText.opacity(0.18))
          Capsule().fill(theme.gold).frame(width: geo.size.width * clamped)
        }
      }
      .frame(height: 12)
      .accessibilityHidden(true)
      MoneyText(label).font(.subheadline.weight(.semibold))
    }
    .accessibilityElement(children: .combine)
  }
}

/// Extra-payment what-if. Premium (`Feature.freedomWhatIf`).
struct FreedomWhatIfCard: View {
  @Environment(\.theme) private var theme
  @Environment(\.privacy) private var privacy
  let store: DataStore
  @State private var extra: Double
  @State private var rollOver: Bool

  init(store: DataStore) {
    self.store = store
    let state = store.wowState
    let ceiling = FreedomWhatIfCard.sliderCeiling(store.dataset?.debts ?? [])
    let seeded = min(max(Int64(0), state.extraPaise), ceiling)
    _extra = State(initialValue: Double(seeded))
    _rollOver = State(initialValue: state.rollOver)
  }

  var body: some View {
    PremiumGate(
      feature: .freedomWhatIf,
      title: "What if I pay a bit extra?",
      message: "Slide an extra monthly payment and watch your freedom date move. Roll cleared EMIs into the next loan."
    ) {
      controls
    }
    .accessibilityIdentifier("wow.freedomWhatIf.card")
  }

  private var debts: [Debt] { store.dataset?.debts ?? [] }

  private var maximum: Int64 { Self.sliderCeiling(debts) }

  private var extraPaise: Int64 { min(max(Int64(0), Int64(extra.rounded())), maximum) }

  private var extraBinding: Binding<Double> {
    Binding(get: { Double(extraPaise) }, set: { extra = $0 })
  }

  @ViewBuilder private var controls: some View {
    let baseline = FreedomFormat.baseline(debts: debts, now: store.reviewNow)
    let whatIf = Freedom.simulate(
      debts: debts, from: Freedom.startMonth(now: store.reviewNow), extraPaise: extraPaise, rollOver: rollOver)
    let months = Freedom.pullIn(baseline: baseline, whatIf: whatIf)
    let saved = Freedom.interestSaved(baseline: baseline, whatIf: whatIf)

    HStack(alignment: .firstTextBaseline) {
      Text("Extra per month").foregroundStyle(theme.secondaryText)
      Spacer(minLength: 8)
      MoneyText(Money.format(extraPaise)).fontWeight(.semibold)
    }
    Slider(
      value: extraBinding,
      in: 0...Double(maximum),
      step: Double(Freedom.extraStepPaise),
      onEditingChanged: { editing in
        if !editing { persist() }
      }
    )
    .accessibilityLabel("Extra per month")
    .accessibilityValue(Money.display(extraPaise, masked: privacy.masked))
    .accessibilityIdentifier("wow.freedomWhatIf.extra")

    Toggle("Roll cleared EMIs into the next loan", isOn: $rollOver)
      .onChange(of: rollOver) { _, _ in persist() }
      .accessibilityIdentifier("wow.freedomWhatIf.rollOver")

    if debts.isEmpty {
      Text("No loans. You are already free 🎉")
        .fixedSize(horizontal: false, vertical: true)
    } else {
      if let month = whatIf.freedomMonth {
        Text("Debt-free by \(FreedomFormat.monthLabel(month))")
          .font(.system(.title2, design: .rounded, weight: .bold))
          .fixedSize(horizontal: false, vertical: true)
      } else {
        Text("No freedom date yet")
          .font(.system(.title2, design: .rounded, weight: .bold))
          .fixedSize(horizontal: false, vertical: true)
        ForEach(stuckLines(whatIf: whatIf), id: \.self) { line in
          Text(line).foregroundStyle(theme.danger).fixedSize(horizontal: false, vertical: true)
        }
      }
      Text(months == 1 ? "1 month sooner" : "\(months) months sooner")
        .font(.headline)
      MetricRow(title: "Interest saved", value: Money.format(saved))
      Text(Freedom.message(pullIn: months))
        .foregroundStyle(theme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
    }
  }

  private func stuckLines(whatIf: FreedomPlan) -> [String] {
    whatIf.payoffs.filter { $0.month == nil }.map { payoff in
      let debt = debts.first { $0.id == payoff.id }
      if let debt, Freedom.emiDoesNotCoverInterest(debt) {
        return "\(payoff.name): the EMI does not cover interest."
      }
      return "\(payoff.name) is not clearing on this EMI yet."
    }
  }

  /// Writes when the slider lets go or the toggle changes, not on each tick.
  private func persist() {
    let current = store.wowState
    let nextExtra = extraPaise
    guard nextExtra != current.extraPaise || rollOver != current.rollOver else { return }
    store.setWowState(WowState(
      extraPaise: nextExtra,
      rollOver: rollOver,
      plannedCancels: current.plannedCancels,
      fees: current.fees,
      setAside: current.setAside))
  }

  private static func sliderCeiling(_ debts: [Debt]) -> Int64 {
    let step = Freedom.extraStepPaise
    let cap = (WowState.extraPaiseMax / step) * step
    return min(cap, Freedom.extraSliderMaximum(debts: debts))
  }
}

/// One line on Overview. Free. Tap opens the Debt tab.
struct FreedomOverviewRow: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  var open: () -> Void

  var body: some View {
    if entitlements.can(.freedomDate) {
      let line = FreedomFormat.overviewLine(debts: store.dataset?.debts ?? [], now: store.reviewNow)
      Button(action: open) {
        HStack(spacing: 8) {
          Text(line)
            .font(.subheadline.weight(.semibold))
            .fixedSize(horizontal: false, vertical: true)
            .multilineTextAlignment(.leading)
          Spacer(minLength: 8)
          Image(systemName: "chevron.right")
            .font(.caption.weight(.semibold))
            .foregroundStyle(theme.secondaryText)
            .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .modifier(GlassCard())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(line)
      .accessibilityHint("Opens Debt")
      .accessibilityIdentifier("wow.freedomDate.overview")
    }
  }
}

enum FreedomFormat {
  static func baseline(debts: [Debt], now: Date) -> FreedomPlan {
    Freedom.simulate(
      debts: debts, from: Freedom.startMonth(now: now), extraPaise: 0, rollOver: false)
  }

  static func overviewLine(debts: [Debt], now: Date) -> String {
    if debts.isEmpty { return "No loans. You are already free 🎉" }
    let plan = baseline(debts: debts, now: now)
    if let month = plan.freedomMonth {
      let days = Freedom.countdown(to: month, now: now).days
      return "Debt-free by \(monthLabel(month)) · \(dayCount(days))"
    }
    if let line = stuckSummary(debts: debts, plan: plan) { return line }
    if plan.payoffs.isEmpty { return "No fixed EMI yet" }
    return "This plan is not clearing yet"
  }

  static func monthLabel(_ yyyyMM: String) -> String {
    let parts = yyyyMM.split(separator: "-")
    guard parts.count == 2, let year = Int(parts[0]), let month = Int(parts[1]),
      (1...12).contains(month)
    else { return yyyyMM }
    return "\(shortMonths[month - 1]) \(year)"
  }

  static func dayCount(_ days: Int) -> String {
    let count = max(0, days)
    let label = count == 1 ? "day" : "days"
    return "\(grouped(count)) \(label)"
  }

  private static let shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]

  private static func stuckSummary(debts: [Debt], plan: FreedomPlan) -> String? {
    let open = plan.payoffs.filter { $0.month == nil }
    guard !open.isEmpty else { return nil }
    let uncovered = open.filter { payoff in
      guard let debt = debts.first(where: { $0.id == payoff.id }) else { return false }
      return Freedom.emiDoesNotCoverInterest(debt)
    }
    if uncovered.count == 1, let name = uncovered.first?.name {
      return "\(name): the EMI does not cover interest."
    }
    if !uncovered.isEmpty { return "An EMI does not cover interest." }
    if open.count == 1, let name = open.first?.name {
      return "\(name) is not clearing on this EMI yet."
    }
    return "This plan is not clearing yet"
  }

  private static func grouped(_ value: Int) -> String {
    let digits = String(value)
    var out = ""
    for (index, char) in digits.reversed().enumerated() {
      if index > 0, index % 3 == 0 { out.append(",") }
      out.append(char)
    }
    return String(out.reversed())
  }
}
