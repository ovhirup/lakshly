import SwiftUI

enum BillRadarSections {
  struct Group: Identifiable {
    var id: String { title }
    var title: String
    var bills: [RadarBill]
  }

  static func group(_ bills: [RadarBill]) -> [Group] {
    [Group(title: "Today", bills: bills.filter { $0.daysLeft == 0 }),
     Group(title: "This week", bills: bills.filter { (1...6).contains($0.daysLeft) }),
     Group(title: "Later", bills: bills.filter { (7...45).contains($0.daysLeft) })]
      .filter { !$0.bills.isEmpty }
  }

  static func upcoming(_ bills: [RadarBill]) -> [RadarBill] {
    Array(bills.filter { !$0.paid && (0...45).contains($0.daysLeft) }
      .sorted { $0.daysLeft == $1.daysLeft ? $0.id < $1.id : $0.daysLeft < $1.daysLeft }.prefix(3))
  }

  static func lockedCopy(_ count: Int) -> String { "\(count) more bills won’t alert you" }
}

struct BillRadarView: View {
  let store: DataStore
  @Environment(\.theme) private var theme
  @Environment(\.privacy) private var privacy

  var body: some View {
    Page(title: "Bill radar", subtitle: "Card dues, EMIs, insurance, fees and subscriptions in the next 45 days") {
      Card(title: "\(store.billSummary.dueThisWeek) due this week") {
        MoneyText(Money.display(store.billSummary.dueThisWeekPaise, masked: privacy.masked))
          .font(.title2.bold())
        if let next = store.billSummary.next {
          Text("Next: \(next.name) · \(BillRadar.dueText(next.daysLeft))")
            .foregroundStyle(theme.secondaryText)
        }
      }.accessibilityIdentifier("bills.summary")
      if store.billRadar.isEmpty {
        Card(title: "Nothing due in the next 45 days") { EmptyView() }
      }
      ForEach(BillRadarSections.group(store.billRadar)) { section in
        Card(title: section.title) {
          ForEach(section.bills) { bill in
            row(bill)
          }
        }
      }
      BillAlertsCard(store: store)
    }.accessibilityIdentifier("bills.page")
  }

  private func row(_ bill: RadarBill) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top) {
        Image(systemName: symbol(bill.kind)).foregroundStyle(theme.gold).accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 4) {
          Text(bill.name).font(.headline).fixedSize(horizontal: false, vertical: true)
          Text("\(BillRadar.dueText(bill.daysLeft)) · \(SubscriptionAudit.shortDay(bill.due))")
            .font(.caption).foregroundStyle(theme.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
          if bill.paid { Text("Paid ✓").font(.caption).foregroundStyle(theme.success) }
        }
        Spacer()
        if let amount = bill.amount {
          MoneyText(Money.display(amount, masked: privacy.masked)).font(.subheadline.bold()).fixedSize()
        }
      }
      HStack {
        Button(bill.paid ? "Undo" : "Mark paid") {
          if bill.paid { store.unmarkBillPaid(bill.id) }
          else { store.markBillPaid(bill.id) }
        }
        .accessibilityLabel("\(bill.paid ? "Undo payment for" : "Mark paid") \(bill.name)")
        .accessibilityIdentifier("bills.markPaid")
        .fixedSize()
        Spacer()
        Toggle(isOn: Binding(get: { !bill.muted }, set: { _ in
          store.toggleBillMute(kind: bill.kind, sourceId: bill.sourceId)
        })) {
          Label(bill.muted ? "Alerts off" : "Alerts on", systemImage: bill.muted ? "bell.slash" : "bell")
        }
        .toggleStyle(.button)
        .accessibilityLabel("Alerts for \(bill.name)")
        .accessibilityIdentifier("bills.mute")
        .fixedSize()
      }.buttonStyle(.bordered)
    }.padding(.vertical, 6).opacity(bill.paid ? 0.55 : 1)
      .accessibilityIdentifier("bills.row")
  }

  private func symbol(_ kind: BillKind) -> String {
    switch kind {
    case .card: "creditcard"
    case .emi: "building.columns"
    case .sip: "chart.line.uptrend.xyaxis"
    case .insurance: "shield"
    case .fee: "doc.text"
    case .subscription: "repeat"
    }
  }
}

struct BillAlertsCard: View {
  let store: DataStore
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements

  var body: some View {
    Card(title: "Bill alerts") {
      Toggle("Bill alerts", isOn: Binding(get: { store.wowState.bills.alertsOn }, set: {
        BillNotifications.setEnabled($0, store: store)
      }))
      .accessibilityLabel("Bill alerts").accessibilityIdentifier("bills.enabled")
      Picker("Remind me", selection: Binding(get: { store.wowState.bills.leadDays }, set: {
        store.setBillLeadDays($0)
      })) {
        ForEach([1, 3, 7], id: \.self) { days in
          Text(days == 1 ? "1 day before" : "\(days) days before").tag(days)
        }
      }.accessibilityLabel("Days before bill is due").accessibilityIdentifier("bills.leadDays")
      Toggle("Show amounts in alerts", isOn: Binding(get: { store.wowState.bills.amountsInAlerts }, set: {
        store.setBillAmountsInAlerts($0)
      })).accessibilityLabel("Show amounts in alerts").accessibilityIdentifier("bills.amounts")
      Text("Amounts appear only when Show amounts on Lock Screen is allowed in Settings.")
        .font(.caption).foregroundStyle(theme.secondaryText)
      Text("Free shows alerts for your next 3 bills").font(.caption).foregroundStyle(theme.secondaryText)
      let result = BillRadar.alerts(store.billRadar, state: store.wowState.bills,
        limit: FeatureLimit(tierLimit: entitlements.limit(.billAlerts)), includeAmounts: false, now: store.reviewNow)
      if entitlements.limit(.billAlerts) == 3, result.lockedCount > 0 {
        HStack {
          Label(BillRadarSections.lockedCopy(result.lockedCount), systemImage: "lock.fill")
            .fixedSize(horizontal: false, vertical: true)
          Spacer()
          Pill(text: "✦ Premium", color: theme.gold).fixedSize()
        }.font(.subheadline).padding(12).modifier(GlassCard())
      }
    }.accessibilityIdentifier("bills.alerts")
  }
}

struct BillsOverviewCard: View {
  let store: DataStore
  var open: () -> Void
  @Environment(\.privacy) private var privacy
  @Environment(\.theme) private var theme

  var body: some View {
    Card(title: "Bill radar") {
      let upcoming = BillRadarSections.upcoming(store.billRadar)
      if upcoming.isEmpty { Text("Nothing due in the next 45 days").foregroundStyle(theme.secondaryText) }
      ForEach(upcoming) { bill in
        HStack {
          VStack(alignment: .leading) {
            Text(bill.name).font(.subheadline.bold()).fixedSize(horizontal: false, vertical: true)
            Text(BillRadar.dueText(bill.daysLeft)).font(.caption).foregroundStyle(theme.secondaryText)
          }
          Spacer()
          if let amount = bill.amount { MoneyText(Money.display(amount, masked: privacy.masked)) }
        }
      }
      Button("Open bill radar →", action: open)
        .accessibilityLabel("Open bill radar").accessibilityIdentifier("bills.open")
    }.accessibilityIdentifier("overview.bills")
  }
}
