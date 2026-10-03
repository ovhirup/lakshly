import Foundation

enum SetupFlags {
  static let seen = "setup.seen"
  static let dismissed = "setup.dismissed"
  static let percent = "setup.percent"

  static func clear(_ defaults: UserDefaults) {
    defaults.removeObject(forKey: seen)
    defaults.removeObject(forKey: dismissed)
    defaults.removeObject(forKey: percent)
  }

  static func write(_ defaults: UserDefaults, dismissed isDismissed: Bool, percent value: Int) {
    defaults.set(true, forKey: seen)
    defaults.set(isDismissed, forKey: dismissed)
    defaults.set(value, forKey: percent)
  }
}

func liveAppLock(defaults: UserDefaults = .standard) -> Bool {
  if defaults.object(forKey: "settings.appLock") == nil { return true }
  return defaults.bool(forKey: "settings.appLock")
}

var setupPlatform: SetupPlatform {
  #if os(macOS)
  .macos
  #else
  .ios
  #endif
}

func setupDataset(from dataset: Dataset?, goals: [Goal]?) -> SetupDataset {
  SetupDataset(
    transactions: (dataset?.transactions ?? []).map {
      SetupTransaction(id: $0.id, date: $0.date, amount: $0.amount, category: $0.category, merchant: $0.merchant, tags: $0.tags)
    },
    accounts: (dataset?.accounts ?? []).map { SetupAccountBalance(type: $0.type, balance: $0.balance) },
    budgets: (dataset?.budgets ?? []).map {
      SetupBudgetRef(id: $0.id, month: $0.month, category: $0.category, limit: $0.limit, rollover: $0.rollover)
    },
    goals: (goals ?? []).map { SetupGoalRef(id: $0.id) })
}

func liveChecklist(
  _ state: SetupState, dataset: SetupDataset, defaults: UserDefaults = .standard, today: String
) -> Checklist {
  var copy = state
  copy.appLock = liveAppLock(defaults: defaults)
  return checklist(copy, dataset, setupPlatform, today: today)
}

func setupRefreshCount(_ state: SetupState, today: String) -> Int {
  state.sources.filter {
    let status = freshness($0, today: today)
    return status == .due || status == .stale
  }.count
}

func setupMenuLine(percent: Int, refreshCount: Int) -> String? {
  if percent < 100 { return "Setup \(percent)%" }
  if refreshCount > 0 { return "\(refreshCount) sources need a refresh" }
  return nil
}

func setupStepTitle(_ step: SetupStep) -> String {
  switch step {
  case .welcome: "Get Lakshly up and running"
  case .email: "Connect your money email"
  case .accounts: "Pick your accounts"
  case .importStep: "Sync and import"
  case .plan: "First budget + Laksh goal"
  case .done: "Up and running"
  }
}

func setupVisibleTitle(_ step: SetupStep, health: Bool) -> String {
  if step == .done && health { return "Data sources health" }
  return setupStepTitle(step)
}

func setupRailTitle(_ step: SetupStep) -> String {
  switch step {
  case .welcome: "Welcome"
  case .done: "Done"
  default: setupStepTitle(step)
  }
}

func setupStepIndex(_ step: SetupStep) -> Int {
  (stepOrder.firstIndex(of: step) ?? 0) + 1
}

func setupCheckLabel(_ id: String) -> String {
  switch id {
  case "profile": "Say hello"
  case "myData": "Use your own data"
  case "email": "Connect your money email"
  case "sources": "Pick your accounts"
  case "firstImport": "Import a bank or card statement"
  case "investments": "Add your investments (CAS)"
  case "allSources": "Every account handled"
  case "budget": "Set a first budget"
  case "goal": "Create a Laksh goal"
  case "appLock": "App lock"
  default: id
  }
}

func setupCheckStep(_ id: String) -> SetupStep {
  switch id {
  case "profile", "myData": .welcome
  case "email": .email
  case "sources": .accounts
  case "firstImport", "investments", "allSources": .importStep
  case "budget", "goal": .plan
  default: .done
  }
}

func setupStatusLabel(_ status: SourceStatus) -> String {
  switch status {
  case .todo: "○ To do"
  case .searching: "⌕ Looking in mail…"
  case .waiting: "⚿ Needs a password"
  case .imported: "✓ Imported"
  case .skipped: "− Skipped"
  case .error: "⚠ Needs a look"
  }
}

func setupFreshLabel(_ status: Freshness) -> String {
  switch status {
  case .fresh: "✓ Fresh"
  case .stale: "⚠ Stale"
  case .due: "◷ Due"
  case .skipped: "− Skipped"
  case .todo: "○ To do"
  }
}

func setupEmailValid(_ email: String) -> Bool {
  let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty || isSetupEmail(trimmed)
}

func setupInbox(for provider: MailProvider) -> InboxProvider {
  switch provider {
  case .google: .gmail
  case .microsoft: .outlook
  default: .other
  }
}

func setupTitleCase(_ text: String) -> String {
  guard let first = text.first else { return text }
  return String(first).uppercased() + text.dropFirst()
}

