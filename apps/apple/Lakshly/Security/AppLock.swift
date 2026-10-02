import Foundation
import LocalAuthentication
import Observation

/// Coordinates device authentication and the no-op forced lock-screen preview.
@MainActor @Observable final class AppLock {
  var locked = true
  var canAuthenticate = false
  var authenticating = false
  var message: String?
  private var generation = 0
  let forced = UserDefaults.standard.bool(forKey: "showLock")
  let demoUnlocked = UserDefaults.standard.bool(forKey: "demoUnlocked")
  init() {
    locked = forced || !demoUnlocked
    refresh()
  }
  func refresh() {
    var error: NSError?
    canAuthenticate = LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
  }
  func relock(enabled: Bool) {
    if forced || (enabled && !demoUnlocked) {
      generation += 1
      locked = true
      refresh()
    }
  }
  func unlock() async {
    guard !forced, !authenticating else { return }
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
      refresh()
      return
    }
    let attempt = generation
    authenticating = true
    defer { authenticating = false }
    do {
      if try await context.evaluatePolicy(
        .deviceOwnerAuthentication, localizedReason: "Keep your finances private"),
        attempt == generation
      {
        locked = false
        message = nil
      }
    } catch { message = "Authentication was not completed. Try again." }
  }
  func continueDemo() { if !forced && !canAuthenticate { locked = false } }
}
