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
}
