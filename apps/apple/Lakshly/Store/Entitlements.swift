import Foundation

/// Ordered access level.
///
/// Board item 8 will add `superUser` above `premium`, plus an edition flag, and
/// will generate `EntitlementsMap` from `packages/shared/entitlements.json`.
/// Those are intentionally not built here. Keep this a plain dictionary literal.
enum Tier: Int, Comparable, Sendable {
  case free
  case premium

  static func < (lhs: Tier, rhs: Tier) -> Bool {
    lhs.rawValue < rhs.rawValue
  }
}

enum Feature: String, CaseIterable, Sendable {
  case premiumThemes
  case debtPlanner
  case creditInsights
  case investmentInsights
  case rewardsInsights
  case priorityFeedback
  /// Home Screen, desktop and Lock Screen widgets that ship with Lakshly Free.
  case basicWidgets
  /// Net worth and debt widgets.
  case extraWidgets
  // Import and first-run setup are always free (setup-wizard spec §10).
  case importStatements = "import.statements"
  case setupWizard = "setup.wizard"
  case setupEmailGuide = "setup.emailGuide"
  case setupExtraEmails = "setup.extraEmails"
  case setupSuggestions = "setup.suggestions"
  case setupHealth = "setup.health"
  case mailSyncConnect = "mailSync.connect"
  case mailSyncIMAP = "mailSync.imap"
  case mailSyncStatementPasswordKeychain = "mailSync.statementPasswordKeychain"
  /// Scheduled background mail sync.
  case mailSyncBackground = "mailSync.background"
  /// Local notifications when a data source goes stale.
  case setupFreshnessReminders = "setup.freshnessReminders"
}

enum PremiumProduct {
  static let monthlyID = "app.lakshly.premium.monthly"
  static let yearlyID = "app.lakshly.premium.yearly"
  static let ids = [monthlyID, yearlyID]
}

struct EntitlementsMap {
  static let standard: [Feature: Tier] = [
    .premiumThemes: .premium,
    .debtPlanner: .premium,
    .creditInsights: .premium,
    .investmentInsights: .premium,
    .rewardsInsights: .premium,
    .priorityFeedback: .premium,
    .basicWidgets: .free,
    .extraWidgets: .premium,
    .importStatements: .free,
    .setupWizard: .free,
    .setupEmailGuide: .free,
    .setupExtraEmails: .free,
    .setupSuggestions: .free,
    .setupHealth: .free,
    .mailSyncConnect: .free,
    .mailSyncIMAP: .free,
    .mailSyncStatementPasswordKeychain: .free,
    .mailSyncBackground: .premium,
    .setupFreshnessReminders: .premium,
  ]

  /// Per-tier quantity limits (mirrors web ENTITLEMENT_LIMITS). Features without an entry are unlimited.
  static let limits: [Feature: [Tier: Int]] = [
    .setupExtraEmails: [.free: 3, .premium: 10],
    .mailSyncConnect: [.free: 1, .premium: 5],
  ]
}

/// Quantity allowed for a feature: 0 when the tier can't use it, `Int.max` when unlimited.
func limit(_ feature: Feature, tier: Tier) -> Int {
  guard can(feature, tier: tier) else { return 0 }
  guard let byTier = EntitlementsMap.limits[feature] else { return .max }
  return byTier[tier] ?? byTier[.premium] ?? .max
}

enum EntitlementRule {
  /// Unknown features fail closed at Premium.
  static func allows(_ feature: Feature, tier: Tier, map: [Feature: Tier] = EntitlementsMap.standard) -> Bool {
    tier >= (map[feature] ?? .premium)
  }
}

/// Unknown features fail closed at Premium.
func can(_ feature: Feature, tier: Tier, map: [Feature: Tier] = EntitlementsMap.standard) -> Bool {
  EntitlementRule.allows(feature, tier: tier, map: map)
}

/// One verified StoreKit entitlement, reduced to values the tier rule can see.
struct EntitlementSnapshot: Equatable, Sendable {
  var productID: String
  var expirationDate: Date?
  var revocationDate: Date?
  var isUpgraded: Bool
  var verified: Bool
}

struct ResolvedEntitlement: Equatable, Sendable {
  var tier: Tier
  var activeProductID: String?
  var expirationDate: Date?
  /// True when the winning snapshot has not expired. RenewalInfo may override this.
  var willRenew: Bool?
}

enum EntitlementResolver {
  /// Active means verified, one of our products, not revoked, not upgraded, and not expired.
  /// When monthly and yearly are both active, yearly wins.
  static func resolve(
    _ snapshots: [EntitlementSnapshot],
    now: Date,
    productIDs: Set<String> = Set(PremiumProduct.ids)
  ) -> ResolvedEntitlement {
    let active = snapshots.filter { snapshot in
      guard snapshot.verified, productIDs.contains(snapshot.productID) else { return false }
      if snapshot.revocationDate != nil || snapshot.isUpgraded { return false }
      if let expiration = snapshot.expirationDate, expiration < now { return false }
      return true
    }
    guard let best = active.max(by: { lhs, rhs in
      let left = rank(lhs.productID)
      let right = rank(rhs.productID)
      if left != right { return left < right }
      return (lhs.expirationDate ?? .distantFuture) < (rhs.expirationDate ?? .distantFuture)
    }) else {
      return ResolvedEntitlement(tier: .free, activeProductID: nil, expirationDate: nil, willRenew: nil)
    }
    let willRenew = best.expirationDate.map { $0 >= now } ?? true
    return ResolvedEntitlement(
      tier: .premium, activeProductID: best.productID, expirationDate: best.expirationDate, willRenew: willRenew)
  }

  private static func rank(_ productID: String) -> Int {
    if productID == PremiumProduct.yearlyID { return 2 }
    if productID == PremiumProduct.monthlyID { return 1 }
    return 0
  }
}
