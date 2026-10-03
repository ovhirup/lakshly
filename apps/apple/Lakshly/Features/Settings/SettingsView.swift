import SwiftUI

struct SettingsView: View {
  let store: DataStore
  let lock: AppLock
  @Binding var themeSelection: String
  @Environment(\.theme) private var theme
  @Environment(\.dismiss) private var dismiss
  @Environment(EntitlementStore.self) private var entitlements
  @Environment(AppIconController.self) private var appIcons
  @AppStorage("settings.appearance") private var appearance = "system"
  @AppStorage("settings.appLock") private var appLock = true
  @AppStorage(GlancePreferences.showAmountsKey, store: GlanceStore.preferences) private var showAmounts = true
  @AppStorage(GlancePreferences.lockScreenAmountsKey, store: GlanceStore.preferences) private var lockScreenAmounts = false
  #if os(iOS)
  @AppStorage(GlancePreferences.liveActivitiesKey, store: GlanceStore.preferences) private var liveActivities = true
  #endif
  #if os(macOS)
  @AppStorage(GlancePreferences.menuBarExtraKey, store: GlanceStore.preferences) private var menuBarExtra = true
  #endif
  @State private var reset = false
  @State private var deleteMine = false
  @State private var paywall: PaywallContext?
  @State private var pendingIcon: ThemeID?
  @State private var offeredIcon: ThemeID?
  @State private var showIconOffer = false
  private var premium: Bool { entitlements.isPremium }
  private var colorScheme: ColorScheme? {
    switch LaunchOptions.current.appearance ?? appearance { case "light": .light; case "dark": .dark; default: nil }
  }
  var body: some View {
    NavigationStack {
      ScrollViewReader { scroll in
        Form {
          Section("Theme") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
              ForEach(ThemeID.allCases) { id in
                Button {
                  if ThemeAppIcon.isLocked(id, isPremium: premium) {
                    pendingIcon = nil
                    paywall = .theme(id)
                  } else { selectTheme(id) }
                } label: {
                  ThemeCard(palette: ThemePalette(id), selected: ThemeID.resolve(themeSelection) == id,
                            locked: id.definition.premium && !premium)
                }.buttonStyle(.plain)
                  .accessibilityIdentifier("theme.\(id.rawValue)")
                  .accessibilityLabel(id.definition.name + (id.definition.premium && !premium ? ", Premium locked" : ""))
                  .accessibilityValue(ThemeID.resolve(themeSelection) == id ? "Selected" : "")
                  .accessibilityHint(id.definition.description)
              }
            }.padding(.vertical, 8)
          }.listRowBackground(theme.surface)
          appIconSection
            .id("appIcon")
          Section("Appearance") {
            Picker("Appearance", selection: $appearance) {
              Text("System").tag("system")
              Text("Light").tag("light")
              Text("Dark").tag("dark")
            }.pickerStyle(.segmented)
          }.listRowBackground(theme.surface)
          glanceSection
          Section("Lakshly Premium") {
            if premium {
              Text("Premium ✦")
                .font(.headline)
                .accessibilityIdentifier("settings.premiumStatus")
              Text("Thank you for supporting Lakshly")
              if !planLine.isEmpty {
                Text(planLine).foregroundStyle(theme.secondaryText)
                  .accessibilityIdentifier("settings.plan")
              }
            } else {
              Text("Free")
                .font(.headline)
                .accessibilityIdentifier("settings.premiumStatus")
              Text("Lakshly Free · security and import are always free")
                .foregroundStyle(theme.secondaryText)
              Button("See Premium") { paywall = .general }
                .accessibilityIdentifier("settings.seePremium")
                .accessibilityHint("Opens Lakshly Premium")
            }
            Button("Restore Purchases") { Task { await entitlements.restore() } }
              .accessibilityIdentifier("settings.restore")
              .accessibilityHint("Checks this Apple ID for an existing Lakshly Premium subscription")
            if !entitlements.purchaseState.isEmpty {
              Text(entitlements.purchaseState).font(.caption).foregroundStyle(theme.secondaryText)
            }
            if let error = entitlements.lastError {
              Text(error).font(.caption).foregroundStyle(theme.danger)
            }
          }.listRowBackground(theme.surface)
          Section("App lock") {
            Toggle("App lock", isOn: Binding(
              get: { appLock },
              set: { enabled in
                if enabled { appLock = true }
                else {
                  Task { if await lock.authorizeDisablingLock() { appLock = false } }
                }
              }
            )).disabled(lock.authenticating)
            if let message = lock.message { Text(message).font(.caption).foregroundStyle(theme.danger) }
          }.listRowBackground(theme.surface)
          Section("Private by design") {
            Text(store.encryptionStatus)
            Text(
              store.source == .mine
                ? "No network requests except Apple's App Store for purchases. No analytics or accounts. Your imported data is encrypted on this device."
                : "No network requests except Apple's App Store for purchases. No analytics or accounts. All data is synthetic."
            )
            if let error = store.error { Text(error).foregroundStyle(theme.danger) }
          }.listRowBackground(theme.surface)
          Section("Data") {
            Button("Reset demo data", role: .destructive) { reset = true }
            if store.hasUserData {
              Button("Delete my data", role: .destructive) { deleteMine = true }
            }
          }.listRowBackground(theme.surface)
        }.scrollContentBackground(.hidden).background { ThemeBackground() }
          .foregroundStyle(theme.text).tint(theme.gold).navigationTitle("Settings")
          .toolbar { Button("Done") { dismiss() } }
          .confirmationDialog("Reset demo data and local requests? Imported data is kept.", isPresented: $reset) {
            Button("Reset demo data", role: .destructive) { store.reset() }
          }
          .confirmationDialog("Delete all imported data from this device? This cannot be undone.", isPresented: $deleteMine) {
            Button("Delete my data", role: .destructive) { store.deleteMyData() }
          }
          .confirmationDialog("Use the \(offeredIcon?.definition.name ?? "Lakshmi") app icon too?",
                              isPresented: $showIconOffer, titleVisibility: .visible) {
            Button("Switch app icon") {
              if let id = offeredIcon { applyIcon(id) }
              offeredIcon = nil
            }.accessibilityIdentifier("appIcon.offer.switch")
            // Not `.cancel`: iOS 26 hides cancel actions in popover dialogs, and this choice should stay visible.
            Button("Keep current icon") { offeredIcon = nil }
              .accessibilityIdentifier("appIcon.offer.keep")
          }
          .sheet(item: $paywall, onDismiss: {
            pendingIcon = nil
            if offeredIcon != nil { showIconOffer = true }
          }) { context in
            PaywallView(context: context)
          }
          .onChange(of: showAmounts) { _, _ in publishGlance() }
          .onChange(of: lockScreenAmounts) { _, _ in publishGlance() }
          #if os(iOS)
          .onChange(of: liveActivities) { _, _ in LiveActivityManager.shared.sync() }
          #endif
          .onChange(of: entitlements.isPremium) { _, isPremium in
            guard isPremium, case .theme(let id) = paywall else { return }
            if pendingIcon == id {
              applyIcon(id)
            } else {
              selectTheme(id, afterUnlock: true)
            }
            paywall = nil
          }
        #if DEBUG
        .task {
          if LaunchOptions.current.settingsScroll == "appIcon" { scroll.scrollTo("appIcon", anchor: .top) }
        }
        #endif
      }
    }.preferredColorScheme(colorScheme).frame(minWidth: 320, minHeight: 420)
  }
  private var glanceSection: some View {
    Section {
      Toggle("Show amounts in widgets", isOn: $showAmounts)
      Toggle("Show amounts on Lock Screen", isOn: $lockScreenAmounts)
      Text("Lock Screen and Live Activity amounts stay off until you turn this on. Home Screen and desktop widgets follow Show amounts in widgets.")
        .font(.caption).foregroundStyle(theme.secondaryText)
      #if os(iOS)
      Toggle("Live Activities", isOn: $liveActivities)
      #endif
      #if os(macOS)
      Toggle("Show in menu bar", isOn: $menuBarExtra)
      #endif
      glanceKind("Budget pace", feature: .basicWidgets)
      glanceKind("Upcoming bill", feature: .basicWidgets)
      glanceKind("Net worth", feature: .extraWidgets)
      glanceKind("Debt", feature: .extraWidgets)
    } header: {
      Text("Widgets & glance")
    }
    .listRowBackground(theme.surface)
  }

  private func glanceKind(_ title: String, feature: Feature) -> some View {
    HStack {
      Text(title)
      Spacer()
      if feature == .extraWidgets && !premium {
        Pill(text: "✦ Premium", color: theme.gold)
          .accessibilityLabel("\(title), Premium")
      } else {
        Text("Included").font(.caption).foregroundStyle(theme.secondaryText)
      }
    }
  }

  private func publishGlance() {
    GlancePublisher.configure(
      themeID: themeSelection,
      appearance: LaunchOptions.current.appearance ?? appearance,
      tier: entitlements.tier)
    GlancePublisher.publish(dataset: store.dataset)
    #if os(iOS)
    LiveActivityManager.shared.sync()
    #endif
  }

  private func selectTheme(_ id: ThemeID, afterUnlock: Bool = false) {
    guard afterUnlock || ThemeID.resolve(themeSelection) != id else { return }
    withAnimation(.easeInOut(duration: 0.25)) { themeSelection = id.rawValue }
    if appIcons.current != id {
      offeredIcon = id
      if paywall == nil { showIconOffer = true }
    }
  }

  private func applyIcon(_ id: ThemeID) {
    Task {
      await appIcons.updateEntitlements(isPremium: entitlements.isPremium, hasResolved: entitlements.hasResolved)
      await appIcons.apply(id)
    }
  }

  private var appIconSection: some View {
    Section {
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 12)], spacing: 16) {
        ForEach(ThemeID.allCases) { id in
          let locked = ThemeAppIcon.isLocked(id, isPremium: premium)
          Button {
            if locked {
              pendingIcon = id
              paywall = .theme(id)
            } else { applyIcon(id) }
          } label: {
            VStack(spacing: 6) {
              Image(ThemeAppIcon.previewImageName(for: id))
                .resizable().scaledToFit().frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 64 * 0.22, style: .continuous))
                .overlay(alignment: .bottomTrailing) {
                  HStack(spacing: 2) {
                    if locked { iconBadge("lock.fill") }
                    if appIcons.current == id { iconBadge("checkmark.circle.fill") }
                  }
                }
              Text(id.definition.name).font(.caption)
                .foregroundStyle(theme.text)
                .fixedSize(horizontal: false, vertical: true)
            }.frame(maxWidth: .infinity)
          }.buttonStyle(.plain)
            .disabled(appIcons.isApplying || (!appIcons.supportsAlternateIcons && !locked))
            .accessibilityElement(children: .ignore)
            .accessibilityIdentifier("appIcon.\(id.rawValue)")
            .accessibilityLabel(id.definition.name + " app icon" + (locked ? ", Premium locked" : ""))
            .accessibilityValue(appIcons.current == id ? "Selected" : "")
        }
      }.padding(.vertical, 8)
      if let error = appIcons.lastError {
        Text(error).font(.caption).foregroundStyle(theme.danger)
      }
    } header: {
      Text("App icon")
    } footer: {
      #if os(iOS)
      Text("Your Home Screen icon. iOS confirms the change.")
      #else
      Text("Changes the Dock icon while Lakshly runs. The Finder icon stays the default.")
      #endif
    }.listRowBackground(theme.surface)
  }

  private func iconBadge(_ name: String) -> some View {
    Image(systemName: name).font(.caption.weight(.semibold))
      .foregroundStyle(theme.gold).padding(4)
      .background(theme.surface, in: Circle()).accessibilityHidden(true)
  }

  private var planLine: String {
    var parts: [String] = []
    if let name = entitlements.planName { parts.append(name) }
    if let expiration = entitlements.expirationDate {
      let date = expiration.formatted(date: .abbreviated, time: .omitted)
      parts.append(entitlements.willRenew == false ? "Ends \(date)" : "Renews \(date)")
    }
    return parts.joined(separator: " · ")
  }
}

