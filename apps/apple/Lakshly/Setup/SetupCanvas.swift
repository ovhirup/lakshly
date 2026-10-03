import SwiftUI
import UniformTypeIdentifiers

struct SetupRing: View {
  @Environment(\.theme) private var theme
  var percent: Int
  var line: CGFloat = 6
  var body: some View {
    ZStack {
      Circle().stroke(theme.secondaryText.opacity(0.25), lineWidth: line)
      Circle()
        .trim(from: 0, to: CGFloat(min(max(percent, 0), 100)) / 100)
        .stroke(theme.gold, style: StrokeStyle(lineWidth: line, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text("\(percent)%").font(.caption.weight(.bold)).minimumScaleFactor(0.6)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Setup progress")
    .accessibilityValue("\(percent) percent")
  }
}

struct SetupGhostStyle: ButtonStyle {
  @Environment(\.theme) private var theme
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.subheadline.weight(.semibold))
      .foregroundStyle(theme.text)
      .padding(.horizontal, 14)
      .frame(minHeight: 44)
      .background(theme.surface.opacity(configuration.isPressed ? 0.55 : 0.92), in: Capsule())
  }
}

struct SetupSnapshot: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  var model: SetupCanvasModel
  var actions: SetupActions = SetupActions()

  var body: some View {
    ZStack(alignment: .bottom) {
      ThemeBackground()
      if model.platform == .macos {
        HStack(spacing: 0) {
          SetupRail(model: model, actions: actions).frame(width: 220)
          Divider()
          SetupPage(model: model, actions: actions, step: model.step, showsBars: true)
        }
      } else {
        SetupPage(model: model, actions: actions, step: model.step, showsBars: true)
      }
      if model.showConsent { SetupConsentCard(model: model, actions: actions) }
      if model.celebrate && !reduceMotion { SetupConfetti() }
      if let toast = model.toast {
        Text(toast)
          .font(.subheadline.weight(.semibold))
          .padding(.horizontal, 16)
          .frame(minHeight: 44)
          .modifier(GlassCard())
          .padding(.bottom, 24)
          .accessibilityAddTraits(.updatesFrequently)
      }
    }
    .environment(\.setupRendering, model.rendering)
  }
}

struct SetupRail: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Setup steps").font(.caption.weight(.semibold)).foregroundStyle(theme.secondaryText)
        .accessibilityAddTraits(.isHeader)
      ForEach(Array(stepOrder.enumerated()), id: \.element) { index, step in
        let done = model.state.stepsDone.contains(step)
        let skipped = model.state.stepsSkipped.contains(step)
        Button { actions.go(step) } label: {
          HStack(spacing: 10) {
            Text(done ? "✓" : skipped ? "−" : "\(index + 1)")
              .frame(width: 28, height: 28)
              .background(model.step == step ? theme.gold.opacity(0.18) : theme.surface, in: Circle())
            Text(setupRailTitle(step)).font(.subheadline.weight(model.step == step ? .semibold : .regular))
            Spacer(minLength: 0)
          }
          .frame(minHeight: 44)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(model.step == step ? .isSelected : [])
      }
      Spacer(minLength: 0)
      Text("On your device. At your pace.").font(.caption).foregroundStyle(theme.secondaryText)
    }
    .padding(16)
    .frame(maxHeight: .infinity, alignment: .top)
    .background(theme.surface.opacity(0.35))
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Setup steps")
  }
}

struct SetupPage: View {
  var model: SetupCanvasModel
  var actions: SetupActions
  var step: SetupStep
  var showsBars: Bool

  var body: some View {
    VStack(spacing: 0) {
      if showsBars { SetupTopBar(model: model, actions: actions) }
      // ImageRenderer leaves ScrollView empty, so shots draw the step in a clipped stack.
      if model.rendering {
        stepColumn.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top).clipped()
      } else {
        ScrollView { stepColumn }
      }
      if showsBars { SetupBottomBar(model: model, actions: actions) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }

  private var stepColumn: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Step \(setupStepIndex(step)) of 6, \(setupVisibleTitle(step, health: model.health && step == .done))")
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(setupVisibleTitle(step, health: model.health && step == .done))
        .font(.system(.largeTitle, design: .rounded, weight: .bold))
        .accessibilityAddTraits(.isHeader)
      if step == .welcome {
        Text("Your own data, a first budget and a first goal. About five minutes, at your pace.")
          .foregroundStyle(.secondary)
      }
      stepBody
    }
    .padding(20)
    .frame(maxWidth: 720, alignment: .leading)
  }

  @ViewBuilder private var stepBody: some View {
    switch step {
    case .welcome: SetupWelcomeStep(model: model, actions: actions)
    case .email: SetupEmailStep(model: model, actions: actions)
    case .accounts: SetupAccountsStep(model: model, actions: actions)
    case .importStep: SetupImportStep(model: model, actions: actions)
    case .plan: SetupPlanStep(model: model, actions: actions)
    case .done: SetupDoneStep(model: model, actions: actions)
    }
  }
}

struct SetupTopBar: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions

  var body: some View {
    HStack(spacing: 8) {
      Pill(text: "Included in Free", color: theme.gold)
      Spacer(minLength: 8)
      Button(model.hideAmounts ? "Show amounts" : "Hide amounts", action: actions.togglePrivacy)
        .buttonStyle(SetupGhostStyle())
      Button("Finish later", action: actions.finishLater).buttonStyle(SetupGhostStyle())
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 8)
  }
}

