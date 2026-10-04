import SwiftUI

/// Replaces a gated section for Free members. Premium members see `content` unchanged.
struct PremiumGate<Content: View>: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let feature: Feature
  let title: String
  let message: String
  var seePremiumIdentifier: String? = nil
  @ViewBuilder var content: () -> Content
  @State private var paywallPresented = false

  var body: some View {
    if entitlements.can(feature) {
      Card(title: title, access: .unlocked) { content() }
    } else {
      VStack(alignment: .leading, spacing: theme.spacious ? 16 : 12) {
        HStack(alignment: .center, spacing: 8) {
          Image(systemName: "lock.fill")
            .foregroundStyle(theme.gold)
            .accessibilityHidden(true)
          Text(title)
            .font(.system(.title3, design: .rounded, weight: .bold))
            .fixedSize(horizontal: false, vertical: true)
          Spacer(minLength: 8)
          Pill(text: "✦ Premium", color: theme.gold)
            .accessibilityLabel("Premium")
        }
        Text(message)
          .foregroundStyle(theme.secondaryText)
          .fixedSize(horizontal: false, vertical: true)
        Button("See Premium") { paywallPresented = true }
          .buttonStyle(ThemedSubmitStyle())
          .accessibilityIdentifier(seePremiumIdentifier ?? "premium.see.\(feature.rawValue)")
          .accessibilityHint("Opens Lakshly Premium")
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .modifier(GlassCard())
      .accessibilityElement(children: .contain)
      .sheet(isPresented: $paywallPresented) {
        PaywallView(context: .feature(feature))
      }
    }
  }
}
