import XCTest

/// Smoke for the public iPhone and Mac apps. Debug launch arguments load the
/// bundled synthetic demo and skip the lock and the setup sheet. Release builds
/// ignore those arguments. This does not purchase anything.
final class SyntheticSmokeUITests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  func testSyntheticOverviewAndFreeTheme() {
    let app = XCUIApplication()
    app.launchArguments = ["-demoUnlocked", "YES", "-uiTestingSyntheticData", "YES"]
    app.launch()

    let overview = app.descendants(matching: .any)["screen.overview"]
    XCTAssertTrue(overview.waitForExistence(timeout: 20), "Overview did not appear. Lock or setup may still be up.")
    XCTAssertTrue(app.descendants(matching: .any)["data.demo"].waitForExistence(timeout: 8))
    XCTAssertTrue(app.descendants(matching: .any)["overview.netWorth"].waitForExistence(timeout: 8))
    XCTAssertTrue(
      app.staticTexts["Every rupee on target."].waitForExistence(timeout: 8)
        || app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Every rupee on target")).firstMatch.exists)
    assertNoBrokenOrPrivateText(app)

    let settings = app.buttons["nav.settings"]
    XCTAssertTrue(settings.waitForExistence(timeout: 8))
    settings.tap()
    XCTAssertTrue(app.descendants(matching: .any)["screen.settings"].waitForExistence(timeout: 8))

    #if os(iOS)
    // The Mac theme grid is not exposed to XCTest yet. iPhone already reaches it.
    let graphite = themeControl(app, identifier: "theme.graphite", name: "Graphite")
    XCTAssertTrue(graphite.waitForExistence(timeout: 4), "Graphite theme control was not in Settings")
    graphite.tap()
    let keepIcon = app.buttons["appIcon.offer.keep"].firstMatch
    if keepIcon.waitForExistence(timeout: 4) { keepIcon.tap() }
    let selected = themeControl(app, identifier: "theme.graphite", name: "Graphite")
    XCTAssertTrue(selected.waitForExistence(timeout: 6))
    if let value = selected.value as? String, !value.isEmpty {
      XCTAssertEqual(value, "Selected")
    }
    #endif

    let done = app.buttons["settings.done"]
    XCTAssertTrue(done.waitForExistence(timeout: 6))
    done.tap()
    XCTAssertTrue(overview.waitForExistence(timeout: 8))
  }

  #if os(iOS)
  /// The theme grid is laid out lazily, so the control may be an identifier,
  /// a button titled Graphite, or just below the fold.
  private func themeControl(_ app: XCUIApplication, identifier: String, name: String) -> XCUIElement {
    let byID = app.descendants(matching: .any)[identifier]
    if byID.waitForExistence(timeout: 2) { return byID }
    let byName = app.buttons[name].firstMatch
    if byName.waitForExistence(timeout: 2) { return byName }
    if app.scrollViews.firstMatch.exists { app.scrollViews.firstMatch.swipeUp() }
    if byID.waitForExistence(timeout: 3) { return byID }
    return byName
  }
  #endif

  private func assertNoBrokenOrPrivateText(_ app: XCUIApplication) {
    let labels = app.staticTexts.allElementsBoundByIndex.map(\.label)
    XCTAssertFalse(labels.contains { $0.contains("NaN") || $0.contains("undefined") || $0.contains("∞") })
    let pan = try? NSRegularExpression(pattern: "[A-Z]{5}[0-9]{4}[A-Z]")
    for label in labels {
      let range = NSRange(label.startIndex..<label.endIndex, in: label)
      XCTAssertNil(pan?.firstMatch(in: label, range: range), "A PAN-like string is on screen")
    }
  }
}
