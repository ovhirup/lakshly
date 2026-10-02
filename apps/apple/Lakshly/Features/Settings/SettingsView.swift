import SwiftUI

struct SettingsView: View {
  let store: DataStore
  let lock: AppLock
  @Binding var themeSelection: String
  @Environment(\.theme) private var theme
  @Environment(\.dismiss) private var dismiss
  @Environment(EntitlementStore.self) private var entitlements
  @AppStorage("settings.appearance") private var appearance = "system"
  @AppStorage("settings.appLock") private var appLock = true
  @State private var reset = false
  @State private var paywall: PaywallContext?
  private var premium: Bool { entitlements.isPremium }
  private var colorScheme: ColorScheme? {
    switch LaunchOptions.current.appearance ?? appearance { case "light": .light; case "dark": .dark; default: nil }
  }
  var body: some View {
    NavigationStack {
      Form {
        Section("Theme") {
          LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
            ForEach(ThemeID.allCases) { id in
              Button {
                if id.definition.premium && !premium { paywall = .theme(id) }
                else { withAnimation(.easeInOut(duration: 0.25)) { themeSelection = id.rawValue } }
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
        Section("Appearance") {
          Picker("Appearance", selection: $appearance) {
            Text("System").tag("system")
            Text("Light").tag("light")
            Text("Dark").tag("dark")
          }.pickerStyle(.segmented)
        }.listRowBackground(theme.surface)
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
          Text("No network requests except Apple's App Store for purchases. No analytics or accounts. All data is synthetic.")
          if let error = store.error { Text(error).foregroundStyle(theme.danger) }
        }.listRowBackground(theme.surface)
        Section { Button("Reset demo data", role: .destructive) { reset = true } }
          .listRowBackground(theme.surface)
      }.scrollContentBackground(.hidden).background { ThemeBackground() }
        .foregroundStyle(theme.text).tint(theme.gold).navigationTitle("Settings")
        .toolbar { Button("Done") { dismiss() } }
        .confirmationDialog("Reset data and local requests?", isPresented: $reset) {
          Button("Reset demo data", role: .destructive) { store.reset() }
        }
        .sheet(item: $paywall) { context in
          PaywallView(context: context)
        }
        .onChange(of: entitlements.isPremium) { _, isPremium in
          guard isPremium, case .theme(let id) = paywall else { return }
          withAnimation(.easeInOut(duration: 0.25)) { themeSelection = id.rawValue }
        }
    }.preferredColorScheme(colorScheme).frame(minWidth: 320, minHeight: 420)
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


