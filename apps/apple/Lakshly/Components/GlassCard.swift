import SwiftUI

private struct SetupRenderingKey: EnvironmentKey {
  static let defaultValue = false
}

extension EnvironmentValues {
  /// Offscreen shots skip `glassEffect`, which ImageRenderer paints as an empty panel.
  var setupRendering: Bool {
    get { self[SetupRenderingKey.self] }
    set { self[SetupRenderingKey.self] = newValue }
  }
}

struct GlassCard: ViewModifier {
  @Environment(\.theme) private var theme
  var tint: Color? = nil
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.setupRendering) private var setupRendering
  func body(content: Content) -> some View {
    let padded = content.padding(theme.spacious ? 28 : 20)
    Group {
      if setupRendering {
        padded.background(theme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
      } else {
        padded.glassEffect(
          theme.clearGlass ? .clear : .regular.tint(tint ?? theme.surface.opacity(colorScheme == .dark ? 0.38 : 0.65)),
          in: .rect(cornerRadius: 24)
        )
      }
    }
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
