import XCTest
@testable import Lakshly

@MainActor final class PrivacyTests: XCTestCase {
  private func suite() throws -> (UserDefaults, String) {
    let name = "app.lakshly.privacy-test.\(UUID().uuidString)"
    return (try XCTUnwrap(UserDefaults(suiteName: name)), name)
  }

  func testMaskHasNoDigitsAndFixedWidth() {
    XCTAssertEqual(Money.mask, "₹ •••••")
    XCTAssertNil(Money.mask.rangeOfCharacter(from: .decimalDigits))
    let short = Money.redact(Money.format(500), masked: true)
    let long = Money.redact(Money.format(123_456_789_00), masked: true)
    XCTAssertEqual(short, Money.mask)
    XCTAssertEqual(short.count, long.count)
  }

  func testRedactMasksEveryRupeeAmountAndKeepsWords() {
    let text = "Repaid \(Money.format(1_234_500)) of \(Money.format(-98_765_400)) · 42% used"
    let masked = Money.redact(text, masked: true)
    XCTAssertNil(masked.range(of: "₹\\s?[0-9]", options: .regularExpression))
    XCTAssertTrue(masked.hasPrefix("Repaid ₹ •••••"))
    XCTAssertTrue(masked.contains("42% used"), "Percentages stay unless hidePercent")
    XCTAssertTrue(Money.redact(text, masked: true, hidePercent: true).contains("••% used"))
    XCTAssertEqual(Money.redact(text, masked: false), text, "Unmasked text is unchanged")
    XCTAssertEqual(Money.redact(Money.compact(25_000_000), masked: true), Money.mask)
  }

  func testEffectiveMaskLogic() {
    XCTAssertFalse(PrivacyStore.effectiveMask(on: false, transient: false, startHidden: false, revealed: false))
    XCTAssertTrue(PrivacyStore.effectiveMask(on: true, transient: false, startHidden: false, revealed: true))
    XCTAssertTrue(PrivacyStore.effectiveMask(on: false, transient: true, startHidden: false, revealed: true))
    XCTAssertTrue(PrivacyStore.effectiveMask(on: false, transient: false, startHidden: true, revealed: false))
    XCTAssertFalse(PrivacyStore.effectiveMask(on: false, transient: false, startHidden: true, revealed: true))
  }

  func testSetPrivacyPersistsMirrorsAndReloads() throws {
    let (defaults, name) = try suite()
    let (group, groupName) = try suite()
    defer { defaults.removePersistentDomain(forName: name); group.removePersistentDomain(forName: groupName) }
    var reloads = 0
    let store = PrivacyStore(defaults: defaults, group: group) { reloads += 1 }
    XCTAssertFalse(store.masked)
    XCTAssertTrue(store.shakeToHide)
    XCTAssertTrue(store.hideWhenCaptured)
    XCTAssertFalse(store.hideOnBlur)
    store.setPrivacy(true, source: "test")
    XCTAssertTrue(defaults.bool(forKey: "privacy.on"))
    XCTAssertTrue(group.bool(forKey: "privacy.on"))
    XCTAssertGreaterThan(reloads, 0)
    XCTAssertFalse(GlancePreferences.showAmounts(in: group), "Widgets are masked while privacy is on")
    store.setPrivacy(false, source: "test")
    XCTAssertFalse(store.masked)
    XCTAssertFalse(group.bool(forKey: "privacy.on"))
  }

  func testCaptureIsTransientAndNeverChangesSavedToggle() throws {
    let (defaults, name) = try suite()
    let (group, groupName) = try suite()
    defer { defaults.removePersistentDomain(forName: name); group.removePersistentDomain(forName: groupName) }
    let store = PrivacyStore(defaults: defaults, group: group) {}
    store.noteCapture(true)
    XCTAssertTrue(store.masked)
    XCTAssertFalse(store.on)
    store.noteCapture(false)
    XCTAssertFalse(store.masked)
    store.hideWhenCaptured = false
    store.noteCapture(true)
    XCTAssertFalse(store.masked)
  }

  func testWidgetAmountMigration() throws {
    let (unset, a) = try suite()
    let (explicitOn, b) = try suite()
    let (explicitOff, c) = try suite()
    defer { [a, b, c].forEach { UserDefaults.standard.removePersistentDomain(forName: $0) } }
    explicitOn.set(true, forKey: GlancePreferences.showAmountsKey)
    explicitOff.set(false, forKey: GlancePreferences.showAmountsKey)
    XCTAssertFalse(GlancePreferences.showAmounts(in: unset))
    XCTAssertEqual(unset.string(forKey: "privacy.widgetAmounts"), "hidden")
    XCTAssertTrue(GlancePreferences.showAmounts(in: explicitOn))
    XCTAssertEqual(explicitOn.string(forKey: "privacy.widgetAmounts"), "shown")
    XCTAssertFalse(GlancePreferences.showAmounts(in: explicitOff))
  }
}
