import StoreKit
import StoreKitTest
import XCTest

@testable import Lakshly

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
final class StoreKitTests: XCTestCase {
  /// Features Lakshly Free always includes: basic widgets, import and first-run setup (setup-wizard spec §10).
  static let freeFeatures: Set<Feature> = [
    .basicWidgets, .importStatements, .setupWizard, .setupEmailGuide, .setupExtraEmails, .setupSuggestions,
    .setupHealth, .mailSyncConnect, .mailSyncIMAP, .mailSyncStatementPasswordKeychain,
  ]

  private var session: SKTestSession!

  override func setUpWithError() throws {
    session = try SKTestSession(configurationFileNamed: "Lakshly")
    try configure(session, storefront: "IND", locale: "en_IN")
  }

  /// Skips only when the runtime is known broken AND the session really cannot serve products.
  private func requireWorkingSession() async throws {
    guard StoreKitTestRuntime.isKnownBroken else { return }
    let products = (try? await Product.products(for: EntitlementStore.productIDs)) ?? []
    if products.isEmpty { throw XCTSkip(StoreKitTestRuntime.brokenReason) }
  }

  override func tearDownWithError() throws {
    session?.clearTransactions()
    session = nil
  }

  func testProductsLoadInIndiaAndTheUnitedStates() async throws {
    try await requireWorkingSession()
    let store = EntitlementStore(syncPurchases: {})
    await store.loadProducts()
    XCTAssertFalse(store.productsUnavailable)
    XCTAssertEqual(store.products.map(\.id), [EntitlementStore.monthlyProductID, EntitlementStore.yearlyProductID])
    let monthly = try XCTUnwrap(store.products.first { $0.id == EntitlementStore.monthlyProductID })
    let yearly = try XCTUnwrap(store.products.first { $0.id == EntitlementStore.yearlyProductID })
    assertPrice(monthly, symbol: "₹", amount: "119", currency: "INR")
    assertPrice(yearly, symbol: "₹", amount: "999", currency: "INR")
    XCTAssertEqual(monthly.subscription?.subscriptionPeriod.unit, .month)
    XCTAssertEqual(monthly.subscription?.subscriptionPeriod.value, 1)
    XCTAssertEqual(yearly.subscription?.subscriptionPeriod.unit, .year)
    XCTAssertEqual(yearly.subscription?.subscriptionPeriod.value, 1)
    XCTAssertTrue(monthly.isFamilyShareable)
    XCTAssertTrue(yearly.isFamilyShareable)
    XCTAssertEqual(monthly.subscription?.subscriptionGroupID, yearly.subscription?.subscriptionGroupID)
    XCTAssertEqual(monthly.subscription?.groupLevel, yearly.subscription?.groupLevel)

    session.clearTransactions()
    session = nil
    session = try SKTestSession(configurationFileNamed: "Lakshly-US")
    try configure(session, storefront: "USA", locale: "en_US")
    let unitedStates = EntitlementStore(syncPurchases: {})
    await unitedStates.loadProducts()
    let usMonthly = try XCTUnwrap(unitedStates.products.first { $0.id == EntitlementStore.monthlyProductID })
    let usYearly = try XCTUnwrap(unitedStates.products.first { $0.id == EntitlementStore.yearlyProductID })
    assertPrice(usMonthly, symbol: "$", amount: "4.99", currency: "USD")
    assertPrice(usYearly, symbol: "$", amount: "39.99", currency: "USD")
  }

  func testPurchaseMonthlyUnlocksEveryFeature() async throws {
    try await requireWorkingSession()
    let store = EntitlementStore(syncPurchases: {})
    await store.loadProducts()
    let monthly = try XCTUnwrap(store.products.first { $0.id == EntitlementStore.monthlyProductID })
    await store.purchase(monthly)
    await waitForPremium(store, expected: true)
    XCTAssertEqual(store.tier, .premium)
    XCTAssertEqual(store.activeProductID, EntitlementStore.monthlyProductID)
    XCTAssertTrue(store.can(.premiumThemes))
    for feature in Feature.allCases {
      XCTAssertTrue(store.can(feature), feature.rawValue)
    }
    XCTAssertNil(store.lastError)
  }

