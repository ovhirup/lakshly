import Foundation
import Observation

@MainActor @Observable final class SetupSession {
  private let store: DataStore
  private let defaults: UserDefaults
  var state: SetupState
  var presented = false
  var health = false
  var showConsent = false
  var betaNotice = false
  var hideAmounts = false
  var toast: String?
  var pending: SetupPendingImport?
  var celebrate = false
  var celebrateTick = 0
  var statusTick = 0
  var announcement: String?
  var requestSettings = false
  var importPresented = false
  var importPreset: ImportPreset?
  var forcedCatalogId: String?
  var wantsImporter = false
  var draftName = ""
  var draftCurrency = "INR"
  var draftEmail = ""
  var draftProvider: MailProvider = .other
  private var seenEpoch: Int
  private var ephemeral = false
  private var pinnedToday: String?
  private var previewDataset: SetupDataset?
  private var previewGoals: [Goal] = []
  private var previewBudgets: [Budget] = []
  private var toastToken = 0
  private var launchConsumed = false

  init(store: DataStore, defaults: UserDefaults = .standard) {
    self.store = store
    self.defaults = defaults
    self.seenEpoch = store.setupEpoch
    self.state = store.setup ?? initialSetup(now: isoTimestamp())
    syncDrafts()
  }

  var today: String { pinnedToday ?? SetupISO.today(instant: Date()) }

  func activeDataset() -> SetupDataset {
    if ephemeral, let previewDataset { return previewDataset }
    let rows = store.source == .mine || store.userDataset != nil ? store.userDataset : nil
    return setupDataset(from: rows, goals: store.goals)
  }

  func activeGoals() -> [Goal] {
    if ephemeral { return previewGoals }
    return store.goals ?? []
  }

  func activeBudgets() -> [Budget] {
    if ephemeral { return previewBudgets }
    return store.userDataset?.budgets ?? []
  }

  func score() -> Checklist {
    if ephemeral {
      var copy = state
      copy.appLock = false
      return checklist(copy, activeDataset(), setupPlatform, today: today)
    }
    return liveChecklist(state, dataset: activeDataset(), defaults: defaults, today: today)
  }

  func budgetCurrency() -> String {
    setupAccountCurrencies(ephemeral ? nil : store.userDataset, profile: state.profile.currency)
  }

  func syncFromStore() {
    guard !ephemeral, store.setupEpoch != seenEpoch else { return }
    seenEpoch = store.setupEpoch
    state = store.setup ?? initialSetup(now: isoTimestamp())
    pending = nil
    showConsent = false
    betaNotice = false
    celebrate = false
    presented = false
    syncDrafts()
  }

  func consumeLaunch(suppressAuto: Bool) {
    guard !launchConsumed else { return }
    launchConsumed = true
    #if DEBUG
    if LaunchOptions.current.setupDemo != nil || LaunchOptions.current.setupConsent == true {
      applyLaunchControls()
      return
    }
    #endif
    if suppressAuto { return }
    if store.setup == nil && store.source != .mine {
      state = initialSetup(now: isoTimestamp())
      dispatch(.start)
      health = false
      presented = true
    }
  }

  func requestOpen(health wantHealth: Bool, step: String?) {
    if !ephemeral, let saved = store.setup { state = saved }
    syncDrafts()
    reconcile()
    self.health = false
    if let step, let parsed = SetupStep(rawValue: step) {
      state.currentStep = parsed
    } else if wantHealth || (step == nil && store.setup != nil && score().percent >= 100) {
      self.health = true
      state.currentStep = .done
    }
    if wantHealth {
      self.health = true
      state.currentStep = .done
    }
    presented = true
    announceStep(state.currentStep)
  }

  func useOwnData() {
    dispatch(.chooseMode(.mine), pin: false)
    health = false
    presented = true
    announceStep(state.currentStep)
  }

  func exploreDemo() {
    dispatch(.chooseMode(.demo), pin: false)
    presented = false
  }

  func finishLater() {
    dispatch(.finishLater)
    presented = false
  }

  func dismissCard() {
    dispatch(.dismissCard)
  }

  func back() {
    guard let index = stepOrder.firstIndex(of: state.currentStep), index > 0 else { return }
    go(stepOrder[index - 1], done: false)
  }

  func forward() {
    guard let index = stepOrder.firstIndex(of: state.currentStep), index + 1 < stepOrder.count else { return }
    go(stepOrder[index + 1], done: false)
  }

  func skipEmailStep() {
    dispatch(.skipEmail)
    go(.accounts, done: false)
  }

