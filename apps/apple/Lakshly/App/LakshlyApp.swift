import SwiftUI

@main struct LakshlyApp: App {
  @State private var store: DataStore
  @State private var session: SetupSession
  @State private var lock: AppLock
  @State private var entitlements: EntitlementStore
  @State private var appIcons: AppIconController
  @AppStorage private var themeID: String
  @AppStorage private var appearanceID: String
  @State private var launchTheme: String?
  #if os(macOS)
  @AppStorage private var menuBarExtra: Bool
  @State private var notchPanel = NotchPanelController()
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
    let store = DataStore(loadSyntheticDemo: Self.loadsSyntheticDemoAtLaunch)
    _store = State(initialValue: store)
    _session = State(initialValue: SetupSession(store: store))
    _lock = State(initialValue: AppLock())
    _entitlements = State(initialValue: EntitlementStore())
    _appIcons = State(initialValue: AppIconController())
  }

  /// Release passes `debugControlsEnabled: false`, which ignores the launch argument.
  private static var skipsStoreKitForUITesting: Bool {
    #if DEBUG
    LaunchOptions.loadsUITestingSyntheticData(
      arguments: ProcessInfo.processInfo.arguments, debugControlsEnabled: true)
    #else
    false
    #endif
  }

  private static var loadsSyntheticDemoAtLaunch: Bool {
    #if DEBUG
    LaunchOptions.loadsUITestingSyntheticData(
      arguments: ProcessInfo.processInfo.arguments, debugControlsEnabled: true)
    #else
    LaunchOptions.loadsUITestingSyntheticData(
      arguments: ProcessInfo.processInfo.arguments, debugControlsEnabled: false)
    #endif
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
    #if os(macOS)
    #if DEBUG && LAKSHLY_MAC_UNIT_TEST_HOST
    WindowGroup("Lakshly unit tests") { Text("Lakshly unit tests") }
    #else
    mainScene
      .commands {
        CommandGroup(after: .appSettings) {
          Button("Set Up Lakshly…") { session.requestOpen(health: false, step: nil) }
        }
        CommandGroup(after: .windowArrangement) {
          Button("Data Sources Health") { session.requestOpen(health: true, step: nil) }
        }
      }
    #if !LAKSHLY_UI_TESTING
    Window("Set up Lakshly", id: "setup") {
      let palette = ThemePalette(ThemeID.resolve(effectiveThemeID), scheme: appearance)
      SetupHost(store: store)
        .environment(\.theme, palette).environment(store).environment(session).environment(entitlements)
        .environment(\.selectTheme) { themeID = $0; launchTheme = nil }
        .foregroundStyle(palette.text).tint(palette.gold)
        .preferredColorScheme(appearance)
    }
    .defaultSize(width: 760, height: 600)
    .windowResizability(.contentMinSize)
    MenuBarExtra("Lakshly", systemImage: "indianrupeesign.circle", isInserted: menuBarInserted) {
      MenuBarPanel()
        .environment(\.theme, ThemePalette(ThemeID.resolve(effectiveThemeID), scheme: appearance))
        .environment(store)
        .environment(session)
        .environment(entitlements)
        .preferredColorScheme(appearance)
    }
    .menuBarExtraStyle(.window)
    #endif
    #endif
    #else
    mainScene
    #endif
  }

  #if os(macOS)
  /// A Debug UI-test launch leaves the menu-bar extra out. The window-style
  /// extra keeps the app from finishing launch on a test runner. Release never sets this.
  private var menuBarInserted: Binding<Bool> {
    Binding(
      get: { menuBarExtra && !Self.uiTestingOmitsMenuBar },
      set: { menuBarExtra = $0 }
    )
  }

  private static var uiTestingOmitsMenuBar: Bool {
    #if DEBUG
    LaunchOptions.loadsUITestingSyntheticData(
      arguments: ProcessInfo.processInfo.arguments, debugControlsEnabled: true)
    #else
    false
    #endif
  }
  #endif

  private var mainScene: some Scene {
    WindowGroup(id: "main") {
      let palette = ThemePalette(ThemeID.resolve(effectiveThemeID), scheme: appearance)
      RootView(store: store, lock: lock, themeSelection: Binding(
        get: { effectiveThemeID },
        set: { themeID = $0; launchTheme = nil }
      ))
        .environment(\.theme, palette).environment(entitlements).environment(appIcons).environment(session)
        .environment(\.selectTheme) { themeID = $0; launchTheme = nil }
        .environment(\.openSetup) { health, step in session.requestOpen(health: health, step: step) }
        .foregroundStyle(palette.text).tint(palette.gold)
        .preferredColorScheme(appearance)
        #if os(macOS)
        .environment(\.notchPanel, notchPanel)
        #endif
        .task {
          await appIcons.start(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved)
          // A UI-test launch must not wait on the App Store before the window is usable.
          if !Self.skipsStoreKitForUITesting {
            await entitlements.loadProducts()
            await entitlements.refresh()
          }
        }
        .onChange(of: entitlements.isPremium) { _, _ in
          Task { await appIcons.updateEntitlements(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved) }
        }
        .onChange(of: entitlements.hasResolved) { _, _ in
          Task { await appIcons.updateEntitlements(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved) }
        }
    }
  }
}

