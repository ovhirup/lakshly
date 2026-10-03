#if os(macOS)
import AppKit
import LocalAuthentication
import SwiftUI

struct DeviceOwnerAuthenticator: GlanceAuthenticating {
  func canEvaluate() -> Bool {
    var error: NSError?
    return LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
  }

  func evaluate(reason: String) async throws -> Bool {
    try await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
  }
}

struct MenuBarPanel: View {
  @Environment(DataStore.self) private var store
  @Environment(EntitlementStore.self) private var entitlements
  @Environment(\.openWindow) private var openWindow
  @Environment(\.theme) private var theme
  @AppStorage("settings.appearance") private var appearance = "system"
  @State private var session = GlanceRevealSession(authenticator: DeviceOwnerAuthenticator())

  var body: some View {
    MenuBarGlanceBody(
      snapshot: session.snapshot ?? storedGlance(),
      revealed: session.isRevealed,
      premium: entitlements.can(.extraWidgets),
      message: session.message,
      onReveal: toggleReveal,
      onOpen: openLakshly,
      onQuit: { NSApplication.shared.terminate(nil) })
      .onDisappear { session.noteClosed() }
      .background(MenuBarLockMonitor { session.noteLocked() })
      .task(id: session.isRevealed) {
        while session.isRevealed {
          try? await Task.sleep(for: .seconds(1))
          session.expireIfNeeded()
        }
      }
  }

  /// The panel reads the saved glance with amounts removed. Reveal builds a separate in-memory snapshot.
  private func storedGlance() -> GlanceSnapshot? {
    if let stored = GlanceStore.read() { return stored.omittingAmounts() }
    guard let dataset = store.dataset else { return nil }
    return GlanceBuilder.build(
      dataset: dataset,
      now: Date(),
      includeAmounts: false,
      tier: entitlements.tier,
      themeID: theme.id.rawValue,
      appearance: LaunchOptions.current.appearance ?? appearance)
  }

  private func toggleReveal() {
    if session.isRevealed {
      session.hide()
      return
    }
    let tier = entitlements.tier
    let themeID = theme.id.rawValue
    let appearance = LaunchOptions.current.appearance ?? appearance
    Task {
      await session.reveal(tier: tier, themeID: themeID, appearance: appearance) {
        try GlanceVault.dataset(from: store)
      }
    }
  }

  private func openLakshly() {
    openWindow(id: "main")
    NSApp.activate(ignoringOtherApps: true)
  }
}

private struct MenuBarLockMonitor: View {
  var onLock: () -> Void
  var body: some View {
    Color.clear
      .frame(width: 0, height: 0)
      .onReceive(NotificationCenter.default.publisher(for: NSWorkspace.willSleepNotification)) { _ in onLock() }
      .onReceive(NotificationCenter.default.publisher(for: NSWorkspace.screensDidSleepNotification)) { _ in onLock() }
      .onReceive(DistributedNotificationCenter.default().publisher(for: Notification.Name("com.apple.screenIsLocked"))) { _ in
        onLock()
      }
  }
}
#endif