  func skip() {
    let step = state.currentStep
    if step == .email { dispatch(.skipEmail) }
    dispatch(.skipStep(step))
    if step == .done {
      presented = false
      return
    }
    guard let index = stepOrder.firstIndex(of: step), index + 1 < stepOrder.count else { return }
    go(stepOrder[index + 1], done: false)
  }

  func next() {
    let step = state.currentStep
    if step == .email && !setupEmailValid(draftEmail) {
      showToast("Enter a complete email address, or skip this step.")
      return
    }
    if step == .welcome { dispatch(.chooseMode(.mine)) }
    if step == .email { commitEmail(draftEmail, provider: draftProvider) }
    if step == .done {
      presented = false
      return
    }
    guard let index = stepOrder.firstIndex(of: step), index + 1 < stepOrder.count else { return }
    go(stepOrder[index + 1], done: true)
  }

  func go(_ step: SetupStep, done: Bool) {
    let from = state.currentStep
    dispatch(.goTo(step: step, done: done, from: from))
    announceStep(step)
  }

  func openChecklist(_ id: String) {
    if id == "appLock" {
      requestSettings = true
      presented = false
      return
    }
    go(setupCheckStep(id), done: false)
  }

  func updateProfile(name: String, currency: String) {
    draftName = name
    draftCurrency = currency
    dispatch(.setProfile(SetupProfilePatch(name: name, currency: currency)))
    guard !ephemeral, store.source == .mine, var user = store.userDataset, user.accounts.isEmpty,
      user.currency != state.profile.currency
    else { return }
    store.adoptUserDataset(user.replacingCurrency(state.profile.currency))
  }

  func selectProvider(_ provider: MailProvider) {
    draftProvider = provider
  }

  func setDraftEmail(_ email: String) {
    draftEmail = email
  }

  func commitEmail(_ email: String, provider: MailProvider) {
    let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.isEmpty || isSetupEmail(trimmed) else { return }
    draftEmail = trimmed
    draftProvider = provider
    dispatch(.setEmail(trimmed, provider: setupInbox(for: provider), pickerProvider: provider))
  }

  func connect(_ email: String, provider: MailProvider) {
    let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard isSetupEmail(trimmed) else { return }
    commitEmail(trimmed, provider: provider)
    showConsent = true
  }

  func agreeConsent() {
    showConsent = false
    betaNotice = true
    showToast("Your email is saved for manual searches. Automatic sync is not switched on in this build.")
  }

  func declineConsent() {
    showConsent = false
  }

  func importByHand(_ email: String, provider: MailProvider) {
    let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.isEmpty || isSetupEmail(trimmed) else {
      showToast("Enter a complete email address, or skip this step.")
      return
    }
    commitEmail(trimmed, provider: provider)
    showToast("Your address is saved. Use the searches below, then download the PDF attachment.")
  }

  func addEmail(_ email: String) {
    dispatch(.addEmail(email))
  }

  func removeEmail(_ email: String) {
    dispatch(.removeEmail(email))
  }

  func toggleSource(_ id: String) {
    dispatch(.toggleSource(id))
  }

  func addCustom(name: String, domain: String) {
    let trimmed = domain.trimmingCharacters(in: .whitespacesAndNewlines)
    dispatch(.addCustomSource(name: name, domain: trimmed.isEmpty ? nil : trimmed, catalogId: nil))
  }

  func searchTapped(_ id: String) {
    dispatch(.searchTapped(id))
  }

  func setStatus(_ id: String, status: SourceStatus, reason: String?) {
    let before = state.sources.map(\.status)
    dispatch(.setSourceStatus(catalogId: id, status: status, reason: reason))
    if state.sources.map(\.status) != before { statusTick += 1 }
  }

  func saveBudgets(_ lines: [BudgetLine]) {
    if ephemeral {
      previewBudgets = lines.map {
        Budget(id: $0.id, month: $0.month, category: $0.category, limit: $0.limit, rollover: $0.rollover)
      }
      dispatch(.acceptBudget(lines: lines, factorPct: nil))
    } else {
      var dataset = store.userDataset ?? DataStore.emptyUserDataset()
      let month = lines.first?.month ?? String(today.prefix(7))
      var kept = (dataset.budgets ?? []).filter { $0.month != month }
      kept.append(contentsOf: lines.map {
        Budget(id: $0.id, month: $0.month, category: $0.category, limit: $0.limit, rollover: $0.rollover)
      })
      dataset = dataset.replacingBudgets(kept)
      store.adoptUserDataset(dataset)
      dispatch(.acceptBudget(lines: lines, factorPct: nil))
    }
    let month = lines.first?.month ?? String(today.prefix(7))
    showToast("Budget saved for \(setupFormatMonth(month)).")
  }

