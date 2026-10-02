import SwiftUI

struct SettingsView: View {
  let store: DataStore
  let lock: AppLock
  @Environment(\.dismiss) private var dismiss
  @AppStorage("settings.premium") private var premium = false
  @AppStorage("settings.appLock") private var appLock = true
  @State private var reset = false
  var body: some View {
    NavigationStack {
      Form {
        Section("Your experience") {
          Toggle("Preview Premium (demo — no purchases)", isOn: $premium)
          Text(premium ? "Premium preview · UI only" : "Free · Premium features display a lock")
          Toggle("App lock", isOn: Binding(
            get: { appLock },
            set: { enabled in
              if enabled { appLock = true }
              // Turning the lock off requires device authentication when the device has one.
              else { Task { if await lock.authorizeDisablingLock() { appLock = false } } }
            }
          )).disabled(lock.authenticating)
          if let message = lock.message { Text(message).font(.caption).foregroundStyle(Theme.danger) }
        }
        Section("Private by design") {
          Text(store.encryptionStatus)
          Text(
            "No network requests, analytics, purchases or accounts. All data is synthetic. Device authentication includes passcode fallback."
          )
          if let error = store.error { Text(error).foregroundStyle(Theme.danger) }
        }
        Section { Button("Reset demo data", role: .destructive) { reset = true } }
      }.scrollContentBackground(.hidden).background { ThemeBackground() }
        .tint(Theme.gold).navigationTitle("Settings").toolbar { Button("Done") { dismiss() } }
        .confirmationDialog("Reset data and local requests?", isPresented: $reset) {
          Button("Reset demo data", role: .destructive) { store.reset() }
        }
    }.frame(minWidth: 320, minHeight: 420)
  }
}
