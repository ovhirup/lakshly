import CryptoKit
import XCTest

@testable import Lakshly

final class LakshlyTests: XCTestCase {
  func testThemeManifestMatchesSwiftDefinitions() throws {
    // project.yml bundles the canonical ../../docs/themes.json as a test resource.
    let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "themes", withExtension: "json"))
    let manifest = try JSONDecoder().decode(ThemeManifest.self, from: Data(contentsOf: url))
    XCTAssertEqual(manifest.schemaVersion, 1)
    XCTAssertEqual(Set(manifest.themes.map(\.id)), Set(ThemeID.allCases.map(\.rawValue)))
    XCTAssertEqual(manifest.themes.count, ThemeID.allCases.count)
    let categories: Set<String> = ["income", "groceries", "dining", "transport", "fuel", "shopping",
      "utilities", "rent", "health", "education", "entertainment", "travel", "subscriptions",
      "insurance", "investments", "emi", "fees", "transfers", "cash", "gifts", "other"]
    let tokens: Set<String> = ["bg", "surface", "gold", "lotus", "income", "spend", "invest",
      "danger", "success", "text", "secondaryText", "lockBackground", "lockGold"]
    for id in ThemeID.allCases {
      let jsonTheme = try XCTUnwrap(manifest.themes.first { $0.id == id.rawValue })
      // Full equality includes every token/category hex, ambient value, metadata and UI flag.
      XCTAssertEqual(id.definition, jsonTheme, id.rawValue)
      for mode in [jsonTheme.light, jsonTheme.dark] {
        XCTAssertEqual(Set(mode.categories.keys), categories)
        XCTAssertEqual(Set(mode.tokens.keys), tokens)
        for hex in Array(mode.tokens.values) + Array(mode.categories.values) + [mode.ambient.primary, mode.ambient.secondary] {
          XCTAssertNotNil(hex.range(of: "^#[0-9A-F]{6}$", options: .regularExpression), hex)
        }
      }
    }
    XCTAssertEqual(ThemeID.resolve("unknown"), .lakshmi)
    XCTAssertTrue(ThemePalette(.monochromeGold).usesSemanticIcons)
    XCTAssertTrue(ThemePalette(.monochromeGold).clearGlass)
    XCTAssertTrue(ThemePalette(.monochromeGold).spacious)
  }
  func testIndianGrouping() {
    XCTAssertEqual(Money.format(1_234_567_850), "₹1,23,45,678.50")
    XCTAssertEqual(Money.format(-10000), "−₹100")
    XCTAssertEqual(Money.format(10000, dropZero: false), "₹100.00")
    XCTAssertEqual(Money.format(1), "₹0.01")
    XCTAssertEqual(Money.compact(12_000_000), "₹1.2L")
    XCTAssertEqual(Money.compact(3_400_000_000), "₹3.4Cr")
  }
  func testAuthenticatedEncryption() throws {
    let key = SymmetricKey(size: .bits256)
    let plaintext = Data("synthetic finances".utf8)
    let sealed = try SecureStore.seal(plaintext, key: key)
    XCTAssertEqual(try SecureStore.open(sealed, key: key), plaintext)
    var corrupted = sealed
    corrupted[corrupted.count - 1] ^= 1
    XCTAssertThrowsError(try SecureStore.open(corrupted, key: key))
    XCTAssertThrowsError(try SecureStore.open(sealed, key: SymmetricKey(size: .bits256)))
  }
}
