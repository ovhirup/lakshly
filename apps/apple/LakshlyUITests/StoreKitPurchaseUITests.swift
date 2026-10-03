import StoreKitTest
import XCTest

/// SKTestSession cannot save its configuration on iOS 26.3+ simulators
/// (SKInternalErrorDomain 3 / notEntitled, Apple FB22237318). Tests that need a
/// live session skip there with this reason; run them on an iOS 26.2 simulator.
enum StoreKitTestRuntime {
  static let brokenReason =
    "SKTestSession is broken on iOS 26.3+ simulators (FB22237318). Run StoreKit tests on an iOS 26.2 simulator."
  static var isKnownBroken: Bool {
    let v = ProcessInfo.processInfo.operatingSystemVersion
    return v.majorVersion > 26 || (v.majorVersion == 26 && v.minorVersion >= 3)
  }
}

@MainActor
final class StoreKitPurchaseUITests: XCTestCase {
  private var session: SKTestSession!

  override func setUpWithError() throws {
    continueAfterFailure = false
    session = try SKTestSession(configurationFileNamed: "Lakshly")
    // resetToDefaultState() restores disableDialogs = false, so reset first.
    session.resetToDefaultState()
    session.clearTransactions()
    session.disableDialogs = true
    session.storefront = "IND"
    session.locale = Locale(identifier: "en_IN")
  }

  override func tearDownWithError() throws {
    session?.clearTransactions()
    session = nil
  }

  func testPaywallLakshmiDark() {
    let app = launch(["-showPaywall", "YES", "-theme", "lakshmi", "-appearance", "dark"])
    XCTAssertTrue(app.staticTexts["Lakshly Premium"].waitForExistence(timeout: 12))
    XCTAssertTrue(app.staticTexts["Every rupee on target, in more depth."].exists)
    shot(app, "paywall-lakshmi-dark")
  }

  func testPaywallMonochromeGoldLight() {
    let app = launch(["-showPaywall", "YES", "-theme", "monochromeGold", "-appearance", "light"])
    XCTAssertTrue(app.staticTexts["Lakshly Premium"].waitForExistence(timeout: 12))
    shot(app, "paywall-monochromegold-light")
  }

  func testFreeOceanTapOpensThemedPaywall() {
    let app = launch(["-openSettings", "YES", "-theme", "lakshmi", "-appearance", "light"])
    let ocean = app.buttons["theme.ocean"]
    XCTAssertTrue(ocean.waitForExistence(timeout: 12))
    ocean.tap()
    XCTAssertTrue(app.staticTexts["Keep Ocean with Premium"].waitForExistence(timeout: 8))
    shot(app, "locked-ocean-tap-free")
  }

  func testPurchaseYearlyUnlocksSettingsThemeAndDebt() throws {
    let app = launch(["-showPaywall", "YES", "-theme", "lakshmi", "-appearance", "dark"])
    let purchase = app.buttons["paywall.continue"]
    let appeared = purchase.waitForExistence(timeout: 15)
    if !appeared && StoreKitTestRuntime.isKnownBroken { throw XCTSkip(StoreKitTestRuntime.brokenReason) }
    XCTAssertTrue(appeared, "Yearly plan did not appear")
    XCTAssertEqual(purchase.label, "Continue with Yearly")
    purchase.tap()
    let thanks = app.staticTexts["paywall.thanks"]
    XCTAssertTrue(thanks.waitForExistence(timeout: 20))
    shot(app, "purchase-complete")
    app.buttons["paywall.done"].tap()

    app.buttons["Settings"].tap()
    // The App icon section sits between Theme and Premium; Form rows load lazily, so scroll to Premium.
    let thankYou = app.staticTexts["Thank you for supporting Lakshly"]
    XCTAssertTrue(app.buttons["theme.ocean"].waitForExistence(timeout: 8))
    for _ in 0..<4 where !thankYou.exists { app.swipeUp() }
    XCTAssertTrue(thankYou.waitForExistence(timeout: 8))
    XCTAssertTrue(app.staticTexts["settings.premiumStatus"].waitForExistence(timeout: 4)
      || app.staticTexts["Premium ✦"].waitForExistence(timeout: 4))
    shot(app, "settings-premium-unlocked")

    let ocean = app.buttons["theme.ocean"]
    for _ in 0..<4 where !(ocean.exists && ocean.isHittable) { app.swipeDown() }
    XCTAssertTrue(ocean.waitForExistence(timeout: 6))
    ocean.tap()
    // Changing the theme offers the matching app icon; keep the current one so no system alert appears.
    let keepIcon = app.buttons["appIcon.offer.keep"].firstMatch
    XCTAssertTrue(keepIcon.waitForExistence(timeout: 6) || app.buttons["Keep current icon"].waitForExistence(timeout: 2))
    shot(app, "ocean-icon-offer")
    (keepIcon.exists ? keepIcon : app.buttons["Keep current icon"].firstMatch).tap()
    shot(app, "ocean-applied-premium")
    app.buttons["Done"].tap()

    openDebt(app)
    let plannerCopy = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Avalanche puts extra money")).firstMatch
    XCTAssertTrue(plannerCopy.waitForExistence(timeout: 8))
    XCTAssertFalse(app.buttons["debt.seePremium"].exists)
    // isHittable is true off-screen inside a ScrollView, so scroll to the planner card explicitly.
    let planner = app.otherElements["debt.planner"].exists ? app.otherElements["debt.planner"] : plannerCopy
    for _ in 0..<4 where planner.frame.maxY > app.windows.firstMatch.frame.maxY - 120 { app.swipeUp() }
    shot(app, "debt-planner-unlocked")
  }

  private func launch(_ arguments: [String]) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments = ["-demoUnlocked", "YES"] + arguments
    app.launch()
    return app
  }

  private func openDebt(_ app: XCUIApplication) {
    let tab = app.tabBars.buttons["Debt"]
    if tab.waitForExistence(timeout: 2) {
      tab.tap()
      return
    }
    let more = app.tabBars.buttons["More"]
    if more.exists { more.tap() }
    let debt = app.buttons["Debt"]
    if debt.waitForExistence(timeout: 4) {
      debt.tap()
      return
    }
    let row = app.staticTexts["Debt"]
    XCTAssertTrue(row.waitForExistence(timeout: 4))
    row.tap()
  }

  /// Writes `<dir>/<name>.ready` when LAKSHLY_SHOT_DIR is set (via TEST_RUNNER_LAKSHLY_SHOT_DIR)
  /// and waits up to 20 seconds for the operator's `<dir>/<name>.done`.
  private func shot(_ app: XCUIApplication, _ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    guard let directory = ProcessInfo.processInfo.environment["LAKSHLY_SHOT_DIR"], !directory.isEmpty else { return }
    let folder = URL(fileURLWithPath: directory, isDirectory: true)
    let ready = folder.appendingPathComponent("\(name).ready")
    let done = folder.appendingPathComponent("\(name).done")
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    FileManager.default.createFile(atPath: ready.path, contents: Data("\(name)\n".utf8))
    let deadline = Date().addingTimeInterval(20)
    while Date() < deadline {
      if FileManager.default.fileExists(atPath: done.path) { return }
      Thread.sleep(forTimeInterval: 0.2)
    }
    XCTFail("Timed out waiting for \(done.path)")
  }
}
