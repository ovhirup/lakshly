import SwiftUI

struct GlassCard: ViewModifier {
  var tint: Color? = nil
  @Environment(\.colorScheme) private var colorScheme
  func body(content: Content) -> some View {
    content.padding(20)
      .glassEffect(
        .regular.tint(tint ?? Theme.surface.opacity(colorScheme == .dark ? 0.38 : 0.65)),
        in: .rect(cornerRadius: 24)
      )
      .overlay {
        RoundedRectangle(cornerRadius: 24)
          .strokeBorder(
            LinearGradient(
              colors: [Theme.specular.opacity(colorScheme == .dark ? 0.32 : 0.8), Theme.clear],
              startPoint: .top, endPoint: .center
            ), lineWidth: 0.75
          ).allowsHitTesting(false).accessibilityHidden(true)
      }
  }
}
extension View {
  func glassCard() -> some View { modifier(GlassCard()) }
}
