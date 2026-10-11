import SwiftUI
#if !PARITY_SHOTS
import StoreKit
#endif

struct ProfileIdentity: View {
  @Environment(\.theme) private var theme
  let profile: ProfileRecord
  var tier: Tier = .free
  var body: some View {
    HStack(spacing: 10) {
      ProfileAvatar(profile: profile, tier: tier)
      VStack(alignment: .leading, spacing: 2) {
        Text(profile.displayName).font(.subheadline.weight(.semibold))
        TierPill(tier: tier)
        if profile.name == nil {
          HStack(spacing: 4) {
            Circle().fill(theme.gold).frame(width: 4, height: 4)
            Text("Add your name").font(.caption).foregroundStyle(theme.secondaryText)
          }
        }
      }
    }.frame(minHeight: 44)
  }
}

struct ProfileAvatar: View {
  @Environment(\.theme) private var theme
  let profile: ProfileRecord
  var tier: Tier = .free
  var body: some View {
    ZStack {
      Circle().fill(theme.surface)
      if let initial = profile.initial { Text(initial).font(.headline) }
      else { Image(systemName: "person").font(.headline) }
    }.frame(width: 36, height: 36).foregroundStyle(theme.text)
      .overlay { Circle().strokeBorder(tier >= .premium ? Color(hex: "#E9BF62") : theme.text.opacity(0.2), lineWidth: tier >= .premium ? 2 : 1) }
      .accessibilityHidden(true)
  }
}

/// Shared by the profile popover, Settings and offscreen renders.
struct ProfileEditor: View {
  let tier: Tier
  let save: (String) -> Void
  let clear: () -> Void
  let cancel: (() -> Void)?
  let rendering: Bool
  @State private var name: String
  init(profile: ProfileRecord, tier: Tier = .free, save: @escaping (String) -> Void, clear: @escaping () -> Void, cancel: (() -> Void)? = nil, rendering: Bool = false) {
    self.tier = tier
    self.save = save; self.clear = clear; self.cancel = cancel; self.rendering = rendering
    _name = State(initialValue: profile.name ?? "")
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ProfileIdentity(profile: ProfileRecord(name: name), tier: tier)
      Text("What should we call you? (optional)").font(.subheadline)
      SetupEntry(prompt: "Your name", text: $name, rendering: rendering)
        .accessibilityLabel("Your name, optional, maximum 40 characters")
        .accessibilityIdentifier("profile.name")
        .onChange(of: name) { _, value in if value.count > 40 { name = String(value.prefix(40)) } }
      Text("Encrypted on this device.").font(.caption).foregroundStyle(.secondary)
      HStack {
        Button("Save") { save(name) }.buttonStyle(ThemedSubmitStyle())
          .accessibilityIdentifier("profile.save").frame(minHeight: 44)
        Button("Clear") { name = ""; clear() }.accessibilityIdentifier("profile.clear").frame(minHeight: 44)
        if let cancel { Button("Cancel", action: cancel).keyboardShortcut(.cancelAction).frame(minHeight: 44) }
      }
    }
  }
}

#if !PARITY_SHOTS
struct ProfileChip: View {
  let store: DataStore
  @Environment(EntitlementStore.self) private var entitlements
  @State private var editing = false
  var body: some View {
    Button { editing = true } label: { ProfileIdentity(profile: store.profile, tier: entitlements.tier) }
      .buttonStyle(.plain)
      .accessibilityIdentifier("profile.chip")
      .accessibilityLabel("\(store.profile.name ?? "Add your name"), \(entitlements.tier.accessibilityName). Edit name")
      .popover(isPresented: $editing) {
        ProfileEditor(profile: store.profile, tier: entitlements.tier, save: { store.saveProfile($0); if store.error == nil { editing = false } },
                      clear: { store.clearProfile(); if store.error == nil { editing = false } }, cancel: { editing = false })
          .padding(20).frame(minWidth: 300, idealWidth: 340)
      }
  }
}

struct SettingsProfileCard: View {
  let store: DataStore
  var intentionalVisit = true
  @Environment(EntitlementStore.self) private var entitlements
  @State private var upsell = false
  @State private var considered = false
  @State private var paywall = false
  #if os(iOS)
  @State private var manage = false
  #endif
  private let history = TierNudgeHistory()
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Card(title: "Profile") {
        ProfileChip(store: store)
        TierProfileDetails(tier: entitlements.tier, purchaseDate: entitlements.purchaseDate,
          expirationDate: entitlements.expirationDate, willRenew: entitlements.willRenew)
        #if os(iOS)
        if entitlements.isPremium {
          Button("Manage subscription") { manage = true }.frame(minHeight: 44)
        }
        #endif
        if let error = store.error { Text(error).font(.caption) }
      }
      TierBenefits(tier: entitlements.tier, showUpsell: upsell,
        seePremium: { paywall = true }, notNow: { history.snooze(now: Date()); upsell = false })
    }
    .sheet(isPresented: $paywall) { PaywallView() }
    #if os(iOS)
    .manageSubscriptionsSheet(isPresented: $manage)
    #endif
    .onAppear { considerNudge() }
    .onChange(of: entitlements.hasResolved) { _, _ in considerNudge() }
    .onChange(of: entitlements.tier) { _, tier in if tier != .free { upsell = false } }
  }
  private func considerNudge() {
    guard !considered, entitlements.hasResolved else { return }
    considered = true
    guard entitlements.tier == .free, history.eligible(now: Date(), intentional: intentionalVisit) else { return }
    history.recordShown(now: Date())
    upsell = true
  }
}

#endif
