import UIKit
import XCTest

@testable import Lakshly

final class ThemeAppIconTests: XCTestCase {
  private let alternateNames: Set<String> = [
    "AppIcon-MonochromeGold", "AppIcon-Graphite", "AppIcon-Ocean", "AppIcon-Forest", "AppIcon-RoseQuartz"
  ]

  func testMappingRoundTrip() {
    XCTAssertNil(ThemeAppIcon.alternateIconName(for: .lakshmi))
    XCTAssertEqual(ThemeAppIcon.theme(forAlternateIconName: nil), .lakshmi)
    XCTAssertEqual(ThemeAppIcon.theme(forAlternateIconName: "unknown"), .lakshmi)
    for id in ThemeID.allCases {
      XCTAssertEqual(ThemeAppIcon.theme(forAlternateIconName: ThemeAppIcon.alternateIconName(for: id)), id)
    }
    XCTAssertEqual(Set(ThemeID.allCases.compactMap { ThemeAppIcon.alternateIconName(for: $0) }), alternateNames)
  }

  func testBuiltAppDeclaresExactlyFiveAlternateIcons() throws {
    let appBundle = Bundle(for: DataStore.self)
    let icons = try XCTUnwrap(appBundle.infoDictionary?["CFBundleIcons"] as? [String: Any])
    let alternates = try XCTUnwrap(icons["CFBundleAlternateIcons"] as? [String: Any])
    XCTAssertEqual(Set(alternates.keys), alternateNames)
  }

  func testPickerImagesExistInAppBundle() {
    let appBundle = Bundle(for: DataStore.self)
    for id in ThemeID.allCases {
      XCTAssertNotNil(UIImage(named: ThemeAppIcon.previewImageName(for: id), in: appBundle,
                             compatibleWith: nil), id.rawValue)
    }
  }

  func testThemeGateAndFallback() {
    for id in ThemeID.allCases {
      for premium in [false, true] {
        XCTAssertEqual(ThemeAppIcon.isLocked(id, isPremium: premium), id.definition.premium && !premium)
        for resolved in [false, true] {
          let expected: ThemeID = id.definition.premium && !premium && resolved ? .lakshmi : id
          XCTAssertEqual(ThemeAppIcon.effectiveIcon(stored: id, isPremium: premium, hasResolved: resolved), expected)
        }
      }
    }
  }

  func testEveryManifestIDHasAnIconRecipeAndMatchingDirectoryNames() throws {
    let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "themes", withExtension: "json"))
    let manifest = try JSONDecoder().decode(ThemeManifest.self, from: Data(contentsOf: url))
    XCTAssertEqual(Set(manifest.themes.map(\.id)), Set(ThemeID.allCases.map(\.rawValue)))
    for theme in manifest.themes {
      let id = try XCTUnwrap(ThemeID(rawValue: theme.id))
      // The generator writes docs/icons/<id>/{light,dark,tinted,mac,mac-dark,web,web-dark}.svg.
      // Source SVGs aren't bundled; verify their ID-based asset naming contract here.
      XCTAssertEqual(ThemeAppIcon.previewImageName(for: id), "ThemeIcon-\(theme.id)")
      XCTAssertEqual(ThemeAppIcon.dockImageName(for: id, dark: false), "DockIcon-\(theme.id)")
      XCTAssertEqual(ThemeAppIcon.dockImageName(for: id, dark: true), "DockIcon-\(theme.id)-Dark")
      let recipe = theme.id == "lakshmi" ? "AppIcon" : "AppIcon-\(theme.id.prefix(1).uppercased())\(theme.id.dropFirst())"
      XCTAssertEqual(ThemeAppIcon.alternateIconName(for: id) ?? "AppIcon", recipe)
    }
  }

  #if DEBUG
  func testIconScreenshotOptions() {
    let options = LaunchOptions.parse(arguments: ["Lakshly", "-appIconDemo", "ocean", "-settingsScroll", "appIcon"])
    XCTAssertEqual(options.appIconDemo, "ocean")
    XCTAssertEqual(options.settingsScroll, "appIcon")
    XCTAssertTrue(ThemeAppIcon.isLocked(.ocean, isPremium: false))
  }
  #endif
}