struct RootView: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  let lock: AppLock
  @Binding var themeSelection: String
  @Environment(\.scenePhase) private var phase
  @Environment(SetupSession.self) private var session
  #if os(macOS)
  @Environment(\.openWindow) private var openWindow
  @Environment(\.notchPanel) private var notchController
  #endif
  @AppStorage("settings.appLock") private var lockEnabled = true
  @State private var settings = false
  @State private var selected = "overview"
  @State private var pendingTab: String?
  @State private var deferredSetup: String?? = nil
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
              .accessibilityIdentifier("lock.unlock")
          } else if lock.allowDemo {
            Button("Continue (demo mode)") { lock.continueDemo() }.buttonStyle(.glass)
              .accessibilityIdentifier("lock.demo")
          } else {
            Button("Try again") { Task { await lock.unlock() } }.buttonStyle(.glass)
              .disabled(lock.authenticating)
              .accessibilityIdentifier("lock.retry")
          }
          if lock.forced { Text("Lock screen preview").font(.caption) }
          if let message = lock.message { Text(message).font(.caption) }
        }.padding(36).modifier(GlassCard(tint: theme.lockBackground.opacity(0.9))).tint(theme.lockGold).padding()
        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(theme.lockBackground.ignoresSafeArea())
          .foregroundStyle(theme.lockGold)
          .accessibilityIdentifier("screen.lock")
      } else {
        TabView(selection: $selected) {
          Tab(value: "overview") {
            screen("screen.overview") {
              DataGate(store: store, title: "Overview", need: [.accounts, .transactions]) {
                OverviewView(store: store, showFeedback: { selected = "feedback" })
              }
            }
          } label: {
            tabLabel("Overview", systemImage: "square.grid.2x2", identifier: "tab.overview")
          }
          Tab(value: "spend") {
            screen("screen.spend") {
              DataGate(store: store, title: "Spend", need: [.transactions]) {
                SpendView(store: store)
              }
            }
          } label: {
            tabLabel("Spend", systemImage: "chart.pie", identifier: "tab.spend")
          }
          Tab(value: "budget") {
            screen("screen.budget") {
              DataGate(store: store, title: "Budget", need: [.transactions]) {
                BudgetView(store: store)
              }
            }
          } label: {
            tabLabel("Budget", systemImage: "target", identifier: "tab.budget")
          }
          Tab(value: "feedback") {
            screen("screen.feedback") { FeedbackView(store: store) }
          } label: {
            tabLabel("Feedback", systemImage: "heart.text.square", identifier: "tab.feedback")
          }
          Tab(value: "debt") {
            screen("screen.debt") {
              DataGate(store: store, title: "Debt", need: [.debts]) {
                DebtView(store: store)
              }
            }
          } label: {
            premiumTab("Debt", systemImage: "chart.line.downtrend.xyaxis", identifier: "tab.debt")
          }
          Tab(value: "credit") {
            screen("screen.credit") {
              DataGate(store: store, title: "Credit", need: [.cards]) {
                CreditView(store: store)
              }
            }
          } label: {
            premiumTab("Credit", systemImage: "creditcard", identifier: "tab.credit")
          }
          Tab(value: "investments") {
            screen("screen.investments") {
              DataGate(store: store, title: "Investments & SIPs", need: [.sips]) {
                InvestmentsView(store: store)
              }
            }
          } label: {
            premiumTab("Investments", systemImage: "chart.line.uptrend.xyaxis", identifier: "tab.investments")
          }
          Tab(value: "rewards") {
            screen("screen.rewards") {
              DataGate(store: store, title: "Rewards", need: [.rewards]) {
                RewardsView(store: store)
              }
            }
          } label: {
            premiumTab("Rewards", systemImage: "gift", identifier: "tab.rewards")
          }
          Tab(value: "history") {
            screen("screen.history") {
              DataGate(store: store, title: "History", need: [.savings, .transactions]) {
                HistoryView(store: store)
              }
            }
          } label: {
            tabLabel("History", systemImage: "clock", identifier: "tab.history")
          }
          Tab(value: "import") {
            screen("screen.import") { ImportView(store: store) }
          } label: {
            tabLabel("Import", systemImage: "square.and.arrow.down", identifier: "tab.import")
          }
        }.tabViewStyle(.sidebarAdaptable)
          .environment(\.openImport) { selected = "import" }
          .environment(\.openSetup) { health, step in session.requestOpen(health: health, step: step) }
      }
    }.tint(theme.gold).sheet(isPresented: $settings) { SettingsView(store: store, lock: lock, themeSelection: $themeSelection) }
      #if os(iOS)
      .fullScreenCover(isPresented: Bindable(session).presented) {
        SetupHost(store: store)
          .environment(\.theme, theme).environment(entitlements).environment(session)
          .environment(\.selectTheme) { themeSelection = $0 }
      }
      #endif
      .modifier(LaunchPaywallModifier(locked: lock.locked))
      .onAppear {
        if !lockEnabled && !lock.forced { lock.locked = false }
        #if os(macOS)
        notchController?.start { try GlanceVault.dataset(from: store) }
        syncNotch()
        #endif
        publishGlance()
        #if DEBUG
        let options = LaunchOptions.current
        let suppress = options.openSettings == true || options.showPaywall == true || options.startTab != nil
          || options.importDemo != nil || options.uiTestingSyntheticData == true
        #else
        let suppress = false
        #endif
        session.consumeLaunch(suppressAuto: suppress)
      }
      .onOpenURL { url in
        switch GlanceLinks.effect(for: url, locked: lock.locked) {
        case .ignore: break
        case .select(let tab): selected = tab
        case .deferUntilUnlock(let tab): pendingTab = tab
        case .openSetup(let step): session.requestOpen(health: false, step: step)
        case .deferSetup(let step): deferredSetup = .some(step)
        }
      }
      .onChange(of: lock.locked) { _, locked in
        #if os(macOS)
        if locked { notchController?.noteAppLocked() }
        #endif
        guard !locked else { return }
        if let pendingTab {
          selected = pendingTab
          self.pendingTab = nil
        }
        if let deferredSetup {
          session.requestOpen(health: false, step: deferredSetup)
          self.deferredSetup = nil
        }
        publishGlance()
      }
      .onChange(of: session.requestSettings) { _, requested in
        if requested {
          settings = true
          session.requestSettings = false
        }
      }
      .onChange(of: store.setupEpoch) { _, _ in session.syncFromStore() }
      #if os(macOS)
      .onChange(of: session.presented) { _, shown in
        if shown { openWindow(id: "setup") }
      }
      #endif
      .onChange(of: themeSelection) { _, _ in publishGlance() }
      .onChange(of: entitlements.tier) { _, _ in publishGlance() }
      .onChange(of: entitlements.hasResolved) { _, _ in publishGlance() }
      #if os(macOS)
      .onChange(of: notchSnapshotKey) { _, _ in syncNotch() }
      #endif
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
    #if os(macOS)
    syncNotch()
    #endif
  }
  #if os(macOS)
  private func syncNotch() {
    notchController?.update(
      entitled: entitlements.can(.notchPanel),
      showsNetWorth: entitlements.can(.extraWidgets),
      tier: entitlements.tier,
      theme: theme,
      appearance: LaunchOptions.current.appearance ?? appearanceStored)
  }

  private var notchSnapshotKey: String {
    let data = store.dataset
    return [
      String(describing: store.source),
      data?.generatedAt ?? "",
      String(data?.transactions.count ?? 0),
      String(data?.budgets?.count ?? 0),
      String(data?.accounts.count ?? 0),
      String(data?.debts?.count ?? 0),
      String(data?.sips?.count ?? 0),
    ].joined(separator: "|")
  }
  #endif
  private func screen<Content: View>(_ identifier: String, @ViewBuilder content: () -> Content) -> some View {
    NavigationStack {
      content().toolbar {
        Button("Settings", systemImage: "gearshape") { settings = true }
          .accessibilityIdentifier("nav.settings")
      }
    }
    .accessibilityIdentifier(identifier)
  }
  private func tabLabel(_ title: String, systemImage: String, identifier: String) -> some View {
    Label(title, systemImage: systemImage)
      .accessibilityIdentifier(identifier)
  }
  private func premiumTab(_ title: String, systemImage: String, identifier: String) -> some View {
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
    .accessibilityIdentifier(identifier)
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
