import Foundation

let stepOrder: [SetupStep] = [.welcome, .email, .accounts, .importStep, .plan, .done]

enum SetupStep: String, Codable, Equatable, Hashable {
  case welcome, email, accounts
  case importStep = "import"
  case plan, done
}

enum SetupPlatform: String, Codable, Equatable {
  case web, ios, macos
}

enum SetupMode: String, Codable, Equatable {
  case mine, demo
}

enum SourceStatus: String, Codable, Equatable {
  case todo, searching, waiting, imported, skipped, error
}

enum MailboxProvider: String, Codable, Equatable {
  case google, microsoft, imap
}

enum MailboxMethod: String, Codable, Equatable {
  case oauth, appPassword
}

enum MailboxStatus: String, Codable, Equatable {
  case ok, reauth, revoked, error
}

struct SetupProfile: Codable, Equatable {
  var name: String
  var currency: String
}

struct SetupProfilePatch: Codable, Equatable {
  var name: String?
  var currency: String?
}

struct SetupEmail: Codable, Equatable {
  var primary: String
  var extra: [String]?
  var provider: InboxProvider
  var pickerProvider: MailProvider?
  var skipped: Bool
}

struct SetupSource: Codable, Equatable {
  var catalogId: String
  var custom: CustomSource?
  var status: SourceStatus
  var skipReason: String?
  var lastDataDate: String?
  var importIds: [String]?
  var accountIds: [String]?
  var searchedAt: String?
  var accountDataDates: [String: String]?
}

struct PasswordTask: Codable, Equatable {
  var messageId: String
  var attachmentId: String
  var sourceId: String
  var since: String?
}

struct MailboxConsent: Codable, Equatable {
  var version: String
  var at: String
  var senders: Int
}

struct MailboxProgress: Codable, Equatable {
  var done: Int
  var total: Int
}

struct DiscoveryHit: Codable, Equatable {
  var catalogId: String
  var count: Int
}

struct SetupMailbox: Codable, Equatable {
  var id: String
  var provider: MailboxProvider
  var address: String
  var method: MailboxMethod
  var imapHost: String?
  var connectedAt: String
  var lastSyncAt: String?
  var status: MailboxStatus
  var cursors: [String: String]
  var seenIds: [String]
  var passwordTasks: [PasswordTask]
  var consent: MailboxConsent?
  var progress: MailboxProgress?
  var discovery: [DiscoveryHit]?
}

struct SetupEventPayload: Codable, Equatable {
  var mode: String
  var required: [String]
  var platform: SetupPlatform
}

struct SetupEvent: Codable, Equatable {
  var event: String
  var at: String
  var payload: SetupEventPayload
}

struct SetupImport: Codable, Equatable {
  var id: String
  var at: String
  var file: String
  var adapter: String
  var accountIds: [String]?
  var added: Int
  var duplicates: Int
}

struct SetupState: Codable, Equatable {
  var v: Int
  var startedAt: String
  var updatedAt: String
  var completedAt: String?
  var dismissedAt: String?
  var currentStep: SetupStep
  var stepsDone: [SetupStep]
  var stepsSkipped: [SetupStep]
  var profile: SetupProfile
  var mode: SetupMode
  var email: SetupEmail
  var sources: [SetupSource]
  var mailboxes: [SetupMailbox]?
  var imports: [SetupImport]?
  var events: [SetupEvent]
  var appLock: Bool?
  var budgetMonths: [String]?
  var goalIds: [String]?
  var consent: MailboxConsent?
}

struct ImportAttribution: Equatable {
  var adapter: String
  var catalogId: String?
  var importId: String?
  var file: String
  var accountIds: [String]
  var added: Int
  var duplicates: Int
  var confidence: Double?
  var lastDataDate: String?
  var accountDataDates: [String: String]?
}

