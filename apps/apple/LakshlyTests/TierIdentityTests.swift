import CryptoKit
import XCTest
@testable import Lakshly

final class TierIdentityTests: XCTestCase {
  func testOrderingAndPublicResolution() {
    XCTAssertLessThan(Tier.free, .premium)
    XCTAssertLessThan(Tier.premium, .superUser)
    #if !LAKSHLY_PRIVATE
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    let free = EntitlementResolver.resolve([], now: now)
    XCTAssertEqual(TierEdition.resolve(verifiedTier: free.tier), .free)
    let purchase = now.addingTimeInterval(-30 * 86_400)
    let snapshot = EntitlementSnapshot(productID: PremiumProduct.monthlyID,
      expirationDate: now.addingTimeInterval(86_400), revocationDate: nil, isUpgraded: false,
      verified: true, purchaseDate: purchase)
    let premium = EntitlementResolver.resolve([snapshot], now: now)
    XCTAssertEqual(TierEdition.resolve(verifiedTier: premium.tier), .premium)
    XCTAssertEqual(premium.purchaseDate, purchase)
    var unverified = snapshot
    unverified.verified = false
    XCTAssertEqual(EntitlementResolver.resolve([unverified], now: now).tier, .free)
    XCTAssertEqual(TierEdition.resolve(verifiedTier: .superUser), .premium)
    #endif
  }

  func testGeneratedManifestCannotDrift() throws {
    let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "entitlements", withExtension: "json"))
    let raw = try Data(contentsOf: url)
    let checksum = SHA256.hash(data: raw).map { String(format: "%02x", $0) }.joined()
    XCTAssertEqual(checksum, GeneratedEntitlements.sourceSHA256, "Run scripts/generate_entitlements.py")
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: raw) as? [String: Any])
    let features = try XCTUnwrap(json["features"] as? [String: [String: Any]])
    XCTAssertEqual(Set(features.keys), Set(GeneratedEntitlements.features.keys))
    let tiers: [String: Tier] = ["free": .free, "premium": .premium, "superUser": .superUser]
    for (id, source) in features {
      let generated = try XCTUnwrap(GeneratedEntitlements.features[id])
      XCTAssertEqual(generated.minTier, tiers[try XCTUnwrap(source["minTier"] as? String)], id)
      let limits = source["limits"] as? [String: Any] ?? [:]
      XCTAssertEqual(generated.limits.count, limits.count, id)
      for (name, value) in limits {
        let tier = try XCTUnwrap(tiers[name])
        let expected: FeatureLimit = value is NSNull ? .unlimited : .count(try XCTUnwrap(value as? Int))
        XCTAssertEqual(generated.limits[tier], expected, id)
      }
    }
    for feature in Feature.allCases { XCTAssertNotNil(features[feature.rawValue], feature.rawValue) }
  }

  func testGeneratedAccessAndLimits() {
    for tier in [Tier.free, .premium, .superUser] {
      XCTAssertTrue(can(.importStatements, tier: tier))
      XCTAssertEqual(limit(.importStatements, tier: tier), .max)
    }
    XCTAssertFalse(can(.premiumThemes, tier: .free))
    XCTAssertTrue(can(.premiumThemes, tier: .premium))
    XCTAssertEqual(limit(.premiumThemes, tier: .free), 0)
    XCTAssertEqual(limit(.unlimitedBudgets, tier: .free), 1)
    XCTAssertEqual(limit(.budgetLines, tier: .free), 6)
    XCTAssertEqual(limit(.fullHistory, tier: .free), 12)
    XCTAssertEqual(limit(.setupExtraEmails, tier: .premium), 10)
    XCTAssertEqual(limit(.setupExtraEmails, tier: .superUser), .max)
    XCTAssertEqual(limit("unknown", tier: .free), 0)
    XCTAssertEqual(limit("unknown", tier: .premium), .max)
  }

  func testNotNowAndSevenDayCap() {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    let suite = "tier-tests-\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    let history = TierNudgeHistory(defaults: defaults)
    XCTAssertTrue(history.eligible(now: now, intentional: true))
    XCTAssertFalse(history.eligible(now: now, intentional: false))
    history.recordShown(now: now)
    XCTAssertFalse(history.eligible(now: now.addingTimeInterval(7 * 86_400 - 1), intentional: true))
    XCTAssertTrue(history.eligible(now: now.addingTimeInterval(7 * 86_400), intentional: true))
    history.snooze(now: now)
    XCTAssertFalse(history.eligible(now: now.addingTimeInterval(30 * 86_400 - 1), intentional: true))
    XCTAssertTrue(history.eligible(now: now.addingTimeInterval(30 * 86_400), intentional: true))
    XCTAssertEqual(TierNudgePolicy.snoozeUntil(now: now).timeIntervalSince(now), 30 * 86_400)
    XCTAssertFalse(TierNudgePolicy.eligible(now: now, lastShown: nil, snoozedUntil: nil, intentional: true, midTask: true))
    XCTAssertFalse(TierNudgePolicy.eligible(now: now, lastShown: nil, snoozedUntil: nil, intentional: true, shownOnScreen: true))
  }

  func testPillCopyAndUnknownMembershipDates() {
    XCTAssertEqual(Tier.free.pillText, "Free Version")
    XCTAssertEqual(Tier.premium.pillText, "✦ Premium")
    XCTAssertEqual(Tier.superUser.pillText, "∞ SUPERUSER · Private build")
    XCTAssertEqual(Tier.premium.accessibilityName, "Premium")
    XCTAssertEqual(TierMembership.line(purchaseDate: nil, expirationDate: nil, willRenew: nil), "")
    let purchase = Date(timeIntervalSince1970: 1_759_449_600) // 3 Oct 2025, UTC
    let renewal = purchase.addingTimeInterval(31 * 86_400)
    XCTAssertEqual(TierMembership.line(purchaseDate: purchase, expirationDate: renewal, willRenew: true), "Member since Oct 2025 · renews 3 Nov 2025")
    XCTAssertEqual(TierMembership.line(purchaseDate: purchase, expirationDate: renewal, willRenew: false), "Member since Oct 2025")
  }
}