  func testNewStoreSeesPurchaseThroughRefreshAndRestore() async throws {
    try await requireWorkingSession()
    try await session.buyProduct(identifier: EntitlementStore.yearlyProductID)
    let relaunched = EntitlementStore(syncPurchases: {})
    // buyProduct can return before currentEntitlements lists the purchase.
    await waitForPremium(relaunched, expected: true)
    XCTAssertTrue(relaunched.isPremium)
    XCTAssertEqual(relaunched.activeProductID, EntitlementStore.yearlyProductID)

    let restoring = EntitlementStore(syncPurchases: {})
    await waitForRestore(restoring, premium: true)
    XCTAssertEqual(restoring.purchaseState, "Premium restored")
    XCTAssertTrue(restoring.can(.debtPlanner))

    session.clearTransactions()
    let empty = EntitlementStore(syncPurchases: {})
    await waitForPremium(empty, expected: false)
    await waitForRestore(empty, premium: false)
    XCTAssertEqual(empty.purchaseState, "Nothing to restore")
    XCTAssertFalse(empty.isPremium)
    XCTAssertEqual(empty.tier, .free)
  }

  func testExpiryRemovesAccess() async throws {
    try await requireWorkingSession()
    try await session.buyProduct(identifier: EntitlementStore.monthlyProductID)
    let store = EntitlementStore(syncPurchases: {})
    await waitForPremium(store, expected: true)
    try session.expireSubscription(productIdentifier: EntitlementStore.monthlyProductID)
    await waitForPremium(store, expected: false)
    XCTAssertEqual(store.tier, .free)
    XCTAssertNil(store.activeProductID)
    assertFreeKeepsBasicWidgetsOnly(store)
  }

  func testRefundHonoursRevocation() async throws {
    try await requireWorkingSession()
    try await session.buyProduct(identifier: EntitlementStore.monthlyProductID)
    let store = EntitlementStore(syncPurchases: {})
    await waitForPremium(store, expected: true)
    let transaction = try XCTUnwrap(session.allTransactions().first {
      $0.productIdentifier == EntitlementStore.monthlyProductID
    })
    try session.refundTransaction(identifier: transaction.identifier)
    await waitForPremium(store, expected: false)
    XCTAssertFalse(store.can(.rewardsInsights))
  }

  /// Monthly and yearly share one group level, so moving to the longer yearly plan is a
  /// crossgrade that StoreKit defers to the next renewal. Premium must stay on throughout.
  func testCrossgradeToYearlyKeepsPremium() async throws {
    try await requireWorkingSession()
    try await session.buyProduct(identifier: EntitlementStore.monthlyProductID)
    try await session.buyProduct(identifier: EntitlementStore.yearlyProductID)
    let store = EntitlementStore(syncPurchases: {})
    await waitForPremium(store, expected: true)
    XCTAssertTrue(store.isPremium)
    XCTAssertEqual(store.activeProductID, EntitlementStore.monthlyProductID)
    for feature in Feature.allCases { XCTAssertTrue(store.can(feature), feature.rawValue) }
  }

