import SwiftUI

/// Yearly fees, sorted, with a monthly set-aside. Premium (`Feature.feeRunway`).
struct FeeRunwayCard: View {
  @Environment(\.theme) private var theme
  @Environment(\.privacy) private var privacy
  let store: DataStore
  @State private var drafts: [String: String] = [:]
  @State private var toast: String?
  @State private var draftName = ""
  @State private var draftAmount = ""
  @State private var draftDue: Date
  @State private var repeatsYearly = true

  init(store: DataStore) {
    self.store = store
    let calendar = Calendar.current
    let later = calendar.date(byAdding: .year, value: 1, to: store.reviewNow) ?? store.reviewNow
    let bits = calendar.dateComponents([.year, .month, .day], from: later)
    let noon = calendar.date(from: DateComponents(year: bits.year, month: bits.month, day: bits.day, hour: 12)) ?? later
    _draftDue = State(initialValue: noon)
  }

  var body: some View {
    PremiumGate(
      feature: .feeRunway,
      title: "Fee runway",
      message: "Yearly fees, sorted. See what to set aside each month so insurance and card fees never surprise you."
    ) {
      runway
    }
    .accessibilityIdentifier("wow.feeRunway.card")
  }

  @ViewBuilder private var runway: some View {
    let plan = store.feeRunwayPlan()
    let found = store.feeSuggestions()
    if let toast {
      Text(toast)
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(theme.gold.opacity(0.16), in: Capsule())
        .accessibilityLabel(toast)
        .accessibilityIdentifier("wow.feeRunway.toast")
    }
    MoneyText(FeeRunwayFormat.headline(monthlyNeedPaise: plan.monthlyNeedPaise))
      .font(.system(.title3, design: .rounded, weight: .bold))
      .fixedSize(horizontal: false, vertical: true)
      .accessibilityIdentifier("wow.feeRunway.headline")
    fundedBar(plan)
    if plan.fees.isEmpty {
      Text("No fees yet. Add one so a yearly bill does not sneak up on you.")
        .foregroundStyle(theme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
    } else {
      ForEach(plan.fees) { fee in
        feeRow(fee)
      }
    }
    if !found.isEmpty {
      suggestions(found)
    }
    addForm
  }

  private func fundedBar(_ plan: RunwayPlan) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      bar(plan.fundedFraction, color: theme.gold)
      MoneyText(FeeRunwayFormat.readyLine(
        fundedPaise: plan.fundedPaise, totalPaise: plan.totalPaise, fraction: plan.fundedFraction))
        .font(.subheadline.weight(.semibold))
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("wow.feeRunway.funded")
    }
  }

  private func feeRow(_ fee: RunwayFee) -> some View {
    let tint = statusColor(fee.status)
    return VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(fee.name)
          .font(.headline)
          .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 8)
        Pill(text: FeeRunwayFormat.statusTitle(fee.status), color: tint)
          .accessibilityLabel(FeeRunwayFormat.statusTitle(fee.status))
      }
      Text(FeeRunwayFormat.dueLine(due: fee.due, daysLeft: fee.daysLeft))
        .font(.subheadline)
        .foregroundStyle(theme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
      bar(fee.fraction, color: tint)
      MoneyText(FeeRunwayFormat.perMonthLine(fee.perMonthPaise))
        .font(.subheadline.weight(.semibold))
      HStack(spacing: 8) {
        amountField(fee)
        Button("Log") { log(fee) }
          .buttonStyle(.plain)
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 10)
          .padding(.vertical, 5)
          .foregroundStyle(theme.bg)
          .background(theme.gold, in: Capsule())
          .disabled(loggedPaise(fee) == nil)
          .accessibilityLabel("Log set-aside for \(fee.name)")
          .accessibilityIdentifier("wow.feeRunway.log.\(fee.id)")
        Spacer(minLength: 8)
        Button("Paid? Reset") { reset(fee) }
          .buttonStyle(.plain)
          .font(.caption.weight(.semibold))
          .foregroundStyle(theme.secondaryText)
          .accessibilityLabel("Mark \(fee.name) as paid and reset the set-aside")
          .accessibilityIdentifier("wow.feeRunway.reset.\(fee.id)")
      }
    }
    .accessibilityIdentifier("wow.feeRunway.fee.\(fee.id)")
  }

  private func suggestions(_ found: [WowFee]) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Suggestions")
        .font(.headline)
      ForEach(found) { fee in
        HStack(alignment: .center, spacing: 8) {
          VStack(alignment: .leading, spacing: 2) {
            Text(fee.name)
              .font(.subheadline.weight(.semibold))
              .fixedSize(horizontal: false, vertical: true)
            Text("Due \(FeeRunwayFormat.dueDateLabel(fee.due))")
              .font(.caption)
              .foregroundStyle(theme.secondaryText)
          }
          Spacer(minLength: 8)
          MoneyText(Money.format(fee.amount))
            .font(.subheadline.weight(.semibold))
          Button("Add") { store.addFee(fee) }
            .buttonStyle(.plain)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .foregroundStyle(theme.bg)
            .background(theme.gold, in: Capsule())
            .accessibilityLabel("Add \(fee.name)")
            .accessibilityIdentifier("wow.feeRunway.suggest.\(fee.id)")
        }
      }
    }
    .accessibilityIdentifier("wow.feeRunway.suggestions")
  }

  private var addForm: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Add a fee")
        .font(.headline)
      TextField("Name", text: $draftName, prompt: Text("Insurance or card fee"))
        .textFieldStyle(ThemedFieldStyle())
        .accessibilityLabel("Fee name")
        .accessibilityIdentifier("wow.feeRunway.name")
      TextField("Amount", text: $draftAmount, prompt: Text("Amount"))
        .textFieldStyle(ThemedFieldStyle())
        #if os(iOS)
        .keyboardType(.decimalPad)
        #endif
        .accessibilityLabel("Fee amount")
        .accessibilityIdentifier("wow.feeRunway.newAmount")
      duePicker
      Toggle("Repeats yearly", isOn: $repeatsYearly)
        .accessibilityIdentifier("wow.feeRunway.yearly")
      Button("Add fee") { addDraft() }
        .buttonStyle(ThemedSubmitStyle())
        .disabled(!canAdd)
        .accessibilityIdentifier("wow.feeRunway.add")
    }
    .accessibilityIdentifier("wow.feeRunway.form")
  }

  @ViewBuilder private var duePicker: some View {
    #if os(macOS)
    DatePicker("Due", selection: $draftDue, displayedComponents: .date)
      .datePickerStyle(.field)
      .accessibilityLabel("Due date")
      .accessibilityIdentifier("wow.feeRunway.due")
    #else
    DatePicker("Due", selection: $draftDue, displayedComponents: .date)
      .datePickerStyle(.compact)
      .accessibilityLabel("Due date")
      .accessibilityIdentifier("wow.feeRunway.due")
    #endif
  }

  private var canAdd: Bool {
    !draftName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && FeeRunwayFormat.paise(from: draftAmount) != nil
  }

  private func amountField(_ fee: RunwayFee) -> some View {
    Group {
      if privacy.masked {
        MoneyText(Money.display(loggedPaise(fee) ?? fee.perMonthPaise, masked: true))
          .font(.subheadline.weight(.semibold))
          .frame(minWidth: 72, alignment: .leading)
      } else {
        TextField("Amount", text: draftBinding(fee))
          .textFieldStyle(.plain)
          .font(.subheadline)
          .monospacedDigit()
          .foregroundStyle(theme.text)
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .frame(width: 96)
          .background(theme.surface.opacity(0.9), in: RoundedRectangle(cornerRadius: 8))
          .overlay {
            RoundedRectangle(cornerRadius: 8)
              .strokeBorder(theme.text.opacity(0.12), lineWidth: 0.5)
              .allowsHitTesting(false)
          }
          #if os(iOS)
          .keyboardType(.decimalPad)
          #endif
      }
    }
    .accessibilityLabel("Amount to set aside for \(fee.name)")
    .accessibilityValue(Money.display(loggedPaise(fee) ?? fee.perMonthPaise, masked: privacy.masked))
    .accessibilityIdentifier("wow.feeRunway.amount.\(fee.id)")
  }

  private func draftBinding(_ fee: RunwayFee) -> Binding<String> {
    Binding(
      get: { drafts[fee.id] ?? FeeRunwayFormat.rupeeField(fee.perMonthPaise) },
      set: { drafts[fee.id] = $0 })
  }

  private func loggedPaise(_ fee: RunwayFee) -> Int64? {
    FeeRunwayFormat.paise(from: drafts[fee.id] ?? FeeRunwayFormat.rupeeField(fee.perMonthPaise))
  }

  private func bar(_ fraction: Double, color: Color) -> some View {
    let clamped = min(1, max(0, fraction.isFinite ? fraction : 0))
    return GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(theme.secondaryText.opacity(0.18))
        Capsule().fill(color).frame(width: geo.size.width * clamped)
      }
    }
    .frame(height: 10)
    .accessibilityHidden(true)
  }

  private func statusColor(_ status: FeeRunwayStatus) -> Color {
    switch status {
    case .funded: theme.success
    case .onTrack: theme.gold
    case .behind: theme.danger
    }
  }

  private func log(_ fee: RunwayFee) {
    guard let paise = loggedPaise(fee) else { return }
    if store.logFee(feeId: fee.id, paise: paise) {
      toast = "Funded 🎉 \(fee.name)"
    }
  }

  private func reset(_ fee: RunwayFee) {
    store.resetFee(feeId: fee.id)
    toast = nil
  }

  private func addDraft() {
    let name = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty, let amount = FeeRunwayFormat.paise(from: draftAmount) else { return }
    let id = "fee-\(UUID().uuidString.lowercased())"
    store.addFee(WowFee(
      id: id,
      name: name,
      amount: amount,
      due: FeeRunwayFormat.dayString(draftDue),
      yearly: repeatsYearly))
    draftName = ""
    draftAmount = ""
  }
}
