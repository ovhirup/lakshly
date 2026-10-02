#if DEBUG
import LocalAuthentication
import XCTest

@testable import Lakshly

final class SecurityTests: XCTestCase {
  func testLaunchOptionsParsesScreenshotArguments() {
    let options = LaunchOptions.parse(arguments: ["Lakshly", "-demoUnlocked", "YES",
      "-startTab", "spend", "-theme", "ocean", "-appearance", "dark",
      "-openSettings", "YES", "-showPaywall", "YES", "-showLock", "YES", "-importDemo", "preview",
      "-importDemoFile", "cas"])
    XCTAssertEqual(options.demoUnlocked, true)
    XCTAssertEqual(options.showLock, true)
    XCTAssertEqual(options.startTab, "spend")
    XCTAssertEqual(options.openSettings, true)
    XCTAssertEqual(options.showPaywall, true)
    XCTAssertEqual(options.appearance, "dark")
    XCTAssertEqual(options.theme, "ocean")
    XCTAssertEqual(options.importDemo, "preview")
    XCTAssertEqual(options.importDemoFile, "cas")
  }

  func testLaunchOptionsRejectsMalformedAndPersistedKeys() {
    let empty = LaunchOptions.parse(arguments: ["Lakshly"])
    XCTAssertNil(empty.demoUnlocked)
    XCTAssertNil(empty.showLock)
    XCTAssertNil(empty.startTab)
    XCTAssertNil(empty.openSettings)
    XCTAssertNil(empty.showPaywall)
    XCTAssertNil(empty.appearance)
    XCTAssertNil(empty.theme)
    XCTAssertNil(empty.importDemo)
    XCTAssertNil(empty.importDemoFile)

    let options = LaunchOptions.parse(arguments: ["Lakshly", "-appLock", "NO",
      "-premium", "YES", "-settings.appLock", "NO", "-demoUnlocked", "invalid",
      "-showLock", "NO", "-openSettings", "false", "-theme", "-startTab", "budget",
      "-appearance"])
    XCTAssertNil(options.demoUnlocked)
    XCTAssertEqual(options.showLock, false)
    XCTAssertEqual(options.openSettings, false)
    XCTAssertNil(options.showPaywall)
    XCTAssertEqual(options.startTab, "budget")
    XCTAssertNil(options.theme)
    XCTAssertNil(options.appearance)
    XCTAssertNil(options.importDemo)
    XCTAssertNil(options.importDemoFile)
    XCTAssertEqual(LaunchOptions.parse(arguments: ["Lakshly", "-demoUnlocked", "YES",
      "-demoUnlocked", "NO"]).demoUnlocked, false)
  }

  func testDemoRequiresExplicitlyMissingDevicePasscode() {
    XCTAssertTrue(DeviceAuthenticationPolicy.allowsDemo(errorCode: .passcodeNotSet))
    XCTAssertFalse(DeviceAuthenticationPolicy.allowsDemo(errorCode: nil))
    // Exercise all known codes in LAError's range, including future SDK additions.
    for rawValue in -1100...0 {
      guard let code = LAError.Code(rawValue: rawValue), code != .passcodeNotSet else { continue }
      XCTAssertFalse(DeviceAuthenticationPolicy.allowsDemo(errorCode: code), "LAError \(rawValue)")
    }
    XCTAssertNil(DeviceAuthenticationPolicy.errorCode(NSError(
      domain: "untrusted", code: LAError.passcodeNotSet.rawValue)))
    XCTAssertEqual(DeviceAuthenticationPolicy.errorCode(NSError(
      domain: LAError.errorDomain, code: LAError.passcodeNotSet.rawValue)), .passcodeNotSet)
  }

  func testPreferencesClearArgumentsAndMigrateOnlyPersistentValues() throws {
    let domain = "app.lakshly.security-test.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: domain))
    defer { defaults.removePersistentDomain(forName: domain) }
    defaults.setPersistentDomain(["appLock": true, "premium": false, "themeID": "forest",
      "appearance": "light", "settings.themeID": "graphite", "settings.premium": true], forName: domain)
    defaults.setVolatileDomain(["appLock": false, "premium": true,
      "settings.appLock": false, "settings.premium": true, "appearance": "dark"],
      forName: UserDefaults.argumentDomain)

    SettingsPreferences.prepare(defaults: defaults, domainName: domain)
    XCTAssertTrue(defaults.volatileDomain(forName: UserDefaults.argumentDomain).isEmpty)
    XCTAssertTrue(defaults.bool(forKey: "settings.appLock"))
    XCTAssertNil(defaults.object(forKey: "settings.premium"))
    XCTAssertFalse(defaults.bool(forKey: "settings.premium"))
    XCTAssertEqual(defaults.string(forKey: "settings.themeID"), "graphite")
    XCTAssertEqual(defaults.string(forKey: "settings.appearance"), "light")
    let migrated = try XCTUnwrap(defaults.persistentDomain(forName: domain))
    for key in ["appLock", "premium", "themeID", "appearance"] { XCTAssertNil(migrated[key]) }
    SettingsPreferences.prepare(defaults: defaults, domainName: domain)
    XCTAssertEqual(defaults.persistentDomain(forName: domain) as NSDictionary?, migrated as NSDictionary)
  }

  func testArgumentOnlyPreferencesAreNotMigrated() throws {
    let domain = "app.lakshly.security-test.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: domain))
    defer { defaults.removePersistentDomain(forName: domain) }
    defaults.setVolatileDomain(["appLock": false, "premium": true, "appearance": "dark"],
      forName: UserDefaults.argumentDomain)
    SettingsPreferences.prepare(defaults: defaults, domainName: domain)
    for key in ["appLock", "premium", "themeID", "appearance"] {
      XCTAssertNil(defaults.object(forKey: "settings." + key))
    }
  }
}
#endif
