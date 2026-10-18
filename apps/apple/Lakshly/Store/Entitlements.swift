import Foundation

/// Ordered access level. Public resolution grants only verified Premium or Free.
enum Tier: Int, Comparable, Sendable {
  case free, premium, superUser
  static func < (lhs: Tier, rhs: Tier) -> Bool { lhs.rawValue < rhs.rawValue }
  var pillText: String {
    switch self {
    case .free: "Free Version"
    case .premium: "✦ Premium"
    case .superUser: "∞ SUPERUSER · Private build"
    }
  }
  var accessibilityName: String { self == .premium ? "Premium" : pillText }
}

enum TierEdition {
  static func resolve(verifiedTier: Tier) -> Tier {
    #if LAKSHLY_PRIVATE
    return .superUser
    #else
    return verifiedTier >= .premium ? .premium : .free
    #endif
  }
}

enum Feature: String, CaseIterable, Sendable {
  case premiumThemes = "themes.premium"
  case debtPlanner = "debt.planner"
  case creditInsights = "credit.insights"
  case investmentInsights = "investments.insights"
  case rewardsInsights = "rewards.tracking"
  case unlimitedBudgets = "budgets.unlimited"
  case budgetLines = "budgets.lines"
  case fullHistory = "history.full"
  case priorityFeedback
  /// Home Screen, desktop and Lock Screen widgets that ship with Lakshly Free.
  case basicWidgets = "review.widget"
  /// Net worth and debt widgets.
  static var extraWidgets: Feature { .debtPlanner }
  /// Mac notch glance. The menu-bar extra stays available without this.
  case notchPanel = "glance.notchPanel"
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
  /// Freedom date countdown.
  case freedomDate = "wow.freedomDate"
  /// Extra-payment what-if for the freedom date.
  case freedomWhatIf = "wow.freedomWhatIf"
  /// Monthly story for the latest month.
  case story = "wow.story"
  /// Shareable story image and past months.
  case storyShare = "wow.storyShare"
  /// Subscription audit.
  case subscriptionAudit = "wow.subscriptionAudit"
  /// Fee runway for yearly fees.
  case feeRunway = "wow.feeRunway"
  /// Bill & renewal radar.
  case billRadar = "bills.radar"
  /// Bill alerts (local notifications). Free: the next 3.
  case billAlerts = "bills.alerts"
  /// Live Activity on the due day for renewals and fees.
  case billLiveActivity = "bills.liveActivity"
  /// Bill radar widget.
  case billWidget = "bills.widget"
}

enum PremiumProduct {
  static let monthlyID = "app.lakshly.premium.monthly"
  static let yearlyID = "app.lakshly.premium.yearly"
  static let ids = [monthlyID, yearlyID]
}

enum FeatureLimit: Equatable, Sendable { case count(Int), unlimited }
struct FeatureSpec: Equatable, Sendable {
  let minTier: Tier
  let limits: [Tier: FeatureLimit]
}
struct EntitlementsMap {
  static let standard: [Feature: Tier] = Dictionary(uniqueKeysWithValues: Feature.allCases.compactMap {
    guard let spec = GeneratedEntitlements.features[$0.rawValue] else { return nil }
    return ($0, spec.minTier)
  })
}

/// Int.max denotes unlimited. Explicit limits apply even when full access is gated.
func limit(_ feature: Feature, tier: Tier) -> Int { limit(feature.rawValue, tier: tier) }
func limit(_ feature: String, tier: Tier) -> Int {
  if tier == .superUser { return .max }
  let spec = GeneratedEntitlements.features[feature]
  if let value = spec?.limits[tier] {
    switch value { case .count(let count): return count; case .unlimited: return .max }
  }
  return tier >= (spec?.minTier ?? .premium) ? .max : 0
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
  var purchaseDate: Date? = nil
}

struct ResolvedEntitlement: Equatable, Sendable {
  var tier: Tier
  var activeProductID: String?
  var expirationDate: Date?
  /// True when the winning snapshot has not expired. RenewalInfo may override this.
  var willRenew: Bool?
  var purchaseDate: Date? = nil
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
      tier: .premium, activeProductID: best.productID, expirationDate: best.expirationDate, willRenew: willRenew, purchaseDate: best.purchaseDate)
  }

  private static func rank(_ productID: String) -> Int {
    if productID == PremiumProduct.yearlyID { return 2 }
    if productID == PremiumProduct.monthlyID { return 1 }
    return 0
  }
}

enum LakshlyLimit { static func value(_ feature: Feature, tier: Tier) -> Int { limit(feature, tier: tier) } }