struct SetupBottomBar: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions

  var body: some View {
    HStack(spacing: 8) {
      Button("Back", action: actions.back)
        .buttonStyle(SetupGhostStyle())
        .disabled(model.step == .welcome)
      Button("Skip", action: actions.skip).buttonStyle(SetupGhostStyle())
      Spacer(minLength: 8)
      Button(model.step == .done ? "Go to Overview" : "Continue", action: actions.next)
        .buttonStyle(ThemedSubmitStyle())
        .disabled(model.continueDisabled)
    }
    .padding(16)
    .background(theme.surface.opacity(0.92))
  }
}

/// ImageRenderer cannot paint `TextField` or `Picker`, so shots draw the value as text.
struct SetupEntry: View {
  var prompt: String
  @Binding var text: String
  var rendering: Bool
  var email = false

  var body: some View {
    if rendering {
      Text(text.isEmpty ? prompt : text)
        .foregroundStyle(text.isEmpty ? .secondary : .primary)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, 12)
        .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityLabel(prompt)
    } else {
      TextField(prompt, text: $text)
        .textFieldStyle(ThemedFieldStyle())
        .modifier(SetupEmailInput(enabled: email))
    }
  }
}

private struct SetupEmailInput: ViewModifier {
  var enabled: Bool
  func body(content: Content) -> some View {
    if enabled {
      content
        .autocorrectionDisabled()
        #if os(iOS)
        .textInputAutocapitalization(.never)
        .keyboardType(.emailAddress)
        #endif
    } else {
      content
    }
  }
}

struct SetupWelcomeStep: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions
  @State private var name: String
  @State private var currency: String

  init(model: SetupCanvasModel, actions: SetupActions) {
    self.model = model
    self.actions = actions
    _name = State(initialValue: model.state.profile.name)
    _currency = State(initialValue: model.state.profile.currency)
  }

  var body: some View {
    Card(title: "About you") {
      Text("What should we call you?").font(.subheadline.weight(.semibold))
      Text("Optional · on this device only").font(.caption).foregroundStyle(theme.secondaryText)
      SetupEntry(prompt: "Your name", text: $name, rendering: model.rendering)
        .onChange(of: name) { _, value in actions.setProfile(value, currency) }
      Text("Currency").font(.subheadline.weight(.semibold))
      SetupEntry(prompt: "INR", text: $currency, rendering: model.rendering)
        .onChange(of: currency) { _, value in
          let code = String(value.uppercased().prefix(3))
          if code != currency { currency = code }
          if code.count == 3 { actions.setProfile(name, code) }
        }
        .accessibilityLabel("Currency, search ISO codes")
      if model.state.profile.currency != "INR" {
        Text("Statement importers are built for Indian banks today; you can still add data by CSV.")
          .font(.subheadline).foregroundStyle(theme.secondaryText)
      }
      Text("Make it yours").font(.system(.title3, design: .rounded, weight: .bold)).accessibilityAddTraits(.isHeader)
      HStack(spacing: 8) {
        ForEach(ThemeID.allCases.filter { !$0.definition.premium }) { id in
          let palette = ThemePalette(id, scheme: nil)
          Button {
            actions.selectTheme(id.rawValue)
          } label: {
            VStack(spacing: 6) {
              Text("🪷").frame(width: 44, height: 44).background(palette.bg, in: Circle())
              Text(id.definition.name).font(.caption).lineLimit(1)
            }
            .frame(minWidth: 88, minHeight: 44)
            .padding(6)
            .background(model.themeID == id.rawValue ? theme.gold.opacity(0.16) : Color.clear, in: RoundedRectangle(cornerRadius: 16))
          }
          .buttonStyle(.plain)
          .accessibilityLabel(id.definition.name)
          .accessibilityAddTraits(model.themeID == id.rawValue ? .isSelected : [])
        }
      }
    }
    Card(title: "Private by design") {
      Text("Your money data stays on this device. No bank logins. If you connect your email, Lakshly reads only finance emails, read-only, on this device. No Lakshly servers ever see your data.")
      Text("Statements are read here and stored encrypted (Keychain/Secure Enclave key).")
      Text("We never store statement passwords.")
      DisclosureGroup("Privacy notice") {
        Text("Files are parsed on this device. Parsed data is encrypted on this device until you delete it from Import. Search links open your mail provider outside Lakshly. Automatic sync is not switched on in this build.")
          .font(.subheadline).foregroundStyle(theme.secondaryText)
      }
    }
    HStack(spacing: 8) {
      Button("Set up with my data") { actions.next() }.buttonStyle(ThemedSubmitStyle())
      Button("Explore with demo data") { actions.chooseMode(.demo) }.buttonStyle(SetupGhostStyle())
    }
  }
}

