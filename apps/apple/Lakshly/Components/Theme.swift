import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

// Values are generated into Swift so the app never needs filesystem or network access.
enum ThemeID: String, CaseIterable, Identifiable {
  case lakshmi, monochromeGold, graphite, ocean, forest, roseQuartz
  var id: String { rawValue }
  static func resolve(_ value: String) -> ThemeID { ThemeID(rawValue: value) ?? .lakshmi }
}
struct ThemeManifest: Codable {
  let schemaVersion: Int
  let themes: [ThemeDefinition]
}
struct ThemeDefinition: Codable, Equatable {
  let id: String
  let name: String
  let premium: Bool
  let description: String
  let usesSemanticIcons: Bool
  let spacious: Bool
  let clearGlass: Bool
  let light: ThemeMode
  let dark: ThemeMode
}
struct ThemeMode: Codable, Equatable {
  let tokens: [String: String]
  let categories: [String: String]
  let ambient: ThemeAmbient
}
struct ThemeAmbient: Codable, Equatable {
  let primary: String
  let secondary: String
  let primaryOpacity: Double
  let secondaryOpacity: Double
}

extension Color {
  init(hex: String) {
    let value = UInt32(hex.dropFirst(), radix: 16)!
    self.init(.sRGB, red: Double((value >> 16) & 255) / 255,
              green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255, opacity: 1)
  }
  init(light: String, dark: String) {
    #if os(iOS)
    self.init(uiColor: UIColor { traits in
      UIColor(Color(hex: traits.userInterfaceStyle == .dark ? dark : light))
    })
    #else
    self.init(nsColor: NSColor(name: nil) { appearance in
      NSColor(Color(hex: appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light))
    })
    #endif
  }
}

struct ThemePalette {
  let id: ThemeID
  /// When set, tokens resolve to that appearance instead of following the system trait collection.
  var forcedScheme: ColorScheme?
  init(_ id: ThemeID = .lakshmi, scheme: ColorScheme? = nil) {
    self.id = id
    self.forcedScheme = scheme
  }
  var definition: ThemeDefinition { id.definition }
  var usesSemanticIcons: Bool { definition.usesSemanticIcons }
  var spacious: Bool { definition.spacious }
  var clearGlass: Bool { definition.clearGlass }
  private func color(_ token: String) -> Color {
    let light = definition.light.tokens[token]!
    let dark = definition.dark.tokens[token]!
    if let forcedScheme { return Color(hex: forcedScheme == .dark ? dark : light) }
    return Color(light: light, dark: dark)
  }
  var bg: Color { color("bg") }
  var surface: Color { color("surface") }
  var gold: Color { color("gold") }
  var lotus: Color { color("lotus") }
  var income: Color { color("income") }
  var spend: Color { color("spend") }
  var invest: Color { color("invest") }
  var danger: Color { color("danger") }
  var success: Color { color("success") }
  var text: Color { color("text") }
  var secondaryText: Color { color("secondaryText") }
  var lockBackground: Color { color("lockBackground") }
  var lockGold: Color { color("lockGold") }
  var indigo: Color { category("rent") }
  var slate: Color { category("other") }
  var specular: Color { .white }
  var clear: Color { .clear }
  func category(_ name: String) -> Color {
    let key = name.lowercased()
    let light = definition.light.categories[key] ?? definition.light.categories["other"]!
    let dark = definition.dark.categories[key] ?? definition.dark.categories["other"]!
    if let forcedScheme { return Color(hex: forcedScheme == .dark ? dark : light) }
    return Color(light: light, dark: dark)
  }
}
extension EnvironmentValues {
  @Entry var theme = ThemePalette()
}

struct ThemeBackground: View {
  @Environment(\.theme) private var theme
  @Environment(\.colorScheme) private var colorScheme
  var body: some View {
    let ambient = (colorScheme == .dark ? theme.definition.dark : theme.definition.light).ambient
    GeometryReader { geometry in
      ZStack {
        theme.bg
        if ambient.primaryOpacity > 0 {
          RadialGradient(colors: [Color(hex: ambient.primary).opacity(ambient.primaryOpacity), .clear],
            center: .topLeading, startRadius: 0,
            endRadius: max(geometry.size.width, geometry.size.height) * 0.9)
          RadialGradient(colors: [Color(hex: ambient.secondary).opacity(ambient.secondaryOpacity), .clear],
            center: .bottomTrailing, startRadius: 0,
            endRadius: max(geometry.size.width, geometry.size.height) * 0.8)
        }
      }
    }.ignoresSafeArea().allowsHitTesting(false).accessibilityHidden(true)
  }
}

struct ThemedFieldStyle: TextFieldStyle {
  @Environment(\.theme) private var theme
  func _body(configuration: TextField<Self._Label>) -> some View {
    configuration.textFieldStyle(.plain).foregroundStyle(theme.text)
      .padding(.horizontal, 14).padding(.vertical, 12)
      .background(theme.surface.opacity(0.9), in: RoundedRectangle(cornerRadius: 12))
      .overlay {
        RoundedRectangle(cornerRadius: 12).strokeBorder(theme.text.opacity(0.12), lineWidth: 0.5)
          .allowsHitTesting(false)
      }
  }
}
struct ThemedSubmitStyle: ButtonStyle {
  @Environment(\.theme) private var theme
  @Environment(\.isEnabled) private var isEnabled
  func makeBody(configuration: Configuration) -> some View {
    configuration.label.font(.body.weight(.semibold))
      .foregroundStyle(isEnabled ? theme.gold : theme.secondaryText)
      .padding(.horizontal, 20).padding(.vertical, 12)
      .background(theme.surface, in: Capsule())
      .overlay { Capsule().strokeBorder(isEnabled ? theme.gold : theme.secondaryText, lineWidth: 0.75) }
      .scaleEffect(configuration.isPressed ? 0.98 : 1)
  }
}
