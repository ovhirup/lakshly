import Foundation

let requiredItems = ["profile", "myData", "sources", "firstImport", "budget"]

enum Freshness: String, Equatable {
  case skipped, todo, fresh, due, stale
}

struct ChecklistItem: Codable, Equatable {
  var id: String
  var done: Bool
  var required: Bool
}

struct Checklist: Codable, Equatable {
  var items: [ChecklistItem]
  var done: Int
  var applicable: Int
  var percent: Int
  var upAndRunning: Bool
}

struct Attribution: Codable, Equatable {
  var auto: String?
  var ask: [String]
}

func attribute(_ adapter: String, _ picked: [String]) -> Attribution {
  let hits = picked.filter { sourceFor($0).importer.adapters.contains(adapter) }
  if adapter.hasSuffix(".generic") {
    return Attribution(auto: nil, ask: hits + picked.filter { !hits.contains($0) })
  }
  return hits.count == 1 ? Attribution(auto: hits[0], ask: []) : Attribution(auto: nil, ask: hits)
}

func checklist(_ state: SetupState, _ dataset: SetupDataset, _ platform: SetupPlatform, today: String) -> Checklist {
  let picked = state.sources
  let kinds = Set(picked.flatMap { sourceFor($0).kinds })
  func imported(_ wanted: [String]) -> Bool {
    picked.contains { source in
      source.status == .imported && sourceFor(source).kinds.contains { wanted.contains($0) }
    }
  }
  let month = String(today.prefix(7))
  let rows: [(String, Bool, Bool)] = [
    ("profile", true, !state.profile.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !state.profile.currency.isEmpty),
    ("myData", true, state.mode == .mine),
    ("email", true, !state.email.primary.isEmpty || state.email.skipped || (state.mailboxes?.contains { $0.status == .ok } ?? false)),
    ("sources", true, !picked.isEmpty),
    ("firstImport", true, imported(["bank", "card"])),
    ("investments", kinds.contains("cas") || kinds.contains("investment"), imported(["cas", "investment"])),
    ("allSources", !picked.isEmpty, !picked.isEmpty && picked.allSatisfy { $0.status == .imported || $0.status == .skipped }),
    ("budget", true, (dataset.budgets ?? []).contains { $0.month == month } || (state.budgetMonths?.contains(month) ?? false)),
    ("goal", true, !(dataset.goals ?? []).isEmpty || !(state.goalIds ?? []).isEmpty),
    ("appLock", platform != .web, state.appLock == true),
  ]
  let items = rows.filter { $0.1 }.map { ChecklistItem(id: $0.0, done: $0.2, required: requiredItems.contains($0.0)) }
  let done = items.filter(\.done).count
  let applicable = items.count
  return Checklist(
    items: items,
    done: done,
    applicable: applicable,
    percent: applicable == 0 ? 0 : (done * 100) / applicable,
    upAndRunning: items.allSatisfy { !$0.required || $0.done }
  )
}

func freshnessNextDate(_ source: SetupSource, _ catalog: SourcesCatalog = SetupSources.catalog) -> String? {
  guard let last = source.lastDataDate, !last.isEmpty else { return nil }
  let cadence = catalog.sources.first { $0.id == source.catalogId }?.cadence ?? sourceFor(source).cadence
  if cadence.every == "year" { return addYears(last) }
  return SetupISO.monthAfter(last, day: cadence.expectedDay ?? 10)
}

func freshness(_ source: SetupSource, _ catalog: SourcesCatalog = SetupSources.catalog, today: String) -> Freshness {
  if source.status == .skipped { return .skipped }
  guard let next = freshnessNextDate(source, catalog) else { return .todo }
  if today <= next { return .fresh }
  let grace = catalog.sources.first { $0.id == source.catalogId }?.cadence.graceDays ?? 10
  let dueUntil = SetupISO.addDays(next, days: grace)
  return today <= dueUntil ? .due : .stale
}