struct SetupEmailStep: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions
  @State private var email: String
  @State private var provider: MailProvider
  @State private var extra: String

  init(model: SetupCanvasModel, actions: SetupActions) {
    self.model = model
    self.actions = actions
    let initial = model.state.email.primary
    _email = State(initialValue: initial)
    _provider = State(initialValue: model.state.email.pickerProvider ?? detectMailProvider(initial))
    _extra = State(initialValue: "")
  }

  private var valid: Bool { setupEmailValid(email) }
  private var total: Int {
    (model.state.email.primary.isEmpty ? 0 : 1) + (model.state.email.extra?.count ?? 0)
  }

  var body: some View {
    Card(title: "Mailbox") {
      Text("Which email do your bank alerts, statements and receipts go to?")
        .font(.subheadline.weight(.semibold))
      SetupEntry(prompt: "demo.user@example.com", text: $email, rendering: model.rendering, email: true)
        .onChange(of: email) { _, value in
          provider = detectMailProvider(value)
          actions.setEmail(value, provider)
        }
      if !valid {
        Text("Enter a complete email address, like demo.user@example.com.")
          .font(.caption).foregroundStyle(theme.danger).accessibilityAddTraits(.isStaticText)
      }
      Text("Stored only on this device, encrypted.").font(.caption).foregroundStyle(theme.secondaryText)
      if model.rendering {
        Text("Provider: \(setupProviders.first { $0.0 == provider }?.1 ?? "Other")")
          .frame(minHeight: 44, alignment: .leading)
      } else {
        Picker("Provider", selection: $provider) {
          ForEach(setupProviders, id: \.0) { item in Text(item.1).tag(item.0) }
        }
        .onChange(of: provider) { _, value in actions.setEmail(email, value) }
      }
      if model.state.mode == .demo {
        Button("Use your own data first") { actions.chooseMode(.mine) }.buttonStyle(ThemedSubmitStyle())
      } else if provider == .google || provider == .microsoft {
        Button(provider == .google ? "Connect Gmail (read-only)" : "Connect Outlook (read-only)") {
          actions.connect(email, provider)
        }
        .buttonStyle(ThemedSubmitStyle())
        .disabled(email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !valid)
        if provider == .google {
          Button("Use an app password instead") { actions.connect(email, provider) }.buttonStyle(SetupGhostStyle())
        }
      } else {
        Button("Connect with an app password") { actions.connect(email, provider) }
          .buttonStyle(ThemedSubmitStyle())
          .disabled(email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !valid)
      }
      if model.betaNotice {
        Text("Automatic sync is in a closed beta and isn't switched on in this build yet. Your email is saved on this device for one-tap searches below.")
          .font(.subheadline)
          .accessibilityAddTraits(.updatesFrequently)
      }
      Button("I'd rather import by hand") { actions.importByHand(email, provider) }.buttonStyle(SetupGhostStyle())
      ForEach(model.state.email.extra ?? [], id: \.self) { address in
        HStack {
          Text(address).lineLimit(1)
          Spacer()
          Button("Remove") { actions.removeEmail(address) }
            .buttonStyle(SetupGhostStyle())
            .accessibilityLabel("Remove saved address \(address)")
        }
      }
      if total < model.emailLimit {
        SetupEntry(prompt: "Another address for manual searches", text: $extra, rendering: model.rendering, email: true)
        Button("Save another address") {
          actions.addEmail(extra)
          extra = ""
        }
        .buttonStyle(SetupGhostStyle())
        .disabled(!isSetupEmail(extra.trimmingCharacters(in: .whitespacesAndNewlines)))
      }
      Text("Up to \(model.emailLimit) addresses for one-tap manual searches.")
        .font(.caption).foregroundStyle(theme.secondaryText)
      Button("Skip: I don't use email for this") { actions.skipEmail() }.buttonStyle(SetupGhostStyle())
    }
    Card(title: "Prefer not to connect? Find the emails yourself") {
      if model.state.sources.isEmpty {
        Text("Here are a few common searches. Pick your accounts next to tailor this guide.")
          .foregroundStyle(theme.secondaryText)
      }
      ForEach(manualSources, id: \.id) { source in
        DisclosureGroup(source.name) {
          SetupSearchGuide(source: source, model: model, actions: actions, picked: false)
        }
      }
    }
  }

  private var manualSources: [CatalogSource] {
    if model.state.sources.isEmpty {
      return setupManualFallbackIDs.compactMap { id in SetupSources.catalog.sources.first { $0.id == id } }
    }
    return model.state.sources.map { sourceFor($0) }
  }
}

