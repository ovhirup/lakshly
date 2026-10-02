import StoreKit
import SwiftUI

enum PaywallContext: Identifiable, Equatable {
  case general
  case theme(ThemeID)
  case feature(Feature)

  var id: String {
    switch self {
    case .general: "general"
    case .theme(let theme): "theme-\(theme.rawValue)"
    case .feature(let feature): "feature-\(feature.rawValue)"
    }
  }
}

struct PaywallView: View {
  @Environment(\.theme) private var theme
  @Environment(\.dismiss) private var dismiss
  @Environment(EntitlementStore.self) private var entitlements
  var context: PaywallContext = .general
  @State private var selectedID = EntitlementStore.yearlyProductID
  #if os(iOS)
  @State private var manageSubscription = false
  #endif

  private var highlighted: Feature? {
    switch context {
    case .general: nil
    case .theme: .premiumThemes
    case .feature(let feature): feature
    }
  }
  private var headerTitle: String {
    if case .theme(let id) = context { return "Keep \(id.definition.name) with Premium" }
    return "Lakshly Premium"
  }
  private var orderedProducts: [Product] {
    entitlements.products.sorted { rank($0.id) < rank($1.id) }
  }
  private var selectedProduct: Product? {
    orderedProducts.first { $0.id == selectedID } ?? orderedProducts.first
  }
  private var continueTitle: String {
    selectedProduct?.id == EntitlementStore.monthlyProductID ? "Continue with Monthly" : "Continue with Yearly"
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: theme.spacious ? 28 : 20) {
        if entitlements.isPremium {
          thanks
        } else {
          offer
        }
      }
      .frame(maxWidth: 560, alignment: .leading)
      .padding(theme.spacious ? 32 : 24)
      .frame(maxWidth: .infinity)
    }
    .scrollContentBackground(.hidden)
    .background { ThemeBackground() }
    .foregroundStyle(theme.text)
    .tint(theme.gold)
    .frame(minWidth: 320, minHeight: 520)
    #if os(iOS)
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
    #endif
    .task {
      if entitlements.products.isEmpty { await entitlements.loadProducts() }
      alignSelection()
    }
    .onChange(of: entitlements.products.map(\.id)) { _, _ in alignSelection() }
  }

  private var offer: some View {
    VStack(alignment: .leading, spacing: theme.spacious ? 22 : 16) {
      if case .theme(let id) = context {
        ThemeCard(palette: ThemePalette(id), selected: false, locked: false)
          .frame(maxWidth: 240)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("\(id.definition.name) theme preview")
      }
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Image(systemName: "sparkle")
          .font(.title2)
          .foregroundStyle(theme.gold)
          .accessibilityHidden(true)
        Text(headerTitle)
          .font(.system(.largeTitle, design: .rounded, weight: .bold))
          .fixedSize(horizontal: false, vertical: true)
          .accessibilityAddTraits(.isHeader)
      }
      Text("Every rupee on target, in more depth.")
        .foregroundStyle(theme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
      VStack(alignment: .leading, spacing: 8) {
        Text("What you get")
          .font(.headline)
          .accessibilityAddTraits(.isHeader)
        ForEach(PaywallFeature.rows) { row in
          featureRow(row)
        }
      }
      plans
      if let product = selectedProduct {
        Button(continueTitle) {
          Task { await entitlements.purchase(product) }
        }
        .buttonStyle(ThemedSubmitStyle())
        .disabled(entitlements.isPurchasing)
        .accessibilityIdentifier("paywall.continue")
        .accessibilityHint("Subscribes to the selected Lakshly Premium plan")
      }
      if entitlements.isPurchasing {
        ProgressView("Contacting the App Store")
          .accessibilityLabel("Contacting the App Store")
      }
      statusLines
      Button("Restore Purchases") { Task { await entitlements.restore() } }
        .accessibilityIdentifier("paywall.restore")
        .accessibilityHint("Checks this Apple ID for an existing Lakshly Premium subscription")
      Text(
        "Renews automatically until cancelled. Cancel any time in Settings › Apple ID › Subscriptions at least 24 hours before renewal. Family Sharing supported. Sandbox testing build: no real charges."
      )
      .font(.caption)
      .foregroundStyle(theme.secondaryText)
      .fixedSize(horizontal: false, vertical: true)
      .accessibilityLabel(
        "Renews automatically until cancelled. Cancel any time in Settings, Apple ID, Subscriptions, at least 24 hours before renewal. Family Sharing supported. Sandbox testing build: no real charges."
      )
      HStack(spacing: 12) {
        Link("Terms", destination: URL(string: "https://lakshly.app/terms")!)
          .accessibilityHint("Opens Terms in the browser")
        Text("·").accessibilityHidden(true)
        Link("Privacy", destination: URL(string: "https://lakshly.app/privacy")!)
          .accessibilityHint("Opens Privacy in the browser")
      }
      .font(.subheadline)
      Button("Not now") { dismiss() }
        .accessibilityIdentifier("paywall.notNow")
        .accessibilityHint("Closes Lakshly Premium")
    }
  }

  private var thanks: some View {
    VStack(alignment: .leading, spacing: 16) {
      Image(systemName: "sparkle")
        .font(.largeTitle)
        .foregroundStyle(theme.gold)
        .accessibilityHidden(true)
      Text("You're Premium ✦ thank you")
        .font(.system(.largeTitle, design: .rounded, weight: .bold))
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("paywall.thanks")
        .accessibilityAddTraits(.isHeader)
      Text("Every rupee on target, in more depth.")
        .foregroundStyle(theme.secondaryText)
      #if os(iOS)
      Button("Manage Subscription") { manageSubscription = true }
        .accessibilityHint("Opens Apple's subscription management")
        .manageSubscriptionsSheet(isPresented: $manageSubscription)
      #endif
      Button("Done") { dismiss() }
        .buttonStyle(ThemedSubmitStyle())
        .accessibilityIdentifier("paywall.done")
    }
    .accessibilityElement(children: .contain)
  }

  @ViewBuilder private var plans: some View {
    if entitlements.products.isEmpty && entitlements.productsUnavailable {
      VStack(alignment: .leading, spacing: 12) {
        Text(EntitlementStore.pricesUnavailable)
          .foregroundStyle(theme.secondaryText)
        Button("Retry") { Task { await entitlements.loadProducts() } }
          .buttonStyle(ThemedSubmitStyle())
          .accessibilityIdentifier("paywall.retry")
          .accessibilityHint("Tries to load subscription prices again")
      }
    } else if entitlements.products.isEmpty {
      VStack(spacing: 12) {
        placeholder
        placeholder
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("Loading prices")
    } else {
      ForEach(orderedProducts) { product in
        planCard(product)
      }
    }
  }

  private var placeholder: some View {
    RoundedRectangle(cornerRadius: 20, style: .continuous)
      .fill(theme.surface.opacity(theme.clearGlass ? 0.9 : 0.65))
      .frame(maxWidth: .infinity)
      .frame(minHeight: 92)
  }

  private func planCard(_ product: Product) -> some View {
    let yearly = product.id == EntitlementStore.yearlyProductID
    let selected = product.id == (selectedProduct?.id ?? selectedID)
    let period = yearly ? "year" : "month"
    return Button {
      selectedID = product.id
    } label: {
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 8) {
          Text(yearly ? "Yearly" : "Monthly")
            .font(.subheadline.weight(.semibold))
          if yearly {
            Pill(text: "Best value", color: theme.gold)
          }
          Spacer(minLength: 0)
        }
        Text("\(product.displayPrice)/\(period)")
          .font(.system(.title, design: .rounded, weight: .bold))
          .monospacedDigit()
          .fixedSize(horizontal: false, vertical: true)
        if yearly {
          Text(perMonth(product))
            .font(.subheadline)
            .foregroundStyle(theme.secondaryText)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(theme.spacious ? 22 : 16)
      .background(theme.surface.opacity(theme.clearGlass ? 0.92 : 0.55), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
          .strokeBorder(selected ? theme.gold : theme.secondaryText.opacity(0.35), lineWidth: selected ? 2 : 0.5)
      }
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(planLabel(product, yearly: yearly))
    .accessibilityAddTraits(selected ? .isSelected : [])
    .accessibilityHint("Selects this plan")
    .accessibilityIdentifier(yearly ? "paywall.plan.yearly" : "paywall.plan.monthly")
  }

  private func featureRow(_ row: PaywallFeature) -> some View {
    let highlighted = highlighted == row.feature
    return HStack(alignment: .firstTextBaseline, spacing: 10) {
      Image(systemName: row.symbol)
        .foregroundStyle(theme.gold)
        .frame(width: 22)
        .accessibilityHidden(true)
      Text(row.title)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(.vertical, 6)
    .padding(.horizontal, 8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(highlighted ? theme.gold.opacity(0.16) : theme.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityElement(children: .combine)
    .accessibilityLabel(highlighted ? "\(row.title), highlighted" : row.title)
    .accessibilityIdentifier("paywall.feature.\(row.feature.rawValue)")
  }

  @ViewBuilder private var statusLines: some View {
    if !entitlements.purchaseState.isEmpty {
      Text(entitlements.purchaseState)
        .font(.subheadline)
        .foregroundStyle(theme.secondaryText)
        .accessibilityIdentifier("paywall.purchaseState")
    }
    if let error = entitlements.lastError, error != EntitlementStore.pricesUnavailable || entitlements.products.isEmpty == false {
      Text(error)
        .font(.subheadline)
        .foregroundStyle(theme.danger)
    }
  }

  private func perMonth(_ product: Product) -> String {
    let month = product.price / 12
    return "≈\(month.formatted(product.priceFormatStyle))/mo"
  }

  private func planLabel(_ product: Product, yearly: Bool) -> String {
    var parts = [yearly ? "Yearly" : "Monthly", "\(product.displayPrice) per \(yearly ? "year" : "month")"]
    if yearly {
      parts.append("Best value")
      parts.append(perMonth(product))
    }
    return parts.joined(separator: ", ")
  }

  private func alignSelection() {
    let ids = entitlements.products.map(\.id)
    guard !ids.isEmpty else { return }
    if !ids.contains(selectedID) {
      selectedID = ids.contains(EntitlementStore.yearlyProductID) ? EntitlementStore.yearlyProductID : ids[0]
    }
  }

  private func rank(_ id: String) -> Int {
    if id == EntitlementStore.yearlyProductID { return 0 }
    if id == EntitlementStore.monthlyProductID { return 1 }
    return 2
  }
}

private struct PaywallFeature: Identifiable {
  let feature: Feature
  let title: String
  let symbol: String
  var id: String { feature.rawValue }
  static let rows: [PaywallFeature] = [
    PaywallFeature(feature: .premiumThemes, title: "Ocean, Forest and Rose Quartz themes", symbol: "paintpalette"),
    PaywallFeature(feature: .debtPlanner, title: "Debt payoff planner", symbol: "chart.line.downtrend.xyaxis"),
    PaywallFeature(feature: .creditInsights, title: "Credit insights", symbol: "creditcard"),
    PaywallFeature(feature: .investmentInsights, title: "Investment projections", symbol: "chart.line.uptrend.xyaxis"),
    PaywallFeature(feature: .rewardsInsights, title: "Rewards value & expiry tracking", symbol: "gift"),
    PaywallFeature(feature: .priorityFeedback, title: "⭐ priority feature requests", symbol: "star.fill"),
  ]
}