private var setupMonthCalendar: Calendar {
  var calendar = Calendar(identifier: .gregorian)
  calendar.locale = Locale(identifier: "en_US_POSIX")
  return calendar
}

func setupFormatMonth(_ month: String, short: Bool = false) -> String {
  let parts = month.split(separator: "-")
  guard parts.count >= 2, let monthIndex = Int(parts[1]), (1...12).contains(monthIndex) else { return month }
  let symbol = setupMonthCalendar.shortMonthSymbols[monthIndex - 1]
  if short { return symbol }
  return "\(symbol) \(parts[0])"
}

func setupFormatDate(_ day: String) -> String {
  guard day.count >= 10 else { return day }
  let parts = SetupISO.ymd(day)
  guard (1...12).contains(parts.m) else { return day }
  let symbol = setupMonthCalendar.shortMonthSymbols[parts.m - 1]
  return "\(parts.d) \(symbol) \(parts.y)"
}

func setupFreshDate(_ day: String) -> String {
  let formatted = setupFormatDate(day)
  if let space = formatted.lastIndex(of: " ") { return String(formatted[..<space]) }
  return formatted
}

func setupMask(_ text: String, hidden: Bool) -> String {
  hidden ? "••••" : text
}

let setupProviders: [(MailProvider, String)] = [
  (.google, "Gmail"), (.microsoft, "Outlook"), (.icloud, "iCloud"), (.yahoo, "Yahoo"), (.zoho, "Zoho"), (.other, "Other"),
]

let setupSkipReasons: [(String, String)] = [
  ("via-card", "Charges come via my card"),
  ("manual", "Track manually"),
  ("no-account", "I don't have this account"),
  ("not-now-ok", "Not now"),
]

let setupManualFallbackIDs = ["hdfc-bank", "hdfc-card", "cams-cas"]

struct SetupPendingImport: Equatable {
  var file: String
  var adapter: String
  var importId: String
  var accountIds: [String]
  var added: Int
  var duplicates: Int
  var confidence: Double?
  var lastDataDate: String?
  var accountDataDates: [String: String]?
  var candidates: [String]
}

struct ImportPreset: Equatable {
  var data: Data
  var fileName: String
}

struct SetupCanvasModel {
  var state: SetupState
  var checklist: Checklist
  var goals: [Goal]
  var budgets: [Budget]
  var dataset: SetupDataset
  var today: String
  var health: Bool
  var showConsent: Bool
  var betaNotice: Bool
  var hideAmounts: Bool
  var toast: String?
  var pending: SetupPendingImport?
  var rendering: Bool
  var showsFolderWatch: Bool
  var platform: SetupPlatform
  var emailLimit: Int
  var themeID: String
  var celebrate: Bool
  var budgetCurrency: String
  var continueDisabled: Bool

  var step: SetupStep { state.currentStep }
}

struct SetupActions {
  var setProfile: @MainActor (String, String) -> Void = { _, _ in }
  var selectTheme: @MainActor (String) -> Void = { _ in }
  var chooseMode: @MainActor (SetupMode) -> Void = { _ in }
  var setEmail: @MainActor (String, MailProvider) -> Void = { _, _ in }
  var connect: @MainActor (String, MailProvider) -> Void = { _, _ in }
  var importByHand: @MainActor (String, MailProvider) -> Void = { _, _ in }
  var addEmail: @MainActor (String) -> Void = { _ in }
  var removeEmail: @MainActor (String) -> Void = { _ in }
  var skipEmail: @MainActor () -> Void = {}
  var toggleSource: @MainActor (String) -> Void = { _ in }
  var addCustom: @MainActor (String, String) -> Void = { _, _ in }
  var search: @MainActor (String) -> Void = { _ in }
  var copySearch: @MainActor (String, Bool) -> Void = { _, _ in }
  var openLink: @MainActor (URL) -> Void = { _ in }
  var setStatus: @MainActor (String, SourceStatus, String?) -> Void = { _, _, _ in }
  var chooseImportFile: @MainActor () -> Void = {}
  var attributeTo: @MainActor (String) -> Void = { _ in }
  var saveBudget: @MainActor ([BudgetLine], Int) -> Void = { _, _ in }
  var saveGoal: @MainActor (Goal) -> Void = { _ in }
  var skipGoal: @MainActor () -> Void = {}
  var toast: @MainActor (String) -> Void = { _ in }
  var go: @MainActor (SetupStep) -> Void = { _ in }
  var togglePrivacy: @MainActor () -> Void = {}
  var finishLater: @MainActor () -> Void = {}
  var back: @MainActor () -> Void = {}
  var skip: @MainActor () -> Void = {}
  var next: @MainActor () -> Void = {}
  var agree: @MainActor () -> Void = {}
  var declineConsent: @MainActor () -> Void = {}
  var openAppLock: @MainActor () -> Void = {}
  var dropFile: @MainActor (String, Data, String) -> Void = { _, _, _ in }
}

func setupAccountCurrencies(_ dataset: Dataset?, profile: String) -> String {
  let accounts = dataset?.accounts ?? []
  if !accounts.isEmpty, accounts.allSatisfy({ $0.currency == profile }) { return profile }
  return "INR"
}
