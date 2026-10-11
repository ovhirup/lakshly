import AppIntents

struct HideLakshlyAmountsIntent: AppIntent {
  static var title: LocalizedStringResource = "Hide Lakshly amounts"
  static var description = IntentDescription("Hide amounts in Lakshly and its widgets.")
  static var openAppWhenRun = true
  @MainActor func perform() async throws -> some IntentResult {
    PrivacyStore.shared.setPrivacy(true, source: "intent")
    return .result()
  }
}
struct PrivacyShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: HideLakshlyAmountsIntent(), phrases: ["Hide \(.applicationName) amounts"],
                shortTitle: "Hide Lakshly amounts", systemImageName: "eye.slash")
  }
}
