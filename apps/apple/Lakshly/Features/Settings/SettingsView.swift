import SwiftUI

struct SettingsView: View {
  let store: DataStore
  let lock: AppLock
  @Binding var themeSelection: String
  @Environment(\.theme) private var theme
  @Environment(\.dismiss) private var dismiss
  @AppStorage("settings.premium") private var premium = false
  @AppStorage("settings.appearance") private var appearance = "system"
  @AppStorage("settings.appLock") private var appLock = true
  @State private var reset = false
  @State private var lockedTheme: ThemeID?
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
                if id.definition.premium && !premium { lockedTheme = id }
                else { withAnimation(.easeInOut(duration: 0.25)) { themeSelection = id.rawValue } }
              } label: {
                ThemeCard(palette: ThemePalette(id), selected: ThemeID.resolve(themeSelection) == id,
                          locked: id.definition.premium && !premium)
              }.buttonStyle(.plain)
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
        Section("Your experience") {
          Toggle("Preview Premium (demo — no purchases)", isOn: $premium)
          Text(premium ? "Premium preview · UI only" : "Free · Premium features display a lock")
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
          Text("No network requests, analytics, purchases or accounts. All data is synthetic. Device authentication includes passcode fallback.")
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
        .sheet(item: $lockedTheme) { id in
          PremiumThemePreview {
            premium = true
            withAnimation(.easeInOut(duration: 0.25)) { themeSelection = id.rawValue }
            lockedTheme = nil
          }
        }
    }.preferredColorScheme(colorScheme).frame(minWidth: 320, minHeight: 420)
  }
}

private struct ThemeCard: View {
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

private struct PremiumThemePreview: View {
  let preview: () -> Void
  @Environment(\.theme) private var theme
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    VStack(alignment: .leading, spacing: 24) {
      Text("Lakshly Premium").font(.largeTitle.bold()).foregroundStyle(theme.gold)
      Text("Themes, payoff planner, priority requests").font(.headline)
      Label("Ocean, Forest and Rose Quartz themes", systemImage: "paintpalette")
      Label("Payoff planner preview", systemImage: "chart.line.downtrend.xyaxis")
      Label("Priority community requests", systemImage: "star")
      Button("Preview Premium (demo)", action: preview).buttonStyle(ThemedSubmitStyle())
      Button("Not now") { dismiss() }
    }.padding(32).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .foregroundStyle(theme.text).background { ThemeBackground() }
      .tint(theme.gold).frame(minWidth: 320, minHeight: 420)
  }
}