  func testResolverIgnoresRevokedExpiredUnverifiedAndUpgradedSnapshots() {
    let now = Date(timeIntervalSince1970: 1_700_000_000)
    let future = now.addingTimeInterval(86_400)
    let past = now.addingTimeInterval(-60)
    let active = EntitlementSnapshot(
      productID: EntitlementStore.monthlyProductID, expirationDate: future,
      revocationDate: nil, isUpgraded: false, verified: true)
    XCTAssertEqual(EntitlementResolver.resolve([active], now: now).tier, .premium)
    XCTAssertEqual(EntitlementResolver.resolve([active], now: now).activeProductID, EntitlementStore.monthlyProductID)
    XCTAssertEqual(EntitlementResolver.resolve([active], now: now).willRenew, true)

    var revoked = active
    revoked.revocationDate = now
    XCTAssertEqual(EntitlementResolver.resolve([revoked], now: now).tier, .free)

    var expired = active
    expired.expirationDate = past
    XCTAssertEqual(EntitlementResolver.resolve([expired], now: now).tier, .free)

    var unverified = active
    unverified.verified = false
    XCTAssertEqual(EntitlementResolver.resolve([unverified], now: now).tier, .free)

    var upgraded = active
    upgraded.isUpgraded = true
    let yearly = EntitlementSnapshot(
      productID: EntitlementStore.yearlyProductID, expirationDate: future.addingTimeInterval(86_400),
      revocationDate: nil, isUpgraded: false, verified: true)
    let resolved = EntitlementResolver.resolve([upgraded, yearly], now: now)
    XCTAssertEqual(resolved.tier, .premium)
    XCTAssertEqual(resolved.activeProductID, EntitlementStore.yearlyProductID)

    var foreign = active
    foreign.productID = "app.lakshly.other"
    XCTAssertEqual(EntitlementResolver.resolve([foreign], now: now).tier, .free)

    let both = EntitlementResolver.resolve([active, yearly], now: now)
    XCTAssertEqual(both.activeProductID, EntitlementStore.yearlyProductID)
  }

  func testEntitlementsMapFailsClosed() {
    XCTAssertLessThan(Tier.free, Tier.premium)
    XCTAssertEqual(Set(EntitlementsMap.standard.keys), Set(Feature.allCases))
    XCTAssertEqual(EntitlementsMap.standard[.basicWidgets], .free)
    XCTAssertEqual(EntitlementsMap.standard[.extraWidgets], .premium)
    for feature in Feature.allCases {
      if Self.freeFeatures.contains(feature) {
        XCTAssertEqual(EntitlementsMap.standard[feature], .free)
        XCTAssertTrue(can(feature, tier: .free))
      } else {
        XCTAssertEqual(EntitlementsMap.standard[feature], .premium)
        XCTAssertFalse(can(feature, tier: .free))
      }
      XCTAssertTrue(can(feature, tier: .premium))
    }
    XCTAssertFalse(can(.debtPlanner, tier: .free, map: [:]))
    XCTAssertTrue(can(.premiumThemes, tier: .premium, map: [:]))
    XCTAssertFalse(can(.creditInsights, tier: .free, map: [.creditInsights: .premium]))
  }

  func testDefaultsAndLaunchArgumentsCannotGrantPremium() async throws {
    session.clearTransactions()
    let baseline = EntitlementStore(syncPurchases: {})
    await waitForPremium(baseline, expected: false)
    XCTAssertFalse(baseline.isPremium, "StoreKit fixture did not settle to Free after clearing transactions.")
    XCTAssertEqual(baseline.tier, .free)
    guard !baseline.isPremium else { return }
    let domain = "app.lakshly.entitlement-test.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: domain))
    defer { defaults.removePersistentDomain(forName: domain) }
    defaults.setPersistentDomain(["settings.premium": true, "premium": true], forName: domain)
    defaults.setVolatileDomain(["premium": true, "settings.premium": true], forName: UserDefaults.argumentDomain)
    SettingsPreferences.prepare(defaults: defaults, domainName: domain)
    XCTAssertNil(defaults.object(forKey: "settings.premium"))
    XCTAssertNil(defaults.object(forKey: "premium"))

    UserDefaults.standard.set(true, forKey: "settings.premium")
    defer { UserDefaults.standard.removeObject(forKey: "settings.premium") }
    #if DEBUG
    let options = LaunchOptions.parse(arguments: ["Lakshly", "-premium", "YES", "-settings.premium", "YES"])
    XCTAssertNil(options.demoUnlocked)
    XCTAssertNil(options.showPaywall)
    #endif
    let store = EntitlementStore(syncPurchases: {})
    await store.refresh()
    XCTAssertFalse(store.isPremium)
    XCTAssertEqual(store.tier, .free)
    assertFreeKeepsBasicWidgetsOnly(store)
  }

