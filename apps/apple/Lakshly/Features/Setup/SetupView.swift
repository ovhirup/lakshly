import SwiftUI
import UniformTypeIdentifiers
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

@MainActor
func setupCanvasModel(session: SetupSession, themeID: String, tier: Tier) -> SetupCanvasModel {
  let platform = setupPlatform
  return SetupCanvasModel(
    state: session.state,
    checklist: session.score(),
    goals: session.activeGoals(),
    budgets: session.activeBudgets(),
    dataset: session.activeDataset(),
    today: session.today,
    health: session.health,
    showConsent: session.showConsent,
    betaNotice: session.betaNotice,
    hideAmounts: session.hideAmounts,
    toast: session.toast,
    pending: session.pending,
    rendering: false,
    showsFolderWatch: platform == .macos,
    platform: platform,
    emailLimit: limit(.setupExtraEmails, tier: tier),
    themeID: themeID,
    celebrate: session.celebrate,
    budgetCurrency: session.budgetCurrency(),
    continueDisabled: session.state.currentStep == .email && !setupEmailValid(session.draftEmail))
}

@MainActor
func setupLiveActions(session: SetupSession, openURL: OpenURLAction, selectTheme: @escaping (String) -> Void) -> SetupActions {
  SetupActions(
    setProfile: { session.updateProfile(name: $0, currency: $1) },
    selectTheme: selectTheme,
    chooseMode: { mode in
      if mode == .demo { session.exploreDemo() } else { session.useOwnData() }
    },
    setEmail: { email, provider in
      session.setDraftEmail(email)
      session.selectProvider(provider)
      if setupEmailValid(email) { session.commitEmail(email, provider: provider) }
    },
    connect: { session.connect($0, provider: $1) },
    importByHand: { session.importByHand($0, provider: $1) },
    addEmail: { session.addEmail($0) },
    removeEmail: { session.removeEmail($0) },
    skipEmail: { session.skipEmailStep() },
    toggleSource: { session.toggleSource($0) },
    addCustom: { session.addCustom(name: $0, domain: $1) },
    search: { session.searchTapped($0) },
    copySearch: { query, outlook in copySetupSearch(query, outlook: outlook, session: session) },
    openLink: { url in openURL(url) },
    setStatus: { session.setStatus($0, status: $1, reason: $2) },
    chooseImportFile: { session.wantsImporter = true },
    attributeTo: { session.attributePending(to: $0) },
    saveBudget: { lines, _ in session.saveBudgets(lines) },
    saveGoal: { session.saveGoal($0) },
    skipGoal: { session.skipGoal() },
    toast: { session.showToast($0) },
    go: { session.go($0, done: false) },
    togglePrivacy: { session.hideAmounts.toggle() },
    finishLater: { session.finishLater() },
    back: { session.back() },
    skip: { session.skip() },
    next: { session.next() },
    agree: { session.agreeConsent() },
    declineConsent: { session.declineConsent() },
    openAppLock: { session.openChecklist("appLock") },
    dropFiles: { id, files in
      if !session.state.sources.contains(where: { $0.catalogId == id }) { session.toggleSource(id) }
      session.beginBatch(files, catalogId: id)
    },
    dropFile: { id, data, name in
      if !session.state.sources.contains(where: { $0.catalogId == id }) { session.toggleSource(id) }
      session.beginImport(data: data, fileName: name, catalogId: id)
    })
}

@MainActor
func copySetupSearch(_ query: String, outlook: Bool, session: SetupSession) {
  #if os(iOS)
  UIPasteboard.general.string = query
  #elseif os(macOS)
  NSPasteboard.general.clearContents()
  NSPasteboard.general.setString(query, forType: .string)
  #endif
  session.showToast(outlook ? "Search copied. Paste it into Outlook's search bar." : "Search copied")
}

struct SetupHost: View {
  @Environment(\.theme) private var theme
  @Environment(\.openURL) private var openURL
  @Environment(\.selectTheme) private var selectTheme
  @Environment(SetupSession.self) private var session
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  @State private var picking = false
  @State private var batch: BulkImportController?

