import XCTest
@testable import Lakshly

final class SetupEntitlementsTests: XCTestCase {
  func testSetupFeaturesAreFree() {
    let free: [Feature] = [
      .importStatements, .setupWizard, .setupEmailGuide, .setupExtraEmails, .setupSuggestions, .setupHealth,
      .mailSyncConnect, .mailSyncIMAP, .mailSyncStatementPasswordKeychain,
    ]
    for feature in free { XCTAssertTrue(can(feature, tier: .free), feature.rawValue) }
  }

  func testBackgroundSyncAndRemindersArePremium() {
    XCTAssertFalse(can(.mailSyncBackground, tier: .free))
    XCTAssertFalse(can(.setupFreshnessReminders, tier: .free))
    XCTAssertTrue(can(.mailSyncBackground, tier: .premium))
  }

  func testRawValuesMatchSharedKeys() {
    XCTAssertEqual(Feature.setupWizard.rawValue, "setup.wizard")
    XCTAssertEqual(Feature.mailSyncConnect.rawValue, "mailSync.connect")
  }

  func testLimits() {
    XCTAssertEqual(limit(.mailSyncConnect, tier: .free), 1)
    XCTAssertEqual(limit(.mailSyncConnect, tier: .premium), 5)
    XCTAssertEqual(limit(.setupExtraEmails, tier: .free), 3)
    XCTAssertEqual(limit(.setupExtraEmails, tier: .premium), 10)
    XCTAssertEqual(limit(.setupWizard, tier: .free), .max)
    XCTAssertEqual(limit(.mailSyncBackground, tier: .free), 0)
  }
}
