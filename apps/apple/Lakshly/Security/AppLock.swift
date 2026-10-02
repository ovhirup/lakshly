import Foundation
import LocalAuthentication
import Observation

/// Only an explicitly unprotected device can enter demo mode without authentication.
enum DeviceAuthenticationPolicy {
  static func allowsDemo(errorCode: LAError.Code?) -> Bool {
    errorCode == .passcodeNotSet
  }

  static func errorCode(_ error: NSError?) -> LAError.Code? {
    guard let error, error.domain == LAError.errorDomain else { return nil }
    return LAError.Code(rawValue: error.code)
  }
}

/// Coordinates device authentication and the no-op forced lock-screen preview.
@MainActor @Observable final class AppLock {
  var locked = true
  var canAuthenticate = false
  var allowDemo = false
  var authenticating = false
  var message: String?
  private var generation = 0
  let forced: Bool
  private let skipAuthentication: Bool

  init() {
    #if DEBUG
    let options = LaunchOptions.current
    forced = options.showLock ?? false
    skipAuthentication = options.demoUnlocked ?? false
    #else
    forced = false
    skipAuthentication = false
    #endif
    locked = forced || !skipAuthentication
    refresh()
  }

  func refresh() {
    var error: NSError?
    canAuthenticate = LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    allowDemo = !canAuthenticate && DeviceAuthenticationPolicy.allowsDemo(
      errorCode: DeviceAuthenticationPolicy.errorCode(error))
    if !canAuthenticate && !allowDemo {
      message = "Device authentication is unavailable. Try again."
    }
  }

  func relock(enabled: Bool) {
    if forced || (enabled && !skipAuthentication) {
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
      } else {
        message = "Authentication was not completed. Try again."
      }
    } catch { message = "Authentication was not completed. Try again." }
  }

  func continueDemo() {
    guard !forced, !authenticating else { return }
    // Recheck, even if the UI previously offered demo mode. passcodeNotSet means
    // there is no device passcode/password to bypass; every other error fails closed.
    refresh()
    if allowDemo {
      locked = false
      message = nil
    }
  }

  func authorizeDisablingLock() async -> Bool {
    guard !forced, !authenticating else { return false }
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
      // Disabling is safe without authentication only on a device with no lock.
      let allowed = DeviceAuthenticationPolicy.allowsDemo(
        errorCode: DeviceAuthenticationPolicy.errorCode(error))
      if !allowed { message = "App lock stays on. Device authentication is unavailable. Try again." }
      return allowed
    }
    let attempt = generation
    // Shared with RootView so the authentication prompt does not dismiss Settings.
    authenticating = true
    defer { authenticating = false }
    do {
      let success = try await context.evaluatePolicy(
        .deviceOwnerAuthentication, localizedReason: "Authenticate to turn off App lock")
      if success && attempt == generation {
        message = nil
        return true
      }
    } catch { }
    message = "App lock stays on. Authentication was not completed. Try again."
    return false
  }
}