  /// Budget and bill widgets stay on Free. Every other feature, including extra widgets, does not.
  private func assertFreeKeepsBasicWidgetsOnly(_ store: EntitlementStore) {
    XCTAssertTrue(store.can(.basicWidgets))
    XCTAssertTrue(can(.basicWidgets, tier: .free))
    XCTAssertFalse(store.can(.extraWidgets))
    for feature in Feature.allCases where !Self.freeFeatures.contains(feature) {
      XCTAssertFalse(store.can(feature), feature.rawValue)
      XCTAssertFalse(can(feature, tier: .free), feature.rawValue)
    }
  }

  func testAppSourcesUseStoreKitAsTheOnlyNetworkFramework() throws {
    let root = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("Lakshly", isDirectory: true)
    guard FileManager.default.fileExists(atPath: root.path) else {
      throw XCTSkip("App sources are not readable from this test process. The release script scans them.")
    }
    let forbidden = ["URLSession", "URLRequest", "NWConnection", "import Network", "WKWebView",
                     "import StoreKitTest", "SKTestSession", "AppStorage(\"settings.premium\")"]
    var importedStoreKit = false
    guard let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else {
      XCTFail("Could not read \(root.path)")
      return
    }
    for case let url as URL in enumerator {
      guard url.pathExtension == "swift" else { continue }
      let text = try String(contentsOf: url, encoding: .utf8)
      if text.contains("import StoreKit\n") || text.contains("import StoreKit\r") { importedStoreKit = true }
      for token in forbidden {
        XCTAssertFalse(text.contains(token), "\(url.lastPathComponent) contains \(token)")
      }
    }
    XCTAssertTrue(importedStoreKit)
  }

  private func configure(_ session: SKTestSession, storefront: String, locale: String) throws {
    // resetToDefaultState() restores disableDialogs = false, so reset first.
    session.resetToDefaultState()
    session.clearTransactions()
    session.disableDialogs = true
    session.storefront = storefront
    session.locale = Locale(identifier: locale)
  }

  private func assertPrice(_ product: Product, symbol: String, amount: String, currency: String,
                           file: StaticString = #filePath, line: UInt = #line) {
    guard let expected = Decimal(string: amount) else {
      XCTFail("Not a decimal: \(amount)", file: file, line: line)
      return
    }
    XCTAssertEqual(product.price, expected, product.displayPrice, file: file, line: line)
    XCTAssertEqual(product.priceFormatStyle.currencyCode, Optional(currency), product.displayPrice, file: file, line: line)
    XCTAssertTrue(product.displayPrice.contains(symbol), product.displayPrice, file: file, line: line)
    let digits = product.displayPrice.filter(\.isNumber)
    XCTAssertTrue(digits.contains(amount.filter(\.isNumber)), product.displayPrice, file: file, line: line)
  }

  private func waitForPremium(_ store: EntitlementStore, expected: Bool) async {
    let deadline = Date().addingTimeInterval(8)
    while Date() < deadline {
      await store.refresh()
      if store.isPremium == expected { return }
      try? await Task.sleep(nanoseconds: 150_000_000)
    }
    await store.refresh()
  }

  /// Restore reads entitlements once. The test session can lag, so try again until it settles.
  private func waitForRestore(_ store: EntitlementStore, premium: Bool) async {
    let expected = premium ? "Premium restored" : "Nothing to restore"
    let deadline = Date().addingTimeInterval(8)
    while Date() < deadline {
      await store.restore()
      if store.isPremium == premium, store.purchaseState == expected { return }
      try? await Task.sleep(nanoseconds: 150_000_000)
    }
    await store.restore()
  }
}