  var body: some View {
    let model = setupCanvasModel(session: session, themeID: theme.id.rawValue, tier: entitlements.tier)
    let actions = setupLiveActions(session: session, openURL: openURL, selectTheme: selectTheme)
    Group {
      #if os(macOS)
      SetupMacHost(model: model, actions: actions, picking: $picking)
      #else
      SetupPhoneHost(model: model, actions: actions, picking: $picking)
      #endif
    }
    .environment(\.theme, theme)
    .fileImporter(isPresented: $picking, allowedContentTypes: [.pdf, .commaSeparatedText], allowsMultipleSelection: true) { result in
      if case .success(let urls) = result {
        let loaded = BulkStatementParser.read(urls)
        session.beginBatch(loaded.files)
        if loaded.failures > 0 { session.showToast("\(loaded.failures) files could not be read.") }
      }
    }
    .onChange(of: session.batchFiles) { _, files in
      guard !files.isEmpty else { return }
      batch = BulkImportController(files: files, imports: store.imports)
      session.batchFiles = []
    }
    .sheet(isPresented: Binding(get: { batch != nil }, set: { if !$0 { batch?.cancel(); batch = nil; session.forcedCatalogId = nil } })) {
      if let batch {
        BulkImportView(store: store, controller: batch, recordsImport: session.recordsImport()) { report, result, id, name in
          session.completeImport(report: report, result: result, importId: id, fileName: name, catalogId: session.forcedCatalogId)
        }
      }
    }
    .onChange(of: session.wantsImporter) { _, wants in
      guard wants, session.state.currentStep == .importStep else {
        if wants { session.wantsImporter = false }
        return
      }
      session.wantsImporter = false
      picking = true
    }
    .onChange(of: session.announcement) { _, text in
      guard let text else { return }
      AccessibilityNotification.Announcement(text).post()
    }
    .onChange(of: session.celebrateTick) { _, tick in
      guard tick > 0 else { return }
      #if os(iOS)
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      #endif
    }
    .onChange(of: session.statusTick) { _, tick in
      guard tick > 0 else { return }
      #if os(iOS)
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
      #endif
    }
    .sheet(isPresented: Bindable(session).importPresented) {
      ImportView(
        store: store,
        embedded: true,
        preset: session.importPreset,
        recordsImport: session.recordsImport(),
        onDone: { report, result, importId in
          let name = session.importPreset?.fileName ?? "statement"
          let forced = session.forcedCatalogId
          session.forcedCatalogId = nil
          session.completeImport(report: report, result: result, importId: importId, fileName: name, catalogId: forced)
          session.importPresented = false
          session.importPreset = nil
        },
        onBatchImported: { report, result, importId, name in
          session.completeImport(report: report, result: result, importId: importId, fileName: name, catalogId: session.forcedCatalogId)
        },
        onBatchFinished: {
          session.importPresented = false
          session.importPreset = nil
          session.forcedCatalogId = nil
        })
      .presentationDetents([.large])
    }
  }
}

struct SetupPhoneHost: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.theme) private var theme
  var model: SetupCanvasModel
  var actions: SetupActions
  @Binding var picking: Bool

  var body: some View {
    NavigationStack {
      ZStack(alignment: .bottom) {
        ThemeBackground()
        VStack(spacing: 0) {
          SetupTopBar(model: model, actions: actions)
          TabView(selection: selection) {
            ForEach(stepOrder, id: \.self) { step in
              SetupPage(model: model, actions: actions, step: step, showsBars: false)
                .tag(step)
            }
          }
          #if os(iOS)
          .tabViewStyle(.page(indexDisplayMode: .never))
          .background(SetupPagingLock())
          #endif
          SetupBottomBar(model: model, actions: actions)
        }
        if model.showConsent { SetupConsentCard(model: model, actions: actions) }
        if model.celebrate && !reduceMotion { SetupConfetti() }
        if let toast = model.toast { toastBanner(toast) }
      }
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Finish later", action: actions.finishLater)
        }
      }
    }
  }

  private var selection: Binding<SetupStep> {
    Binding(get: { model.step }, set: { step in
      if step != model.step { actions.go(step) }
    })
  }

  private func toastBanner(_ toast: String) -> some View {
    Text(toast).font(.subheadline.weight(.semibold)).padding().modifier(GlassCard()).padding(.bottom, 88)
  }
}

struct SetupMacHost: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(SetupSession.self) private var session
  var model: SetupCanvasModel
  var actions: SetupActions
  @Binding var picking: Bool

  var body: some View {
    ZStack(alignment: .bottom) {
      NavigationSplitView {
        SetupRail(model: model, actions: actions)
          .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 260)
      } detail: {
        SetupPage(model: model, actions: actions, step: model.step, showsBars: true)
      }
      if model.showConsent { SetupConsentCard(model: model, actions: actions) }
      if model.celebrate && !reduceMotion { SetupConfetti() }
      if let toast = model.toast {
        Text(toast).font(.subheadline.weight(.semibold)).padding().modifier(GlassCard()).padding(.bottom, 24)
      }
    }
    .frame(minWidth: 760, minHeight: 600)
    .background { ThemeBackground() }
    .onChange(of: session.presented) { _, shown in
      if !shown { dismiss() }
    }
    .onDisappear { session.presented = false }
    .background {
      Button("") { actions.next() }.keyboardShortcut(.return, modifiers: []).opacity(0).allowsHitTesting(false)
      Button("") { actions.back() }.keyboardShortcut("[", modifiers: .command).opacity(0).allowsHitTesting(false)
      Button("") { session.forward() }.keyboardShortcut("]", modifiers: .command).opacity(0).allowsHitTesting(false)
      Button("") { actions.finishLater() }.keyboardShortcut("l", modifiers: .command).opacity(0).allowsHitTesting(false)
      Button("") { session.wantsImporter = true }.keyboardShortcut("o", modifiers: .command).opacity(0).allowsHitTesting(false)
    }
  }
}

#if os(iOS)
struct SetupPagingLock: UIViewRepresentable {
  func makeUIView(context: Context) -> UIView {
    let view = UIView(frame: .zero)
    view.isUserInteractionEnabled = false
    view.backgroundColor = .clear
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {
    DispatchQueue.main.async { lockPaging(from: uiView) }
  }

  private func lockPaging(from view: UIView) {
    var current: UIView? = view
    while let node = current {
      if let scroll = node as? UIScrollView, scroll.isPagingEnabled { scroll.isScrollEnabled = false }
      current = node.superview
    }
  }
}
#endif
