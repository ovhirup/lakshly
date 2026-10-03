import SwiftUI

@main struct LakshlyApp: App {
  @State private var store: DataStore
  @State private var lock: AppLock
  @State private var entitlements: EntitlementStore
  @State private var appIcons: AppIconController
  @AppStorage private var themeID: String
  @AppStorage private var appearanceID: String
  @State private var launchTheme: String?
  #if os(macOS)
  @AppStorage private var menuBarExtra: Bool
  #endif

  init() {
    SettingsPreferences.prepare()
    let storedTheme = UserDefaults.standard.string(forKey: "settings.themeID") ?? "lakshmi"
    let storedAppearance = UserDefaults.standard.string(forKey: "settings.appearance") ?? "system"
    GlancePublisher.configure(
      themeID: LaunchOptions.current.theme ?? storedTheme,
      appearance: LaunchOptions.current.appearance ?? storedAppearance,
      tier: .free)
    _themeID = AppStorage(wrappedValue: "lakshmi", "settings.themeID")
    _appearanceID = AppStorage(wrappedValue: "system", "settings.appearance")
    _launchTheme = State(initialValue: LaunchOptions.current.theme)
    #if os(macOS)
    _menuBarExtra = AppStorage(wrappedValue: true, GlancePreferences.menuBarExtraKey, store: GlanceStore.preferences)
    #endif
    _store = State(initialValue: DataStore())
    _lock = State(initialValue: AppLock())
    _entitlements = State(initialValue: EntitlementStore())
    _appIcons = State(initialValue: AppIconController())
  }
  private var appearance: ColorScheme? {
    switch LaunchOptions.current.appearance ?? appearanceID {
    case "light": .light
    case "dark": .dark
    default: nil
    }
  }
  /// Stored Premium themes fall back to Lakshmi while Free. A DEBUG `-theme` override still wins.
  private var effectiveThemeID: String {
    if let launchTheme { return launchTheme }
    let stored = ThemeID.resolve(themeID)
    // Wait for the first entitlement read so a Premium user's theme doesn't flash to Lakshmi.
    if stored.definition.premium && entitlements.hasResolved && !entitlements.isPremium {
      return ThemeID.lakshmi.rawValue
    }
    return stored.rawValue
  }
  var body: some Scene {
    WindowGroup(id: "main") {
      let palette = ThemePalette(ThemeID.resolve(effectiveThemeID), scheme: appearance)
      RootView(store: store, lock: lock, themeSelection: Binding(
        get: { effectiveThemeID },
        set: { themeID = $0; launchTheme = nil }
      ))
        .environment(\.theme, palette).environment(entitlements).environment(appIcons)
        .foregroundStyle(palette.text).tint(palette.gold)
        .preferredColorScheme(appearance)
        .task {
          await appIcons.start(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved)
          await entitlements.loadProducts()
          await entitlements.refresh()
        }
        .onChange(of: entitlements.isPremium) { _, _ in
          Task { await appIcons.updateEntitlements(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved) }
        }
        .onChange(of: entitlements.hasResolved) { _, _ in
          Task { await appIcons.updateEntitlements(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved) }
        }
    }
    #if os(macOS)
    MenuBarExtra("Lakshly", systemImage: "indianrupeesign.circle", isInserted: $menuBarExtra) {
      MenuBarPanel()
        .environment(\.theme, ThemePalette(ThemeID.resolve(effectiveThemeID), scheme: appearance))
        .environment(store)
        .environment(entitlements)
        .preferredColorScheme(appearance)
    }
    .menuBarExtraStyle(.window)
    #endif
  }
}

