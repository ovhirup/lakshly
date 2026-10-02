import SwiftUI

struct GlassCard: ViewModifier {
  func body(content: Content) -> some View {
    content.padding(20).glassEffect(.regular, in: .rect(cornerRadius: 24))
  }
}
extension View {
  func glassCard() -> some View { modifier(GlassCard()) }
}
