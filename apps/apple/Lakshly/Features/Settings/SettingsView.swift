import SwiftUI

struct SettingsView: View {
  let store: DataStore
  @Environment(\.dismiss) private var dismiss
  @AppStorage("premium") private var premium = false
  @AppStorage("appLock") private var appLock = true
  @State private var reset = false
  var body: some View {
    NavigationStack {
      Form {
        Section("Your experience") {
          Toggle("Preview Premium (demo — no purchases)", isOn: $premium)
          Text(premium ? "Premium preview · UI only" : "Free · Premium features display a lock")
          Toggle("App lock", isOn: $appLock)
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