struct SetupAccountsStep: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions
  @State private var query = ""
  @State private var showCustom = false
  @State private var customName = ""
  @State private var customDomain = ""

  var body: some View {
    let catalog = SetupSources.catalog
    VStack(alignment: .leading, spacing: 12) {
      if model.rendering {
        SetupEntry(prompt: "Search names and aliases", text: $query, rendering: true)
        suggestion
        ForEach(catalog.kindOrder, id: \.self) { kind in
          let rows = rows(kind, catalog: catalog)
          if !rows.isEmpty {
            Text(catalog.kinds[kind] ?? kind).font(.headline).accessibilityAddTraits(.isHeader)
            ForEach(rows, id: \.id) { source in sourceButton(source) }
          }
        }
      } else {
        suggestion
        List {
          ForEach(catalog.kindOrder, id: \.self) { kind in
            let rows = rows(kind, catalog: catalog)
            if !rows.isEmpty {
              Section(catalog.kinds[kind] ?? kind) {
                ForEach(rows, id: \.id) { source in sourceButton(source) }
              }
            }
          }
        }
        .frame(minHeight: 360)
        .searchable(text: $query, prompt: "Search names and aliases")
      }
      ForEach(model.state.sources.filter { $0.custom != nil }, id: \.catalogId) { source in
        Button("✓ \(source.custom?.name ?? source.catalogId) · remove") { actions.toggleSource(source.catalogId) }
          .buttonStyle(SetupGhostStyle())
      }
      Button("+ Something else") { showCustom.toggle() }.buttonStyle(SetupGhostStyle())
      if showCustom {
        Card(title: "Something else") {
          SetupEntry(prompt: "Institution name", text: $customName, rendering: model.rendering)
          SetupEntry(prompt: "Sender domain (optional)", text: $customDomain, rendering: model.rendering)
          Button("Add source") {
            actions.addCustom(customName.trimmingCharacters(in: .whitespacesAndNewlines), customDomain)
            showCustom = false
            customName = ""
            customDomain = ""
          }
          .buttonStyle(ThemedSubmitStyle())
          .disabled(!customValid)
        }
      }
    }
  }

  private var suggestion: some View {
    let names = model.state.sources.filter { sourceFor($0).kinds.contains("investment") }.map { sourceFor($0).name }
    let hasCAS = model.state.sources.contains { sourceFor($0).kinds.contains("cas") }
    return Group {
      if !names.isEmpty && !hasCAS {
        Card(title: "Consolidated statement") {
          Text("Your \(names.joined(separator: " and ")) funds are in your CAS: add it?")
          Button("Add a CAMS / KFintech CAS") { actions.toggleSource("cams-cas") }.buttonStyle(SetupGhostStyle())
        }
      }
    }
  }

  private var customValid: Bool {
    let name = customName.trimmingCharacters(in: .whitespacesAndNewlines)
    let domain = customDomain.trimmingCharacters(in: .whitespacesAndNewlines)
    if name.isEmpty { return false }
    if domain.isEmpty { return true }
    return domain.range(of: #"^[a-z0-9.-]+\.[a-z]{2,}$"#, options: [.regularExpression, .caseInsensitive]) != nil
  }

  private func rows(_ kind: String, catalog: SourcesCatalog) -> [CatalogSource] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return catalog.sources.filter { source in
      guard source.kinds.contains(kind) else { return false }
      if needle.isEmpty { return true }
      let hay = ([source.name] + source.aliases).joined(separator: " ").lowercased()
      return hay.contains(needle)
    }
  }

  private func sourceButton(_ source: CatalogSource) -> some View {
    let selected = model.state.sources.contains { $0.catalogId == source.id }
    return Button { actions.toggleSource(source.id) } label: {
      HStack(spacing: 10) {
        Image(systemName: selected ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(selected ? theme.gold : theme.secondaryText)
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 2) {
          Text(source.name)
          if !source.importer.supported {
            Text("add manually").font(.caption).foregroundStyle(theme.secondaryText)
          }
        }
        Spacer(minLength: 0)
      }
      .frame(minHeight: 44)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(source.name)
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}

struct SetupImportStep: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions

  var body: some View {
    Text(model.platform == .macos
      ? "Drop a PDF or CSV here, or choose a file. Parsed on this device. Nothing is uploaded."
      : "Choose a PDF or CSV. Parsed on this device. Nothing is uploaded.")
      .foregroundStyle(theme.secondaryText)
    if model.state.sources.isEmpty {
      Card(title: "Accounts") {
        Text("Pick your accounts for tailored download steps and password hints, or import a file below.")
        Button("Pick accounts") { actions.go(.accounts) }.buttonStyle(SetupGhostStyle())
      }
    }
    ForEach(model.state.sources, id: \.catalogId) { picked in
      sourceCard(picked)
    }
    if let pending = model.pending {
      Card(title: "Which account is this?") {
        Text("\(pending.file) · \(pending.adapter). Pick a source to remember it for this account.")
          .foregroundStyle(theme.secondaryText)
        if pending.candidates.isEmpty {
          Button("Pick a source first") { actions.go(.accounts) }.buttonStyle(SetupGhostStyle())
        }
        ForEach(pending.candidates, id: \.self) { id in
          Button(sourceFor(id: id, custom: model.state.sources.first { $0.catalogId == id }?.custom).name) {
            actions.attributeTo(id)
          }
          .buttonStyle(SetupGhostStyle())
        }
      }
    }
    Button("Import a statement") { actions.chooseImportFile() }.buttonStyle(ThemedSubmitStyle())
    if model.showsFolderWatch {
      HStack {
        Text("Watch a folder")
        Spacer()
        Pill(text: "✦ Premium", color: theme.gold)
      }
      .frame(minHeight: 44)
      .accessibilityElement(children: .combine)
      .accessibilityLabel("Watch a folder, Premium")
    }
  }

  private func sourceCard(_ picked: SetupSource) -> some View {
    let source = sourceFor(picked)
    let added = (model.state.imports ?? []).filter { picked.importIds?.contains($0.id) == true }.reduce(0) { $0 + $1.added }
    return Card(title: source.name) {
      HStack {
        Text(setupStatusLabel(picked.status)).font(.caption.weight(.semibold))
        Spacer()
      }
      .accessibilityLabel("\(source.name), \(setupStatusLabel(picked.status))")
      if let last = picked.lastDataDate, !last.isEmpty {
        Text("Up to \(setupFormatDate(last)) · \(added) transactions")
          .font(.caption).foregroundStyle(theme.secondaryText)
      }
      if let reason = picked.skipReason, !reason.isEmpty {
        Text(reason).font(.caption).foregroundStyle(theme.secondaryText)
      }
      DisclosureGroup("How to get it") {
        SetupSourceGuide(source: source, model: model, actions: actions, catalogId: picked.catalogId)
      }
      if model.rendering {
        Text("Skip this source…").font(.caption).foregroundStyle(theme.secondaryText).frame(minHeight: 44, alignment: .leading)
      } else {
        Picker("Skip reason", selection: skipBinding(picked)) {
          Text("Skip this source…").tag("")
          ForEach(setupSkipReasons, id: \.0) { reason in Text(reason.1).tag(reason.0) }
        }
      }
      if picked.status == .skipped {
        Button("Try again") { actions.setStatus(picked.catalogId, .todo, nil) }.buttonStyle(SetupGhostStyle())
      }
    }
    .setupFileDrop(enabled: model.showsFolderWatch || model.platform == .macos) { data, name in
      actions.dropFile(picked.catalogId, data, name)
    }
  }

  private func skipBinding(_ picked: SetupSource) -> Binding<String> {
    Binding(
      get: { picked.status == .skipped ? (picked.skipReason ?? "not-now-ok") : "" },
      set: { value in
        if value.isEmpty { return }
        actions.setStatus(picked.catalogId, .skipped, value)
      })
  }
}

