import SwiftUI

struct PrivacySettingsSection: View {
  @Environment(\.privacy) private var privacy
  var body: some View {
    @Bindable var privacy = privacy
    Section("Privacy") {
      Toggle("Hide amounts", isOn: Binding(get: { privacy.masked }, set: { privacy.setPrivacy($0, source: "settings") }))
        .accessibilityIdentifier("settings.privacy")
      Toggle("Start with amounts hidden", isOn: $privacy.startHidden)
      #if os(iOS)
      Toggle("Shake to hide", isOn: $privacy.shakeToHide)
      Toggle("Hide when screen is shared", isOn: $privacy.hideWhenCaptured)
      #else
      Toggle("Hide when I switch away", isOn: $privacy.hideOnBlur)
      #endif
      Toggle("Also hide percentages", isOn: $privacy.hidePercent)
      Toggle("Show amounts in widgets", isOn: $privacy.widgetAmounts)
        .accessibilityIdentifier("settings.showAmounts")
      // A fixed sample (not user data): how amounts look when hidden.
      Text(verbatim: "₹12,345 → \(Money.mask)")
        .monospacedDigit()
        .accessibilityLabel("Sample: amounts show as Amount hidden")
        .accessibilityIdentifier("privacy.sample")
      Text("Double-tap the net-worth total or use the eye button. Keyboard shortcut: ⌘⇧H.")
        .font(.caption)
      Text("Privacy is always included in Free. Security and privacy are never paywalled.")
        .font(.caption)
    }.accessibilityIdentifier("settings.privacySection")
  }
}