enum SetupAction: Equatable {
  case start
  case skipEmail
  case finishLater
  case dismissCard
  case reset
  case setProfile(SetupProfilePatch)
  case chooseMode(SetupMode)
  case setEmail(String, provider: InboxProvider?, pickerProvider: MailProvider?)
  case addEmail(String)
  case removeEmail(String)
  case consentGiven(MailboxConsent?, senders: Int?, mailboxId: String?)
  case mailboxConnected(SetupMailbox)
  case discoveryDone(mailboxId: String, sources: [DiscoveryHit])
  case syncStarted(mailboxId: String)
  case syncProgress(mailboxId: String, done: Int, total: Int, catalogId: String?, status: SourceStatus?)
  case syncDone(mailboxId: String, cursors: [String: String]?, seenIds: [String]?)
  case passwordTaskAdded(mailboxId: String, PasswordTask)
  case passwordTaskResolved(mailboxId: String, messageId: String, attachmentId: String?)
  case mailboxReauthNeeded(mailboxId: String)
  case mailboxDisconnected(mailboxId: String)
  case toggleSource(String)
  case addCustomSource(name: String, domain: String?, catalogId: String?)
  case searchTapped(String)
  case importAttributed(ImportAttribution)
  case importFailed(catalogId: String, reason: String?)
  case setSourceStatus(catalogId: String, status: SourceStatus, reason: String?)
  case acceptBudget(lines: [BudgetLine]?, factorPct: Int?)
  case acceptGoal(SetupGoal?)
  case skipStep(SetupStep)
  case goTo(step: SetupStep, done: Bool, from: SetupStep?)
}

