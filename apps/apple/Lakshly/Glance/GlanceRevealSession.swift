import Foundation
import Observation

protocol GlanceAuthenticating {
  func canEvaluate() -> Bool
  func evaluate(reason: String) async throws -> Bool
}

/// In-memory amount reveal. The revealed snapshot is never written to the glance file.
@MainActor @Observable final class GlanceRevealSession {
  static let revealReason = "Reveal Lakshly amounts"
  static let unavailableMessage = "Amounts stay hidden until this Mac has a password or Touch ID."
  static let failedMessage = "Lakshly couldn't confirm it's you. Amounts stay hidden."

  private(set) var snapshot: GlanceSnapshot?
  private(set) var message: String?
  private var deadline: Date?
  private var token = UUID()
  var duration: TimeInterval = 60
  var now: () -> Date
  private let authenticator: GlanceAuthenticating

  init(authenticator: GlanceAuthenticating, now: @escaping () -> Date = { Date() }) {
    self.authenticator = authenticator
    self.now = now
  }

  var isRevealed: Bool { snapshot != nil }

  func hide() {
    token = UUID()
    snapshot = nil
    deadline = nil
    message = nil
  }

  func noteClosed() { hide() }
  func noteLocked() { hide() }

  func expireIfNeeded() {
    if let deadline, now() >= deadline { hide() }
  }

  func reveal(
    tier: Tier,
    themeID: String,
    appearance: String,
    loadDataset: () throws -> Dataset
  ) async {
    hide()
    let current = token
    guard authenticator.canEvaluate() else {
      message = Self.unavailableMessage
      return
    }
    let started = now()
    do {
      let ok = try await authenticator.evaluate(reason: Self.revealReason)
      guard current == token else { return }
      guard ok else {
        message = Self.failedMessage
        return
      }
      let dataset = try loadDataset()
      guard current == token else { return }
      snapshot = GlanceBuilder.build(
        dataset: dataset,
        now: started,
        includeAmounts: true,
        tier: tier,
        themeID: themeID,
        appearance: appearance)
      deadline = started.addingTimeInterval(duration)
    } catch {
      guard current == token else { return }
      snapshot = nil
      deadline = nil
      message = Self.failedMessage
    }
  }
}

@MainActor enum GlanceVault {
  /// Active dataset already held in memory (demo seed or imported rows).
  static func dataset(from store: DataStore) throws -> Dataset {
    if let dataset = store.dataset { return dataset }
    throw CocoaError(.fileReadNoSuchFile)
  }
}