struct RootView: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  let lock: AppLock
  @Binding var themeSelection: String
  @Environment(\.scenePhase) private var phase
  @AppStorage("settings.appLock") private var lockEnabled = true
  @State private var settings = false
  @State private var selected = "overview"
  @State private var pendingTab: String?
  @AppStorage("settings.appearance") private var appearanceStored = "system"

  init(store: DataStore, lock: AppLock, themeSelection: Binding<String>) {
    self.store = store
    self.lock = lock
    _themeSelection = themeSelection
    #if DEBUG
    let options = LaunchOptions.current
    _settings = State(initialValue: options.openSettings ?? false)
    _selected = State(initialValue: options.startTab ?? "overview")
    #endif
  }
  var body: some View {
    ZStack {
      ThemeBackground()
      if lock.locked {
        GlassEffectContainer(spacing: 24) {
        VStack(spacing: 24) {
          Image(systemName: "lock.shield").font(.system(size: 64)).foregroundStyle(theme.lockGold)
          Text("Lakshly").font(.system(.largeTitle, design: .rounded, weight: .bold))
          Text("Every rupee on target.").foregroundStyle(theme.lockGold)
          if lock.canAuthenticate {
            Button(lock.message == nil ? "Unlock with Face ID / Touch ID" : "Try again") { Task { await lock.unlock() } }.buttonStyle(
              .glass
            ).disabled(lock.authenticating)
          } else if lock.allowDemo {
            Button("Continue (demo mode)") { lock.continueDemo() }.buttonStyle(.glass)
          } else {
            Button("Try again") { Task { await lock.unlock() } }.buttonStyle(.glass)
              .disabled(lock.authenticating)
          }
          if lock.forced { Text("Lock screen preview").font(.caption) }
          if let message = lock.message { Text(message).font(.caption) }
        }.padding(36).modifier(GlassCard(tint: theme.lockBackground.opacity(0.9))).tint(theme.lockGold).padding()
        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(theme.lockBackground.ignoresSafeArea())
          .foregroundStyle(theme.lockGold)
      } else {
        TabView(selection: $selected) {
          Tab("Overview", systemImage: "square.grid.2x2", value: "overview") {
            navigation { OverviewView(store: store, showFeedback: { selected = "feedback" }) }
          }
          Tab("Spend", systemImage: "chart.pie", value: "spend") {
            navigation { SpendView(store: store) }
          }
          Tab("Budget", systemImage: "target", value: "budget") {
            navigation { BudgetView(store: store) }
          }
          Tab("Feedback", systemImage: "heart.text.square", value: "feedback") {
            navigation { FeedbackView(store: store) }
          }
          Tab(value: "debt") {
            navigation { DebtView(store: store) }
          } label: {
            premiumTab("Debt", systemImage: "chart.line.downtrend.xyaxis")
          }
          Tab(value: "credit") {
            navigation { CreditView(store: store) }
          } label: {
            premiumTab("Credit", systemImage: "creditcard")
          }
          Tab(value: "investments") {
            navigation { InvestmentsView(store: store) }
          } label: {
            premiumTab("Investments", systemImage: "chart.line.uptrend.xyaxis")
          }
          Tab(value: "rewards") {
            navigation { RewardsView(store: store) }
          } label: {
            premiumTab("Rewards", systemImage: "gift")
          }
          Tab("History", systemImage: "clock", value: "history") {
            navigation { HistoryView(store: store) }
          }
          Tab("Import", systemImage: "square.and.arrow.down", value: "import") {
            navigation { ImportView(store: store) }
          }
        }.tabViewStyle(.sidebarAdaptable)
      }
    }.tint(theme.gold).sheet(isPresented: $settings) { SettingsView(store: store, lock: lock, themeSelection: $themeSelection) }
      .modifier(LaunchPaywallModifier(locked: lock.locked))
      .onAppear {
        if !lockEnabled && !lock.forced { lock.locked = false }
        publishGlance()
      }
      .onOpenURL { url in
        switch GlanceLinks.effect(for: url, locked: lock.locked) {
        case .ignore: break
        case .select(let tab): selected = tab
        case .deferUntilUnlock(let tab): pendingTab = tab
        }
      }
      .onChange(of: lock.locked) { _, locked in
        guard !locked else { return }
        if let pendingTab {
          selected = pendingTab
          self.pendingTab = nil
        }
        publishGlance()
      }
      .onChange(of: themeSelection) { _, _ in publishGlance() }
      .onChange(of: entitlements.tier) { _, _ in publishGlance() }
      .onChange(of: entitlements.hasResolved) { _, _ in publishGlance() }
      .onChange(of: phase) { _, value in
        if value == .background || value == .active { publishGlance() }
        if value == .background || (value == .inactive && !lock.authenticating) {
          settings = false
          lock.relock(enabled: lockEnabled)
        }
      }
  }
  private func publishGlance() {
    GlancePublisher.configure(
      themeID: themeSelection,
      appearance: LaunchOptions.current.appearance ?? appearanceStored,
      tier: entitlements.tier)
    GlancePublisher.publish(dataset: store.dataset)
  }
  private func navigation<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    NavigationStack {
      content().toolbar { Button("Settings", systemImage: "gearshape") { settings = true } }
    }
  }
  private func premiumTab(_ title: String, systemImage: String) -> some View {
    let locked = !entitlements.isPremium
    return Label {
      HStack(spacing: 4) {
        Text(title)
        if locked {
          Image(systemName: "lock.fill")
            .font(.caption2)
            .accessibilityHidden(true)
        }
      }
    } icon: {
      Image(systemName: systemImage)
    }
    .accessibilityLabel(title)
    .accessibilityValue(locked ? "Premium" : "")
  }
}

/// DEBUG screenshot control. Compiled out of Release, and never a Premium grant.
private struct LaunchPaywallModifier: ViewModifier {
  var locked: Bool
  #if DEBUG
  @State private var presented = LaunchOptions.current.showPaywall ?? false
  #endif
  func body(content: Content) -> some View {
    #if DEBUG
    content.sheet(isPresented: Binding(
      get: { presented && !locked },
      set: { presented = $0 }
    )) {
      PaywallView(context: .general)
    }
    #else
    content
    #endif
  }
}