extension SetupAction: Decodable {
  private enum Key: String, CodingKey {
    case type, profile, mode, email, provider, pickerProvider, consent, senders, mailboxId, mailbox
    case sources, done, total, catalogId, status, cursors, seenIds, task, messageId, attachmentId
    case name, domain, reason, lines, factorPct, goal, step, from
    case adapter, importId, file, accountIds, added, duplicates, confidence, lastDataDate, accountDataDates
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: Key.self)
    let type = try container.decode(String.self, forKey: .type)
    switch type {
    case "start": self = .start
    case "skipEmail": self = .skipEmail
    case "finishLater": self = .finishLater
    case "dismissCard": self = .dismissCard
    case "reset": self = .reset
    case "setProfile":
      self = .setProfile(try container.decode(SetupProfilePatch.self, forKey: .profile))
    case "chooseMode":
      self = .chooseMode(try container.decode(SetupMode.self, forKey: .mode))
    case "setEmail":
      self = .setEmail(
        try container.decode(String.self, forKey: .email),
        provider: try container.decodeIfPresent(InboxProvider.self, forKey: .provider),
        pickerProvider: try container.decodeIfPresent(MailProvider.self, forKey: .pickerProvider)
      )
    case "addEmail":
      self = .addEmail(try container.decode(String.self, forKey: .email))
    case "removeEmail":
      self = .removeEmail(try container.decode(String.self, forKey: .email))
    case "consentGiven":
      self = .consentGiven(
        try container.decodeIfPresent(MailboxConsent.self, forKey: .consent),
        senders: try container.decodeIfPresent(Int.self, forKey: .senders),
        mailboxId: try container.decodeIfPresent(String.self, forKey: .mailboxId)
      )
    case "mailboxConnected":
      self = .mailboxConnected(try container.decode(SetupMailbox.self, forKey: .mailbox))
    case "discoveryDone":
      self = .discoveryDone(
        mailboxId: try container.decode(String.self, forKey: .mailboxId),
        sources: try container.decode([DiscoveryHit].self, forKey: .sources)
      )
    case "syncStarted":
      self = .syncStarted(mailboxId: try container.decode(String.self, forKey: .mailboxId))
    case "syncProgress":
      self = .syncProgress(
        mailboxId: try container.decode(String.self, forKey: .mailboxId),
        done: try container.decode(Int.self, forKey: .done),
        total: try container.decode(Int.self, forKey: .total),
        catalogId: try container.decodeIfPresent(String.self, forKey: .catalogId),
        status: try container.decodeIfPresent(SourceStatus.self, forKey: .status)
      )
    case "syncDone":
      self = .syncDone(
        mailboxId: try container.decode(String.self, forKey: .mailboxId),
        cursors: try container.decodeIfPresent([String: String].self, forKey: .cursors),
        seenIds: try container.decodeIfPresent([String].self, forKey: .seenIds)
      )
    case "passwordTaskAdded":
      self = .passwordTaskAdded(
        mailboxId: try container.decode(String.self, forKey: .mailboxId),
        try container.decode(PasswordTask.self, forKey: .task)
      )
    case "passwordTaskResolved":
      self = .passwordTaskResolved(
        mailboxId: try container.decode(String.self, forKey: .mailboxId),
        messageId: try container.decode(String.self, forKey: .messageId),
        attachmentId: try container.decodeIfPresent(String.self, forKey: .attachmentId)
      )
    case "mailboxReauthNeeded":
      self = .mailboxReauthNeeded(mailboxId: try container.decode(String.self, forKey: .mailboxId))
    case "mailboxDisconnected":
      self = .mailboxDisconnected(mailboxId: try container.decode(String.self, forKey: .mailboxId))
    case "toggleSource":
      self = .toggleSource(try container.decode(String.self, forKey: .catalogId))
    case "addCustomSource":
      self = .addCustomSource(
        name: try container.decode(String.self, forKey: .name),
        domain: try container.decodeIfPresent(String.self, forKey: .domain),
        catalogId: try container.decodeIfPresent(String.self, forKey: .catalogId)
      )
    case "searchTapped":
      self = .searchTapped(try container.decode(String.self, forKey: .catalogId))
    case "importAttributed":
      self = .importAttributed(ImportAttribution(
        adapter: try container.decode(String.self, forKey: .adapter),
        catalogId: try container.decodeIfPresent(String.self, forKey: .catalogId),
        importId: try container.decodeIfPresent(String.self, forKey: .importId),
        file: try container.decode(String.self, forKey: .file),
        accountIds: try container.decodeIfPresent([String].self, forKey: .accountIds) ?? [],
        added: try container.decode(Int.self, forKey: .added),
        duplicates: try container.decode(Int.self, forKey: .duplicates),
        confidence: try container.decodeIfPresent(Double.self, forKey: .confidence),
        lastDataDate: try container.decodeIfPresent(String.self, forKey: .lastDataDate),
        accountDataDates: try container.decodeIfPresent([String: String].self, forKey: .accountDataDates)
      ))
    case "importFailed":
      self = .importFailed(
        catalogId: try container.decode(String.self, forKey: .catalogId),
        reason: try container.decodeIfPresent(String.self, forKey: .reason)
      )
    case "setSourceStatus":
      self = .setSourceStatus(
        catalogId: try container.decode(String.self, forKey: .catalogId),
        status: try container.decode(SourceStatus.self, forKey: .status),
        reason: try container.decodeIfPresent(String.self, forKey: .reason)
      )
    case "acceptBudget":
      self = .acceptBudget(
        lines: try container.decodeIfPresent([BudgetLine].self, forKey: .lines),
        factorPct: try container.decodeIfPresent(Int.self, forKey: .factorPct)
      )
    case "acceptGoal":
      self = .acceptGoal(try container.decodeIfPresent(SetupGoal.self, forKey: .goal))
    case "skipStep":
      self = .skipStep(try container.decode(SetupStep.self, forKey: .step))
    case "goTo":
      self = .goTo(
        step: try container.decode(SetupStep.self, forKey: .step),
        done: try container.decodeIfPresent(Bool.self, forKey: .done) ?? false,
        from: try container.decodeIfPresent(SetupStep.self, forKey: .from)
      )
    default:
      throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown setup action \(type)")
    }
  }
}

func initialSetup(now: String) -> SetupState {
  SetupState(
    v: 1,
    startedAt: now,
    updatedAt: now,
    completedAt: nil,
    dismissedAt: nil,
    currentStep: .welcome,
    stepsDone: [],
    stepsSkipped: [],
    profile: SetupProfile(name: "", currency: "INR"),
    mode: .mine,
    email: SetupEmail(primary: "", extra: [], provider: .other, pickerProvider: nil, skipped: false),
    sources: [],
    mailboxes: [],
    imports: [],
    events: [],
    appLock: nil,
    budgetMonths: nil,
    goalIds: nil,
    consent: nil
  )
}

func emptySource(_ catalogId: String) -> SetupSource {
  SetupSource(
    catalogId: catalogId,
    custom: nil,
    status: .todo,
    skipReason: nil,
    lastDataDate: nil,
    importIds: [],
    accountIds: [],
    searchedAt: nil,
    accountDataDates: nil
  )
}