func setupReducer(
  _ state: SetupState,
  _ action: SetupAction,
  now: String,
  dataset: SetupDataset? = nil,
  platform: SetupPlatform? = nil,
  today todayOverride: String? = nil,
  currentStep forcedStep: SetupStep? = nil
) -> SetupState {
  if case .reset = action { return initialSetup(now: now) }
  var s = state
  s.updatedAt = now
  let today = todayOverride ?? SetupISO.todayPrefix(now)
  let data = dataset ?? SetupDataset(transactions: [])
  let resolvedPlatform = platform ?? .web

  func uniqSteps(_ steps: [SetupStep]) -> [SetupStep] {
    var seen = Set<SetupStep>()
    return steps.filter { seen.insert($0).inserted }
  }
  func uniqStrings(_ values: [String]) -> [String] {
    var seen = Set<String>()
    return values.filter { seen.insert($0).inserted }
  }
  func mark(_ step: SetupStep) {
    s.stepsDone = uniqSteps(s.stepsDone + [step])
    s.stepsSkipped.removeAll { $0 == step }
  }
  func sourceIndex(_ id: String) -> Int? {
    s.sources.firstIndex { $0.catalogId == id }
  }
  func withSource(_ id: String, _ body: (inout SetupSource) -> Void) {
    guard let index = sourceIndex(id) else { return }
    body(&s.sources[index])
  }
  func withMailbox(_ id: String?, _ body: (inout SetupMailbox) -> Void) {
    guard let id, var boxes = s.mailboxes, let index = boxes.firstIndex(where: { $0.id == id }) else { return }
    body(&boxes[index])
    s.mailboxes = boxes
  }

  switch action {
  case .start:
    s.dismissedAt = nil
  case .setProfile(let patch):
    let name = prefixUTF16(patch.name ?? s.profile.name, 40)
    s.profile = SetupProfile(name: name, currency: patch.currency ?? s.profile.currency)
  case .chooseMode(let mode):
    s.dismissedAt = nil
    s.mode = mode
    mark(.welcome)
    if mode == .demo {
      s.sources = []
      s.currentStep = .email
    }
  case .setEmail(let raw, let provider, let picker):
    let email = setupLower(raw.trimmingCharacters(in: .whitespacesAndNewlines))
    if !email.isEmpty && !isSetupEmail(email) { break }
    s.email.primary = email
    s.email.provider = provider ?? detectProvider(email)
    s.email.pickerProvider = picker
    s.email.extra = (s.email.extra ?? []).filter { $0 != email }
    s.email.skipped = false
  case .addEmail(let raw):
    let email = setupLower(raw.trimmingCharacters(in: .whitespacesAndNewlines))
    if isSetupEmail(email) && email != s.email.primary {
      s.email.extra = uniqStrings((s.email.extra ?? []) + [email])
    }
  case .removeEmail(let email):
    s.email.extra = (s.email.extra ?? []).filter { $0 != email }
  case .skipEmail:
    s.email.skipped = true
    mark(.email)
  case .consentGiven(let consent, let senders, let mailboxId):
    s.consent = consent ?? MailboxConsent(version: "mailsync-consent-v1", at: now, senders: senders ?? 0)
    if let consent = s.consent {
      withMailbox(mailboxId) { $0.consent = consent }
    }
  case .mailboxConnected(let mailbox):
    var box = mailbox
    if box.consent == nil { box.consent = s.consent }
    var boxes = (s.mailboxes ?? []).filter { $0.id != box.id }
    boxes.append(box)
    s.mailboxes = boxes
    s.email.skipped = false
  case .discoveryDone(let mailboxId, let found):
    withMailbox(mailboxId) { $0.discovery = found }
    if s.mode == .mine {
      for hit in found where hit.count > 0 && sourceIndex(hit.catalogId) == nil {
        s.sources.append(emptySource(hit.catalogId))
      }
    }
  case .syncStarted(let mailboxId):
    guard s.mailboxes?.first(where: { $0.id == mailboxId })?.status == .ok else { break }
    withMailbox(mailboxId) { $0.progress = MailboxProgress(done: 0, total: 0) }
    for index in s.sources.indices where s.sources[index].status != .skipped {
      s.sources[index].status = .searching
    }
  case .syncProgress(let mailboxId, let done, let total, let catalogId, let status):
    withMailbox(mailboxId) { $0.progress = MailboxProgress(done: done, total: total) }
    if let catalogId, let status, !catalogId.isEmpty {
      withSource(catalogId) { $0.status = status }
    }
  case .syncDone(let mailboxId, let cursors, let seenIds):
    guard s.mailboxes?.first(where: { $0.id == mailboxId })?.status == .ok else { break }
    withMailbox(mailboxId) { box in
      box.lastSyncAt = now
      if let cursors { box.cursors = cursors }
      box.seenIds = Array(uniqStrings(seenIds ?? box.seenIds).suffix(5000))
      box.progress = nil
    }
  case .passwordTaskAdded(let mailboxId, let task):
    guard s.mailboxes?.contains(where: { $0.id == mailboxId }) == true else { break }
    withMailbox(mailboxId) { box in
      box.passwordTasks = box.passwordTasks.filter { $0.messageId != task.messageId || $0.attachmentId != task.attachmentId } + [task]
    }
    withSource(task.sourceId) { $0.status = .waiting }
  case .passwordTaskResolved(let mailboxId, let messageId, let attachmentId):
    withMailbox(mailboxId) { box in
      box.passwordTasks = box.passwordTasks.filter { task in
        task.messageId != messageId || (attachmentId != nil && task.attachmentId != attachmentId)
      }
    }
  case .mailboxReauthNeeded(let mailboxId):
    withMailbox(mailboxId) { $0.status = .reauth }
  case .mailboxDisconnected(let mailboxId):
    s.mailboxes = (s.mailboxes ?? []).filter { $0.id != mailboxId }
  case .toggleSource(let catalogId):
    guard s.mode == .mine else { break }
    if let index = sourceIndex(catalogId) {
      s.sources.remove(at: index)
    } else {
      s.sources.append(emptySource(catalogId))
    }
  case .addCustomSource(let name, let domain, let catalogId):
    guard s.mode == .mine else { break }
    let id = catalogId ?? customCatalogId(name)
    if sourceIndex(id) == nil {
      var source = emptySource(id)
      source.custom = CustomSource(name: name, domain: domain.map { setupLower($0.trimmingCharacters(in: .whitespacesAndNewlines)) })
      s.sources.append(source)
    }
  case .searchTapped(let catalogId):
    withSource(catalogId) { source in
      source.searchedAt = now
      if source.status == .todo { source.status = .searching }
    }
  case .importAttributed(let payload):
    let remembered = s.sources.first { source in
      payload.accountIds.contains { source.accountIds?.contains($0) == true }
    }?.catalogId
    let id = payload.catalogId ?? remembered ?? attribute(payload.adapter, s.sources.map(\.catalogId)).auto
    guard let id, sourceIndex(id) != nil else { break }
    let importId = payload.importId ?? String(format: "imp_%03d", (s.imports?.count ?? 0) + 1)
    withSource(id) { source in
      let low = payload.confidence.map { $0 < 0.6 } ?? false
      source.status = low ? .error : .imported
      source.skipReason = low ? "Low-confidence layout; check the imported rows" : nil
      source.accountIds = uniqStrings((source.accountIds ?? []) + payload.accountIds)
      source.importIds = uniqStrings((source.importIds ?? []) + [importId])
      if let dates = payload.accountDataDates {
        var merged = source.accountDataDates ?? [:]
        for (key, value) in dates { merged[key] = value }
        source.accountDataDates = merged
        source.lastDataDate = merged.values.sorted().first
      } else if let last = payload.lastDataDate, !last.isEmpty {
        source.lastDataDate = last
      }
    }
    var imports = (s.imports ?? []).filter { $0.id != importId }
    imports.append(SetupImport(
      id: importId,
      at: now,
      file: payload.file,
      adapter: payload.adapter,
      accountIds: payload.accountIds,
      added: payload.added,
      duplicates: payload.duplicates
    ))
    s.imports = imports
  case .importFailed(let catalogId, let reason):
    withSource(catalogId) { source in
      source.status = .error
      source.skipReason = reason
    }
  case .setSourceStatus(let catalogId, let status, let reason):
    withSource(catalogId) { source in
      source.status = status
      source.skipReason = reason
    }
  case .acceptBudget(let lines, let factorPct):
    let months = lines?.map(\.month) ?? suggestBudget(data, today: today, factorPct: factorPct ?? 95).lines.map(\.month)
    s.budgetMonths = uniqStrings((s.budgetMonths ?? []) + months)
  case .acceptGoal(let supplied):
    let goal = supplied ?? goalFromSuggestion(data, today: today, now: now)
    if let goal,
       !(data.goals ?? []).contains(where: { $0.id != goal.id }),
       !(s.goalIds ?? []).contains(where: { $0 != goal.id }) {
      s.goalIds = [goal.id]
    }
  case .skipStep(let step):
    s.stepsSkipped = uniqSteps(s.stepsSkipped + [step])
    s.stepsDone.removeAll { $0 == step }
  case .goTo(let step, let done, let from):
    if done { mark(from ?? s.currentStep) }
    s.currentStep = step
  case .finishLater:
    s.dismissedAt = nil
  case .dismissCard:
    s.dismissedAt = now
  case .reset:
    break
  }

  if !isNavigation(action) {
    s.currentStep = stepOrder.first { !s.stepsDone.contains($0) && !s.stepsSkipped.contains($0) } ?? .done
  }
  if let forcedStep { s.currentStep = forcedStep }
  let score = checklist(s, data, resolvedPlatform, today: today)
  if score.upAndRunning && s.mode == .mine && !s.events.contains(where: { $0.event == "setup.completed" }) && s.completedAt == nil {
    s.events.append(SetupEvent(
      event: "setup.completed",
      at: now,
      payload: SetupEventPayload(mode: "mine", required: requiredItems, platform: resolvedPlatform)
    ))
    s.completedAt = now
  }
  return s
}

private func isNavigation(_ action: SetupAction) -> Bool {
  switch action {
  case .goTo, .finishLater, .dismissCard: return true
  default: return false
  }
}

private func customCatalogId(_ name: String) -> String {
  let lower = setupLower(name)
  var slug = ""
  var pendingDash = false
  var started = false
  for scalar in lower.unicodeScalars {
    let ascii = scalar.value < 128
    let alnum = ascii && (Character(scalar).isLetter || Character(scalar).isNumber)
    if alnum {
      if pendingDash && started { slug.append("-") }
      pendingDash = false
      started = true
      slug.append(Character(scalar))
    } else if started {
      pendingDash = true
    }
  }
  return "custom:\(slug)"
}

private func prefixUTF16(_ text: String, _ limit: Int) -> String {
  let units = text.utf16
  guard units.count > limit else { return text }
  var count = limit
  let boundary = units.index(units.startIndex, offsetBy: count)
  if count > 0 && UTF16.isTrailSurrogate(units[boundary]) { count -= 1 }
  return String(decoding: units.prefix(count), as: UTF16.self)
}
