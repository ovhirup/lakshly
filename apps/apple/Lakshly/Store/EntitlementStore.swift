import Foundation
import Observation
import StoreKit
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// The dataset model is also named `Transaction`. StoreKit calls use this alias.
private typealias StoreTransaction = StoreKit.Transaction

/// Cancels the transaction listener when the store is released.
private final class TransactionListener: @unchecked Sendable {
  var task: Task<Void, Never>?
  deinit { task?.cancel() }
}

@MainActor
@Observable
final class EntitlementStore {
  static let monthlyProductID = PremiumProduct.monthlyID
  static let yearlyProductID = PremiumProduct.yearlyID
  static let productIDs = PremiumProduct.ids
  static let pricesUnavailable = "Prices unavailable right now"

  private(set) var products: [Product] = []
  private(set) var tier: Tier = .free
  private(set) var activeProductID: String?
  private(set) var expirationDate: Date?
  private(set) var willRenew: Bool?
  /// Friendly status such as "Waiting for approval", "Premium restored", or "Nothing to restore".
  private(set) var purchaseState: String = ""
  private(set) var lastError: String?
  private(set) var isLoadingProducts = false
  private(set) var productsUnavailable = false
  private(set) var isPurchasing = false
  /// False until the first `refresh()` has read `currentEntitlements`.
  private(set) var hasResolved = false

  var isPremium: Bool { tier >= .premium }
  var planName: String? {
    switch activeProductID {
    case Self.yearlyProductID: "Yearly"
    case Self.monthlyProductID: "Monthly"
    default: nil
    }
  }

  @ObservationIgnored private let now: @Sendable () -> Date
  @ObservationIgnored private let syncPurchases: @Sendable () async throws -> Void
  @ObservationIgnored private let listener = TransactionListener()

  init(
    now: @escaping @Sendable () -> Date = { Date() },
    syncPurchases: (@Sendable () async throws -> Void)? = nil
  ) {
    self.now = now
    self.syncPurchases = syncPurchases ?? { try await AppStore.sync() }
    listener.task = Task.detached { [weak self] in
      for await update in StoreTransaction.updates {
        if Task.isCancelled { return }
        await self?.receive(update)
      }
    }
  }

  func can(_ feature: Feature) -> Bool {
    EntitlementRule.allows(feature, tier: tier)
  }

  func loadProducts() async {
    isLoadingProducts = true
    productsUnavailable = false
    if lastError == Self.pricesUnavailable { lastError = nil }
    defer { isLoadingProducts = false }
    do {
      let loaded = try await Product.products(for: Self.productIDs)
      products = loaded.sorted { Self.productRank($0.id) < Self.productRank($1.id) }
      if products.isEmpty {
        productsUnavailable = true
        lastError = Self.pricesUnavailable
      }
    } catch {
      products = []
      productsUnavailable = true
      lastError = Self.pricesUnavailable
    }
  }

  func refresh() async {
    var snapshots: [EntitlementSnapshot] = []
    for await result in StoreTransaction.currentEntitlements {
      let transaction: StoreTransaction
      let verified: Bool
      switch result {
      case .verified(let value):
        transaction = value
        verified = true
      case .unverified(let value, _):
        transaction = value
        verified = false
      }
      snapshots.append(EntitlementSnapshot(
        productID: transaction.productID,
        expirationDate: transaction.expirationDate,
        revocationDate: transaction.revocationDate,
        isUpgraded: transaction.isUpgraded,
        verified: verified
      ))
      if verified, Self.productIDs.contains(transaction.productID) {
        await transaction.finish()
      }
    }
    apply(EntitlementResolver.resolve(snapshots, now: now()))
    if let renewal = await renewalIntention() {
      willRenew = renewal
    }
  }

  func purchase(_ product: Product) async {
    lastError = nil
    isPurchasing = true
    defer { isPurchasing = false }
    do {
      let result = try await Self.purchaseInActiveScene(product)
      switch result {
      case .success(let verification):
        switch verification {
        case .verified(let transaction):
          await transaction.finish()
          await refresh()
          purchaseState = ""
        case .unverified:
          lastError = "We couldn't verify that purchase."
        }
      case .userCancelled:
        break
      case .pending:
        purchaseState = "Waiting for approval"
      @unknown default:
        lastError = "Something went wrong with that purchase."
      }
    } catch {
      lastError = "Something went wrong with that purchase."
    }
  }

  func restore() async {
    lastError = nil
    do {
      try await syncPurchases()
      await refresh()
      purchaseState = isPremium ? "Premium restored" : "Nothing to restore"
    } catch {
      purchaseState = ""
      lastError = "Couldn't restore purchases right now."
    }
  }

  private func receive(_ result: VerificationResult<StoreTransaction>) async {
    guard case .verified(let transaction) = result else { return }
    await transaction.finish()
    await refresh()
  }

  private func apply(_ resolved: ResolvedEntitlement) {
    hasResolved = true
    tier = resolved.tier
    activeProductID = resolved.activeProductID
    expirationDate = resolved.expirationDate
    willRenew = resolved.willRenew
  }

  private func renewalIntention() async -> Bool? {
    guard let productID = activeProductID else { return nil }
    let product = products.first { $0.id == productID }
    guard let product, let subscription = product.subscription else { return nil }
    guard let statuses = try? await subscription.status else { return nil }
    for status in statuses {
      guard case .verified(let renewal) = status.renewalInfo else { continue }
      guard case .verified(let transaction) = status.transaction else { continue }
      if transaction.productID == productID, transaction.revocationDate == nil {
        return renewal.willAutoRenew
      }
    }
    return nil
  }

  /// Confirms the purchase against the app's active scene/window. A scene-less
  /// `purchase()` can wait forever on iOS 26 when no UI context is found.
  private static func purchaseInActiveScene(_ product: Product) async throws -> Product.PurchaseResult {
    #if os(iOS)
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    if let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first {
      return try await product.purchase(confirmIn: scene)
    }
    #elseif os(macOS)
    if let window = NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first {
      return try await product.purchase(confirmIn: window)
    }
    #endif
    return try await product.purchase()
  }

  private static func productRank(_ id: String) -> Int {
    if id == monthlyProductID { return 0 }
    if id == yearlyProductID { return 1 }
    return 2
  }
}
