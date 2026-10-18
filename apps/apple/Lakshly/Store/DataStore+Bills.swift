import Foundation

extension DataStore {
  var billRadar: [RadarBill] {
    seedDemoFeesIfNeeded()
    let state = wowState
    let planned = Set(state.plannedCancels)
    let items = SubscriptionAudit.build(
      transactions: dataset?.transactions ?? [], now: reviewNow, planned: planned).items
    return BillRadar.build(
      accounts: dataset?.accounts ?? [], debts: dataset?.debts ?? [], sips: dataset?.sips ?? [],
      fees: state.fees, subscriptions: items, plannedCancels: planned, state: state.bills, now: reviewNow)
  }

  var billSummary: BillRadar.Summary { BillRadar.summary(billRadar) }

  func markBillPaid(_ id: String) {
    var state = wowState
    state.bills.paid.append(id)
    setWowState(state)
    BillNotifications.reschedule(store: self)
  }

  func unmarkBillPaid(_ id: String) {
    var state = wowState
    state.bills.paid.removeAll { $0 == id }
    setWowState(state)
    BillNotifications.reschedule(store: self)
  }

  func toggleBillMute(kind: BillKind, sourceId: String) {
    var state = wowState
    let id = "\(kind.rawValue):\(sourceId)"
    if state.bills.muted.contains(id) {
      state.bills.muted.removeAll { $0 == id }
    } else {
      state.bills.muted.append(id)
    }
    setWowState(state)
    BillNotifications.reschedule(store: self)
  }

  func setBillAlerts(on: Bool) {
    var state = wowState
    state.bills.alertsOn = on
    setWowState(state)
    BillNotifications.reschedule(store: self)
  }

  func setBillLeadDays(_ days: Int) {
    var state = wowState
    state.bills.leadDays = days
    setWowState(state)
    BillNotifications.reschedule(store: self)
  }

  func setBillAmountsInAlerts(_ on: Bool) {
    var state = wowState
    state.bills.amountsInAlerts = on
    setWowState(state)
    BillNotifications.reschedule(store: self)
  }
}
