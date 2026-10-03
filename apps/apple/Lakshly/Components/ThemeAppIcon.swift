/// Asset recipes shared by the picker and platform icon controllers.
/// Names mirror scripts/generate_theme_icons.mjs and docs/icons/<themeId>/.
enum ThemeAppIcon {
  static func alternateIconName(for id: ThemeID) -> String? {
    switch id {
    case .lakshmi: nil
    case .monochromeGold: "AppIcon-MonochromeGold"
    case .graphite: "AppIcon-Graphite"
    case .ocean: "AppIcon-Ocean"
    case .forest: "AppIcon-Forest"
    case .roseQuartz: "AppIcon-RoseQuartz"
    }
  }

  static func theme(forAlternateIconName name: String?) -> ThemeID {
    ThemeID.allCases.first { alternateIconName(for: $0) == name } ?? .lakshmi
  }

  static func previewImageName(for id: ThemeID) -> String { "ThemeIcon-\(id.rawValue)" }

  static func dockImageName(for id: ThemeID, dark: Bool) -> String {
    "DockIcon-\(id.rawValue)\(dark ? "-Dark" : "")"
  }

  static func isLocked(_ id: ThemeID, isPremium: Bool) -> Bool {
    id.definition.premium && !isPremium
  }

  static func effectiveIcon(stored: ThemeID, isPremium: Bool, hasResolved: Bool) -> ThemeID {
    hasResolved && isLocked(stored, isPremium: isPremium) ? .lakshmi : stored
  }
}