struct ThemeCard: View {
  let palette: ThemePalette
  let selected: Bool
  let locked: Bool
  @Environment(\.colorScheme) private var colorScheme
  var body: some View {
    // Explicit preview colors ensure cards use this sheet's appearance on both platforms.
    let mode = colorScheme == .dark ? palette.definition.dark : palette.definition.light
    VStack(alignment: .leading, spacing: 8) {
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text("₹24,800").font(.headline).foregroundStyle(Color(hex: mode.tokens["gold"]!))
          Spacer(minLength: 2)
          Image(systemName: "sparkle").foregroundStyle(Color(hex: mode.tokens["lotus"]!))
        }
        HStack(spacing: 8) {
          ForEach(["income", "spend", "invest"], id: \.self) { token in
            Circle().fill(Color(hex: mode.tokens[token]!)).frame(width: 10, height: 10)
          }
        }
      }.padding(10).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: mode.tokens["surface"]!), in: RoundedRectangle(cornerRadius: 10))
      HStack(alignment: .top, spacing: 4) {
        Text(palette.definition.name).font(.subheadline.weight(.semibold))
          .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 0)
        if locked { Image(systemName: "lock.fill").accessibilityHidden(true) }
        if selected { Image(systemName: "checkmark.circle.fill").accessibilityHidden(true) }
      }.foregroundStyle(Color(hex: mode.tokens["text"]!))
    }.padding(10).frame(maxWidth: .infinity, alignment: .leading)
      .background(Color(hex: mode.tokens["bg"]!), in: RoundedRectangle(cornerRadius: 16))
      .overlay {
        RoundedRectangle(cornerRadius: 16).strokeBorder(
          Color(hex: mode.tokens[selected ? "gold" : "secondaryText"]!), lineWidth: selected ? 2 : 0.5)
      }.accessibilityElement(children: .ignore)
  }
}