  func saveGoal(_ goal: Goal) {
    if let existing = activeGoals().first, existing.id != goal.id {
      showToast("Your first goal is already set.")
      return
    }
    if ephemeral {
      previewGoals = [goal]
    } else {
      if store.userDataset == nil { store.setSource(.mine) }
      store.goals = [goal]
    }
    dispatch(.acceptGoal(goal))
    showToast("Your Laksh goal is saved.")
  }

  func skipGoal() {
    showToast("Goal skipped for now. You can create it later from setup.")
  }

  func showToast(_ text: String) {
    toastToken += 1
    toast = text
    announcement = text
    let token = toastToken
    let seconds: Double = text.contains("Search copied") ? 2 : 5
    Task { @MainActor in
      try? await Task.sleep(for: .seconds(seconds))
      if toastToken == token { toast = nil }
    }
  }

  func beginImport(data: Data?, fileName: String?, catalogId: String? = nil) {
    forcedCatalogId = catalogId
    if let data, let fileName { importPreset = ImportPreset(data: data, fileName: fileName) }
    else { importPreset = nil }
    importPresented = true
  }

  func completeImport(
    report: MergeReport, result: ParseResult, importId: String, fileName: String, catalogId: String? = nil
  ) {
    let accountIds = result.accounts.map(\.id)
    let dates = statementDates(result)
    if let catalogId {
      if !state.sources.contains(where: { $0.catalogId == catalogId }) {
        dispatch(.toggleSource(catalogId))
      }
      if state.sources.contains(where: { $0.catalogId == catalogId }) {
        assignImport(catalogId, report: report, result: result, importId: importId, fileName: fileName, accountIds: accountIds, dates: dates)
        return
      }
    }
    let picked = state.sources.map(\.catalogId)
    let decision = attribute(result.adapter, picked)
    let remembered = state.sources.first { source in
      accountIds.contains { source.accountIds?.contains($0) == true }
    }?.catalogId
    if let target = remembered ?? decision.auto, state.sources.contains(where: { $0.catalogId == target }) {
      assignImport(target, report: report, result: result, importId: importId, fileName: fileName, accountIds: accountIds, dates: dates)
      return
    }
    let ask = decision.ask.isEmpty ? picked : decision.ask
    pending = SetupPendingImport(
      file: fileName, adapter: result.adapter, importId: importId, accountIds: accountIds, added: report.added,
      duplicates: report.duplicates, confidence: result.confidence, lastDataDate: dates.last, accountDataDates: dates.map,
      candidates: ask)
  }

  func attributePending(to catalogId: String) {
    guard let pending else { return }
    self.pending = nil
    if !state.sources.contains(where: { $0.catalogId == catalogId }) {
      dispatch(.toggleSource(catalogId))
    }
    let payload = ImportAttribution(
      adapter: pending.adapter, catalogId: catalogId, importId: pending.importId, file: pending.file,
      accountIds: pending.accountIds, added: pending.added, duplicates: pending.duplicates, confidence: pending.confidence,
      lastDataDate: pending.lastDataDate, accountDataDates: pending.accountDataDates)
    let before = state.sources.map(\.status)
    dispatch(.importAttributed(payload))
    if state.sources.map(\.status) != before { statusTick += 1 }
    announceImport(pending.added, duplicates: pending.duplicates, catalogId: catalogId)
  }

  func recordsImport() -> Bool { !ephemeral }

  func dispatch(_ action: SetupAction, pin: Bool = true) {
    let beforeComplete = state.events.contains { $0.event == "setup.completed" }
    let beforeStatus = state.sources.map(\.status)
    let forced: SetupStep? = {
      guard pin else { return nil }
      switch action {
      case .goTo, .finishLater, .dismissCard: return nil
      default: return state.currentStep
      }
    }()
    state = setupReducer(
      state, action, now: isoTimestamp(), dataset: activeDataset(), platform: setupPlatform, today: today,
      currentStep: forced)
    if case .chooseMode(.mine) = action, !ephemeral { store.setSource(.mine) }
    if case .chooseMode(.demo) = action {
      if !ephemeral { store.setSource(.demo) }
      presented = false
    }
    let afterComplete = state.events.contains { $0.event == "setup.completed" }
    if !beforeComplete && afterComplete {
      celebrate = true
      celebrateTick += 1
      let name = state.profile.name.trimmingCharacters(in: .whitespacesAndNewlines)
      announcement = "Lakshly is up and running, \(name.isEmpty ? "there" : name)"
    }
    if state.sources.map(\.status) != beforeStatus { statusTick += 1 }
    persist()
  }