struct SetupSearchGuide: View {
  var source: CatalogSource
  var model: SetupCanvasModel
  var actions: SetupActions
  var picked: Bool
  var catalogId: String?

  var body: some View {
    let addresses = [model.state.email.primary] + (model.state.email.extra ?? []).filter { !$0.isEmpty }
    let targets = addresses.isEmpty ? [""] : addresses
    VStack(alignment: .leading, spacing: 10) {
      ForEach(source.searches, id: \.id) { search in
        Text(search.label).font(.subheadline.weight(.semibold))
        ForEach(targets, id: \.self) { email in
          if targets.count > 1 && !email.isEmpty {
            Text(email).font(.caption).foregroundStyle(.secondary)
          }
          HStack(spacing: 8) {
            Button("Search Gmail") {
              let query = gmailQuery(source, search)
              if let url = URL(string: gmailUrl(email, query)) { actions.openLink(url) }
              mark()
            }
            .buttonStyle(SetupGhostStyle())
            .accessibilityLabel("Search Gmail for \(source.name) \(search.label.lowercased()), opens your browser")
            Button("Search Outlook") {
              actions.copySearch(outlookQuery(source, search), true)
              if let url = URL(string: outlookOpenUrl(email)) { actions.openLink(url) }
              mark()
            }
            .buttonStyle(SetupGhostStyle())
            .accessibilityLabel("Copy search for \(source.name) \(search.label.lowercased()) and open Outlook inbox")
            Button("Copy search") {
              let query = model.state.email.provider == .gmail
                ? gmailQuery(source, search)
                : model.state.email.provider == .outlook ? outlookQuery(source, search) : plainSearch(source, search)
              actions.copySearch(query, false)
              mark()
            }
            .buttonStyle(SetupGhostStyle())
            .accessibilityLabel("Copy search for \(source.name) \(search.label.lowercased())")
          }
          DisclosureGroup("Exact search") {
            Text(exact(search)).font(.caption.monospaced()).textSelection(.enabled)
          }
        }
      }
    }
  }

  private func exact(_ search: CatalogSearch) -> String {
    switch model.state.email.provider {
    case .outlook: outlookQuery(source, search)
    case .other: plainSearch(source, search)
    case .gmail: gmailQuery(source, search)
    }
  }

  private func mark() {
    if let catalogId { actions.search(catalogId) }
  }
}

struct SetupSourceGuide: View {
  @Environment(\.theme) private var theme
  var source: CatalogSource
  var model: SetupCanvasModel
  var actions: SetupActions
  var catalogId: String

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      SetupSearchGuide(source: source, model: model, actions: actions, picked: true, catalogId: catalogId)
      if let download = source.download, !download.isEmpty { Text(download) }
      if let note = source.importer.note, !note.isEmpty {
        Text(note).foregroundStyle(theme.secondaryText)
      }
      if source.kinds.contains("subscription") {
        Text("Your charges already come in through your bank/card statement. Receipt import is coming.")
          .foregroundStyle(theme.secondaryText)
      }
      let hints = source.passwordHints.compactMap { SetupSources.catalog.passwordHintFormats[$0] }
      if !hints.isEmpty {
        Text("Statements from \(source.name) are usually protected with one of:")
        ForEach(hints, id: \.self) { hint in Text("• \(hint)") }
        Text("The email that carried the statement says which. Lakshly asks for it once, on this device, and never saves it.")
      }
      DisclosureGroup("Export guides") {
        Text("Download the PDF attachment for this build. Email files (.eml and .mbox) are not supported yet.")
          .foregroundStyle(theme.secondaryText)
        guideBlock("Gmail", SetupSources.catalog.guides.gmail)
        guideBlock("Outlook", SetupSources.catalog.guides.outlook)
        guideBlock("Apple Mail", SetupSources.catalog.guides.appleMail)
      }
    }
  }

  private func guideBlock(_ title: String, _ lines: [String: String]) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title).font(.subheadline.weight(.semibold))
      ForEach(lines.keys.sorted(), id: \.self) { key in Text(lines[key] ?? "") }
    }
  }
}

