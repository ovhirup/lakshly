import Foundation

extension DataStore {
  /// Wow preferences for the active source. A missing copy is a fresh default.
  var wowState: WowState {
    switch source {
    case .demo: wowDemo ?? WowState()
    case .mine: wow ?? WowState()
    }
  }

  /// Saves the active source's wow state inside the encrypted payload.
  func setWowState(_ state: WowState) {
    let state = WowState(
      extraPaise: state.extraPaise, rollOver: state.rollOver, plannedCancels: state.plannedCancels,
      fees: state.fees, setAside: state.setAside)
    switch source {
    case .demo: wowDemo = state
    case .mine: wow = state
    }
    save()
  }

  /// Runway for the active source. Demo with no fees yet gets the three synthetic fees.
  func feeRunwayPlan() -> RunwayPlan {
    seedDemoFeesIfNeeded()
    let state = wowState
    let plan = FeeRunway.plan(fees: state.fees, setAside: state.setAside, now: reviewNow)
    if !runwayMatches(state, plan) {
      var updated = state
      updated.fees = plan.fees.map {
        WowFee(id: $0.id, name: $0.name, amount: $0.amount, due: $0.due, yearly: $0.yearly)
      }
      var pots: [String: Int64] = [:]
      for fee in plan.fees { pots[fee.id] = fee.setAside }
      updated.setAside = pots
      setWowState(updated)
    }
    return plan
  }

  @discardableResult
  func logFee(feeId: String, paise: Int64) -> Bool {
    guard paise > 0 else { return false }
    var state = wowState
    let outcome = FeeRunway.log(fees: state.fees, setAside: state.setAside, feeId: feeId, paise: paise)
    guard outcome.changed else { return false }
    state.setAside = outcome.setAside
    setWowState(state)
    return outcome.fundedNow
  }

  func resetFee(feeId: String) {
    var state = wowState
    state.setAside = FeeRunway.reset(setAside: state.setAside, feeId: feeId)
    setWowState(state)
  }

  func addFee(_ fee: WowFee) {
    var state = wowState
    state.fees.removeAll { $0.id == fee.id }
    state.fees.append(fee)
    setWowState(state)
  }

  func removeFee(feeId: String) {
    var state = wowState
    state.fees.removeAll { $0.id == feeId }
    var pots = state.setAside
    pots[feeId] = nil
    state.setAside = pots
    setWowState(state)
  }

  /// Suggestions from the active dataset. Adding one is what turns it into a fee.
  func feeSuggestions() -> [WowFee] {
    FeeRunway.suggestions(transactions: dataset?.transactions ?? [], now: reviewNow, fees: wowState.fees)
  }

  private func seedDemoFeesIfNeeded() {
    guard source == .demo else { return }
    var state = wowState
    guard state.fees.isEmpty else { return }
    let seeded = FeeRunway.demoSeed(now: reviewNow)
    state.fees = seeded.fees
    for fee in seeded.fees {
      state.setAside[fee.id] = seeded.setAside[fee.id] ?? 0
    }
    setWowState(state)
  }

  private func runwayMatches(_ state: WowState, _ plan: RunwayPlan) -> Bool {
    guard state.fees.count == plan.fees.count else { return false }
    for fee in plan.fees {
      guard let stored = state.fees.first(where: { $0.id == fee.id }) else { return false }
      if stored.name != fee.name || stored.amount != fee.amount || stored.due != fee.due || stored.yearly != fee.yearly {
        return false
      }
      if (state.setAside[fee.id] ?? 0) != fee.setAside { return false }
    }
    return true
  }
}