  #if DEBUG
  func loadDemo(step: String?, consent: Bool, stateData: Data, datasetData: Data) throws {
    ephemeral = true
    pinnedToday = "2026-10-03"
    state = try JSONDecoder().decode(SetupState.self, from: stateData)
    state.appLock = false
    let dataset = try JSONDecoder().decode(Dataset.self, from: datasetData)
    previewDataset = setupDataset(from: dataset, goals: [])
    previewGoals = []
    previewBudgets = dataset.budgets ?? []
    showConsent = consent
    betaNotice = false
    health = false
    if step == "health" {
      health = true
      state.currentStep = .done
    } else if let step, let parsed = SetupStep(rawValue: step) {
      state.currentStep = parsed
    }
    if consent && step == nil { state.currentStep = .email }
    syncDrafts()
    presented = true
  }

  private func applyLaunchControls() {
    let options = LaunchOptions.current
    guard let stateURL = Bundle.main.url(forResource: "state.midway", withExtension: "json"),
      let dataURL = Bundle.main.url(forResource: "dataset.after-import", withExtension: "json"),
      let stateData = try? Data(contentsOf: stateURL),
      let datasetData = try? Data(contentsOf: dataURL)
    else { return }
    try? loadDemo(step: options.setupDemo, consent: options.setupConsent == true, stateData: stateData, datasetData: datasetData)
  }
  #endif

  private func assignImport(
    _ catalogId: String, report: MergeReport, result: ParseResult, importId: String, fileName: String,
    accountIds: [String], dates: (last: String?, map: [String: String]?)
  ) {
    pending = nil
    let payload = ImportAttribution(
      adapter: result.adapter, catalogId: catalogId, importId: importId, file: fileName, accountIds: accountIds,
      added: report.added, duplicates: report.duplicates, confidence: result.confidence, lastDataDate: dates.last,
      accountDataDates: dates.map)
    let before = state.sources.map(\.status)
    dispatch(.importAttributed(payload))
    if state.sources.map(\.status) != before { statusTick += 1 }
    announceImport(report.added, duplicates: report.duplicates, catalogId: catalogId)
  }

  private func announceImport(_ added: Int, duplicates: Int, catalogId: String) {
    let name = sourceFor(id: catalogId, custom: state.sources.first { $0.catalogId == catalogId }?.custom).name
    if added == 0 && duplicates > 0 {
      showToast("0 new · \(duplicates) already had")
    } else {
      showToast("Imported \(added) transactions from \(name).")
    }
  }

  private func statementDates(_ result: ParseResult) -> (last: String?, map: [String: String]?) {
    var map: [String: String] = [:]
    for account in result.accounts {
      let raw = result.meta.first { $0.accountId == account.id }?.periodTo ?? account.asOf
      let day = String(raw.prefix(10))
      if day.count >= 10 { map[account.id] = String(day.prefix(10)) }
    }
    return (map.values.sorted().first, map.isEmpty ? nil : map)
  }

  private func reconcile() {
    guard !ephemeral else { return }
    let known = Set((state.imports ?? []).map(\.id))
    for entry in store.imports where !known.contains(entry.id) {
      let picked = state.sources.map(\.catalogId)
      let decision = attribute(entry.adapter, picked)
      let remembered = state.sources.first { source in
        entry.accountIds.contains { source.accountIds?.contains($0) == true }
      }?.catalogId
      if let target = remembered ?? decision.auto, state.sources.contains(where: { $0.catalogId == target }) {
        let payload = ImportAttribution(
          adapter: entry.adapter, catalogId: target, importId: entry.id, file: entry.file, accountIds: entry.accountIds,
          added: entry.added, duplicates: entry.duplicates, confidence: entry.confidence, lastDataDate: nil,
          accountDataDates: nil)
        dispatch(.importAttributed(payload))
      } else if pending == nil {
        let ask = decision.ask.isEmpty ? picked : decision.ask
        pending = SetupPendingImport(
          file: entry.file, adapter: entry.adapter, importId: entry.id, accountIds: entry.accountIds, added: entry.added,
          duplicates: entry.duplicates, confidence: entry.confidence, lastDataDate: nil, accountDataDates: nil,
          candidates: ask)
        break
      }
    }
  }

  private func persist() {
    guard !ephemeral else { return }
    store.setup = state
    SetupFlags.write(defaults, dismissed: state.dismissedAt != nil, percent: score().percent)
    seenEpoch = store.setupEpoch
    store.save()
  }

  private func syncDrafts() {
    draftName = state.profile.name
    draftCurrency = state.profile.currency
    draftEmail = state.email.primary
    draftProvider = state.email.pickerProvider ?? detectMailProvider(state.email.primary)
  }

  private func announceStep(_ step: SetupStep) {
    announcement = "Step \(setupStepIndex(step)) of 6, \(setupVisibleTitle(step, health: health))"
  }
}