struct SetupPlanStep: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions
  @State private var factor = 95
  @State private var edits: [String: Int64] = [:]
  @State private var starter: [String] = ["groceries", "dining", "transport"]
  @State private var editGoal = false
  @State private var goalName = ""
  @State private var goalTarget = ""
  @State private var goalSaved = ""
  @State private var goalMonthly = ""
  @State private var goalDue = ""
  @State private var seededGoal = false

  private var suggestion: BudgetSuggestion { suggestBudget(model.dataset, today: model.today, factorPct: factor) }
  private var goalSuggestion: GoalSuggestion { suggestGoal(model.dataset, today: model.today) }
  private var starterMode: Bool { suggestion.mode == "starter" || suggestion.lines.isEmpty }
  private var month: String { String(model.today.prefix(7)) }

  var body: some View {
    if model.budgetCurrency != model.state.profile.currency {
      Text("Amounts stay in INR because the imported accounts are not all in \(model.state.profile.currency). There is no currency conversion.")
        .foregroundStyle(theme.secondaryText)
    }
    Card(title: "First budget") {
      Text(starterMode
        ? "No complete month yet. Pick categories and type a calm starting limit, or come back after your next statement."
        : "Based on \(suggestion.months.map { setupFormatMonth($0, short: true) }.joined(separator: "–")), here's a calm starting budget for \(setupFormatMonth(month, short: true)).")
        .foregroundStyle(theme.secondaryText)
      if suggestion.mode == "history" && suggestion.confidence == "low" {
        Text("Based on one month; we'll refine it.").font(.caption).foregroundStyle(theme.secondaryText)
      }
      if starterMode {
        chipRow(variableCategories, selected: { starter.contains($0) }, label: setupTitleCase) { category in
          if starter.contains(category) { starter.removeAll { $0 == category } }
          else if starter.count < 6 { starter.append(category) }
        }
      } else {
        HStack(spacing: 8) {
          factorChip(100, "Gentle")
          factorChip(95, "Balanced")
          factorChip(90, "Stretch")
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Budget ambition")
      }
      ForEach(lines, id: \.category) { line in budgetRow(line) }
      HStack {
        Text("Total").font(.headline)
        Spacer()
        Text(setupMask(Money.format(lines.reduce(Int64(0)) { $0 + $1.limit }), hidden: model.hideAmounts))
          .font(.headline)
      }
      if budgetSaved {
        Text("✓ Budget saved for \(setupFormatMonth(month))").foregroundStyle(theme.income)
      }
      HStack(spacing: 8) {
        Button(budgetSaved ? "Update budget" : "Save budget") { actions.saveBudget(lines, factor) }
          .buttonStyle(ThemedSubmitStyle())
          .disabled(lines.isEmpty || lines.allSatisfy { $0.limit == 0 })
        if starterMode {
          Button("Remind me after my next statement") {
            actions.toast("Come back after your next statement. Your setup card will be waiting on Overview.")
          }
          .buttonStyle(SetupGhostStyle())
        }
      }
    }
    Card(title: "One Laksh goal") {
      if let existing = model.goals.first {
        Text("✓ \(existing.name)").foregroundStyle(theme.income)
        Text("\(shown(existing.saved)) saved towards \(shown(existing.target)). Your first goal is already set.")
          .foregroundStyle(theme.secondaryText)
      } else {
        goalCard
      }
    }
    .onAppear(perform: seedGoal)
  }

  private var lines: [BudgetLine] {
    let base: [BudgetLine] = starterMode
      ? starter.map {
        BudgetLine(id: "bud_\(month.replacingOccurrences(of: "-", with: ""))\($0)", month: month, category: $0, limit: 0, rollover: false)
      }
      : suggestion.lines.map {
        BudgetLine(id: $0.id, month: $0.month, category: $0.category, limit: $0.limit, rollover: $0.rollover)
      }
    return base.map { line in
      var copy = line
      if let edited = edits[line.category] { copy.limit = edited }
      return copy
    }
  }

  private var budgetSaved: Bool {
    model.budgets.contains { $0.month == month } || (model.state.budgetMonths?.contains(month) ?? false)
  }

  private func factorChip(_ value: Int, _ label: String) -> some View {
    Button("\(label) \(value)%") {
      factor = value
      edits = [:]
    }
    .buttonStyle(SetupGhostStyle())
    .accessibilityAddTraits(factor == value ? .isSelected : [])
  }

  private func chipRow(
    _ values: [String], selected: @escaping (String) -> Bool, label: @escaping (String) -> String,
    tap: @escaping (String) -> Void
  ) -> some View {
    FlexibleChips(values: values, selected: selected, label: label, tap: tap)
  }

  private func budgetRow(_ line: BudgetLine) -> some View {
    let median = suggestion.lines.first { $0.category == line.category }?.median
    return VStack(alignment: .leading, spacing: 6) {
      Text(setupTitleCase(line.category)).font(.headline)
      if let median, !starterMode {
        Text("You usually spend \(shown(median))").font(.caption).foregroundStyle(theme.secondaryText)
      }
      HStack(spacing: 6) {
        stepper("−₹100", delta: -10_000, line: line, words: "Reduce \(line.category) by ₹100")
        stepper("−₹500", delta: -50_000, line: line, words: "Reduce \(line.category) by ₹500")
        Text(model.hideAmounts ? "••••" : rupeeField(line.limit))
          .frame(minWidth: 72, minHeight: 44)
          .accessibilityLabel("\(setupTitleCase(line.category)) budget limit")
        stepper("+₹100", delta: 10_000, line: line, words: "Increase \(line.category) by ₹100")
        stepper("+₹500", delta: 50_000, line: line, words: "Increase \(line.category) by ₹500")
      }
    }
  }

  private func stepper(_ title: String, delta: Int64, line: BudgetLine, words: String) -> some View {
    Button(title) { edits[line.category] = max(0, line.limit + delta) }
      .buttonStyle(SetupGhostStyle())
      .accessibilityLabel(words)
  }

  private func rupeeField(_ paise: Int64) -> String {
    let rupees = Double(paise) / 100
    if rupees == rupees.rounded() { return String(Int(rupees)) }
    return String(format: "%.2f", rupees)
  }

  private var goalCard: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(goalName.isEmpty ? goalSuggestion.name : goalName).font(.headline)
      if let covered = goalSuggestion.monthsCovered {
        Text("You have about \(covered) months of spending in cash.").foregroundStyle(theme.secondaryText)
      }
      if goalSuggestion.rule == "annualPayment" {
        Text("This payment looks yearly. Put aside \(shown(goalMonthlyPaise))/month to have \(shown(goalTargetPaise)) by \(setupFormatDate(goalDue)).")
          .foregroundStyle(theme.secondaryText)
      } else if goalSuggestion.kind == .emergency {
        Text("A little breathing room: \(shown(goalSavedPaise)) already saved towards \(shown(goalTargetPaise)), with \(shown(goalMonthlyPaise))/month until \(setupFormatDate(goalDue)).")
          .foregroundStyle(theme.secondaryText)
      } else if goalSuggestion.kind == .custom {
        Text("Choose something that matters to you, and give it a target.").foregroundStyle(theme.secondaryText)
      }
      if editGoal || goalSuggestion.kind == .custom {
        SetupEntry(prompt: "Goal name", text: $goalName, rendering: model.rendering)
        SetupEntry(prompt: "Target (\(model.budgetCurrency))", text: $goalTarget, rendering: model.rendering)
          .disabled(model.hideAmounts)
        SetupEntry(prompt: "Saved (\(model.budgetCurrency))", text: $goalSaved, rendering: model.rendering)
          .disabled(model.hideAmounts)
        SetupEntry(prompt: "Monthly (\(model.budgetCurrency))", text: $goalMonthly, rendering: model.rendering)
          .disabled(model.hideAmounts)
        SetupEntry(prompt: "Due date", text: $goalDue, rendering: model.rendering)
      }
      HStack(spacing: 8) {
        Button("Create goal") { actions.saveGoal(builtGoal) }
          .buttonStyle(ThemedSubmitStyle())
          .disabled(goalTargetPaise <= 0 || goalName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || goalDue.isEmpty)
        Button(editGoal ? "Done editing" : "Edit") { editGoal.toggle() }.buttonStyle(SetupGhostStyle())
        Button("Skip goal") { actions.skipGoal() }.buttonStyle(SetupGhostStyle())
      }
    }
  }

  private func seedGoal() {
    guard !seededGoal else { return }
    seededGoal = true
    goalName = goalSuggestion.name
    goalDue = goalSuggestion.due ?? addYears(model.today)
    goalTarget = rupeeField(goalSuggestion.target ?? 0)
    goalSaved = rupeeField(goalSuggestion.saved ?? 0)
    goalMonthly = rupeeField(goalSuggestion.monthly ?? 0)
  }

  private var builtGoal: Goal {
    Goal(
      id: "goal_setup01", name: goalName, kind: goalSuggestion.kind, target: goalTargetPaise, saved: goalSavedPaise,
      monthly: goalMonthlyPaise, due: goalDue, createdAt: isoTimestamp(), createdBy: "setup")
  }

  private var goalTargetPaise: Int64 { paise(goalTarget) }
  private var goalSavedPaise: Int64 { paise(goalSaved) }
  private var goalMonthlyPaise: Int64 { paise(goalMonthly) }

  private func paise(_ text: String) -> Int64 {
    let value = Double(text) ?? 0
    return Int64((value * 100).rounded())
  }

  private func shown(_ paise: Int64) -> String { setupMask(Money.format(paise), hidden: model.hideAmounts) }
}

