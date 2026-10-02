import SwiftUI

struct GlassCard: ViewModifier {
  @Environment(\.theme) private var theme
  var tint: Color? = nil
  @Environment(\.colorScheme) private var colorScheme
  func body(content: Content) -> some View {
    content.padding(theme.spacious ? 28 : 20)
      .glassEffect(
        theme.clearGlass ? .clear : .regular.tint(tint ?? theme.surface.opacity(colorScheme == .dark ? 0.38 : 0.65)),
        in: .rect(cornerRadius: 24)
      )
      .overlay {
        if !theme.clearGlass {
        RoundedRectangle(cornerRadius: 24)
          .strokeBorder(
            LinearGradient(
              colors: [theme.specular.opacity(colorScheme == .dark ? 0.32 : 0.8), theme.clear],
              startPoint: .top, endPoint: .center
            ), lineWidth: 0.75
          ).allowsHitTesting(false).accessibilityHidden(true)
        }
      }
  }
}
extension View {
  func glassCard() -> some View { modifier(GlassCard()) }
}
