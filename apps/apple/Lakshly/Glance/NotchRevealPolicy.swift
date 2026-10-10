import Foundation

/// Whether the notch panel is allowed to exist. Amounts are a separate, shorter-lived flag.
struct NotchRevealState: Equatable, Sendable {
  var panelEnabled: Bool
  var revealedUntil: Date?

  /// Amounts start hidden. Callers that have not checked the entitlement start from `disabled` instead.
  static let initial = NotchRevealState(panelEnabled: true, revealedUntil: nil)
  static let disabled = NotchRevealState(panelEnabled: false, revealedUntil: nil)

  var isRevealed: Bool { panelEnabled && revealedUntil != nil }
}

enum NotchRevealEvent: Equatable, Sendable {
  case configure(enabled: Bool, entitled: Bool, hasNotch: Bool)
  case reveal(now: Date)
  case tick(now: Date)
  case collapse
  case lock
  case sleep
  case spaceChange
}

enum NotchRevealPolicy {
  /// Notch amounts hide sooner than the menu-bar extra, which stays at 60 seconds.
  static let revealDuration: TimeInterval = 30

  static func reduce(_ state: NotchRevealState, _ event: NotchRevealEvent) -> NotchRevealState {
    switch event {
    case let .configure(enabled, entitled, hasNotch):
      guard enabled, entitled, hasNotch else { return .disabled }
      // Turning the panel on must not keep amounts from an earlier session.
      if state.panelEnabled { return state }
      return NotchRevealState(panelEnabled: true, revealedUntil: nil)
    case let .reveal(now):
      guard state.panelEnabled else { return state }
      return NotchRevealState(panelEnabled: true, revealedUntil: now.addingTimeInterval(revealDuration))
    case let .tick(now):
      guard let until = state.revealedUntil, now >= until else { return state }
      return hidingAmounts(state)
    case .collapse, .lock, .sleep, .spaceChange:
      return hidingAmounts(state)
    }
  }

  static func hidingAmounts(_ state: NotchRevealState) -> NotchRevealState {
    NotchRevealState(panelEnabled: state.panelEnabled, revealedUntil: nil)
  }
}