private struct FlexibleChips: View {
  var values: [String]
  var selected: (String) -> Bool
  var label: (String) -> String
  var tap: (String) -> Void
  var body: some View {
    HStack(spacing: 8) {
      ForEach(values, id: \.self) { value in
        Button(label(value)) { tap(value) }
          .buttonStyle(SetupGhostStyle())
          .accessibilityAddTraits(selected(value) ? .isSelected : [])
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Budget categories")
  }
}

struct SetupDoneStep: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions

  var body: some View {
    Card(title: model.checklist.upAndRunning
      ? "Lakshly is up and running, \(greeting) 🪷"
      : "A little more, at your pace") {
      SetupRing(percent: model.checklist.percent).frame(width: 88, height: 88)
      Text("\(model.checklist.done) of \(model.checklist.applicable) complete. Every step is yours to skip or come back to.")
        .foregroundStyle(theme.secondaryText)
      ForEach(model.checklist.items, id: \.id) { item in
        Button {
          if item.id == "appLock" { actions.openAppLock() }
          else { actions.go(setupCheckStep(item.id)) }
        } label: {
          HStack {
            Text(item.done ? "✓" : "○").frame(width: 24)
            Text(setupCheckLabel(item.id))
            if item.required { Text("Required").font(.caption).foregroundStyle(theme.secondaryText) }
            Spacer()
            Text("›").foregroundStyle(theme.secondaryText)
          }
          .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(setupCheckLabel(item.id)), \(item.done ? "done" : "not done")\(item.required ? ", required" : "")")
      }
      HStack(spacing: 8) {
        Button("Go to Overview") { actions.next() }.buttonStyle(ThemedSubmitStyle())
        Button("Keep going") {
          if let next = model.checklist.items.first(where: { !$0.done }) {
            if next.id == "appLock" { actions.openAppLock() }
            else { actions.go(setupCheckStep(next.id)) }
          } else {
            actions.toast("Everything is set. Your sources health is below.")
          }
        }
        .buttonStyle(SetupGhostStyle())
      }
    }
    ForEach(model.state.sources, id: \.catalogId) { picked in
      let source = sourceFor(picked)
      let status = freshness(picked, today: model.today)
      Card(title: source.name) {
        Text(setupFreshLabel(status)).font(.caption.weight(.semibold))
          .accessibilityLabel("\(source.name), \(setupFreshLabel(status))")
        if let next = freshnessNextDate(picked) {
          Text("Statement due ~\(setupFreshDate(next)) · search mail")
            .font(.subheadline).foregroundStyle(theme.secondaryText)
        }
        DisclosureGroup("Search mail / how to get it") {
          SetupSourceGuide(source: source, model: model, actions: actions, catalogId: picked.catalogId)
        }
      }
    }
  }

  private var greeting: String {
    let name = model.state.profile.name.trimmingCharacters(in: .whitespacesAndNewlines)
    return name.isEmpty ? "there" : name
  }
}

struct SetupConsentCard: View {
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions
  private var senders: [String] { setupConsentSenders(model.state) }

  var body: some View {
    ZStack {
      theme.bg.opacity(0.55).ignoresSafeArea()
      if model.rendering {
        consentColumn.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top).clipped()
      } else {
        ScrollView { consentColumn }
      }
    }
    .accessibilityAddTraits(.isModal)
    .accessibilityLabel("Connect your money email (read-only)")
  }

  private var consentColumn: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Connect your money email (read-only)")
        .font(.system(.title2, design: .rounded, weight: .bold))
        .accessibilityAddTraits(.isHeader)
      Text("Lakshly will search this mailbox only for emails from the financial senders listed below (banks, cards, investment and insurance companies, and subscriptions you picked).")
      Text("What is read: matching emails and their PDF statements. Never read: any other email.")
      Text("Why: to create your transactions, statements and holdings in Lakshly.")
      Text("Where it goes: it stays on this device, encrypted. Lakshly's servers never receive your emails, passwords or sign-in tokens.")
      Text("Kept for: a log of emails read, 90 days. Parsed data stays until you delete it.")
      Text("Your choices: see every email read in the Read log. Disconnect anytime (Settings ▸ Setup & data sources ▸ Disconnect), which is as easy as connecting. Delete all data anytime.")
      Text("Questions or complaints: hello@lakshly.com; you can also approach the Data Protection Board of India.")
      DisclosureGroup("Only these finance senders (\(senders.count))") {
        ForEach(senders, id: \.self) { sender in Text(sender).font(.caption) }
      }
      HStack(spacing: 8) {
        Button("Agree and connect", action: actions.agree).buttonStyle(ThemedSubmitStyle())
        Button("Not now", action: actions.declineConsent).buttonStyle(SetupGhostStyle())
      }
    }
    .padding(20)
    .modifier(GlassCard())
    .padding(24)
  }
}

func setupConsentSenders(_ state: SetupState) -> [String] {
  let list = state.sources.isEmpty ? SetupSources.catalog.sources : state.sources.map { sourceFor($0) }
  var seen = Set<String>()
  var senders: [String] = []
  for source in list {
    for value in source.senders.addresses + source.senders.domains where seen.insert(value).inserted {
      senders.append(value)
    }
  }
  return senders
}

struct SetupConfetti: View {
  @Environment(\.theme) private var theme
  var body: some View {
    ZStack {
      ForEach(0..<16, id: \.self) { index in
        Circle()
          .fill(index.isMultiple(of: 2) ? theme.gold : theme.lotus)
          .frame(width: 8, height: 8)
          .offset(x: CGFloat((index * 47) % 280) - 140, y: CGFloat((index * 29) % 180) - 40)
      }
    }
    .allowsHitTesting(false)
    .accessibilityHidden(true)
  }
}

extension View {
  @ViewBuilder func setupFileDrop(enabled: Bool, deliver: @escaping (Data, String) -> Void) -> some View {
    #if os(macOS)
    if enabled {
      onDrop(of: [.pdf, .commaSeparatedText, .fileURL], isTargeted: nil) { providers in
        loadSetupDrop(providers, deliver)
        return true
      }
    } else { self }
    #else
    self
    #endif
  }
}

#if os(macOS)
func loadSetupDrop(_ providers: [NSItemProvider], _ deliver: @escaping (Data, String) -> Void) {
  for provider in providers {
    let types = [UTType.fileURL.identifier, UTType.pdf.identifier, UTType.commaSeparatedText.identifier]
    guard let type = types.first(where: { provider.hasItemConformingToTypeIdentifier($0) }) else { continue }
    provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
      if let url = item as? URL {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        if let data = try? Data(contentsOf: url) {
          Task { @MainActor in deliver(data, url.lastPathComponent) }
        }
        return
      }
      if let data = item as? Data, type == UTType.fileURL.identifier, let url = URL(dataRepresentation: data, relativeTo: nil) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        if let file = try? Data(contentsOf: url) {
          Task { @MainActor in deliver(file, url.lastPathComponent) }
        }
        return
      }
      if let data = item as? Data {
        let name = type == UTType.pdf.identifier ? "statement.pdf" : "statement.csv"
        Task { @MainActor in deliver(data, name) }
      }
    }
    return
  }
}
#endif
