import Foundation

/// Anchor so `Bundle(for:)` resolves the app bundle that ships `sources.catalog.json`.
final class SourcesCatalogBundleToken {}

enum CatalogLoadError: Error, Equatable {
  case missing
}

struct CatalogSearch: Codable, Equatable {
  var id: String
  var label: String
  var subjectAny: [String]
  var attachment: Bool
  var window: String
}

struct CatalogSenders: Codable, Equatable {
  var domains: [String]
  var addresses: [String]
  var excludeDomains: [String]
}

struct CatalogImporter: Codable, Equatable {
  var formats: [String]
  var adapters: [String]
  var supported: Bool
  var note: String?
}

struct CatalogCadence: Codable, Equatable {
  var every: String
  var expectedDay: Int?
  var graceDays: Int
}

struct CatalogSource: Codable, Equatable {
  var id: String
  var name: String
  var aliases: [String]
  var region: String
  var kinds: [String]
  var accountTypes: [String]
  var senders: CatalogSenders
  var searches: [CatalogSearch]
  var importer: CatalogImporter
  var passwordHints: [String]
  var cadence: CatalogCadence
  var download: String?
  var verified: String?
}

struct CustomSource: Codable, Equatable {
  var name: String
  var domain: String?
}

struct SourcesCatalog: Codable, Equatable {
  var version: Int
  var updated: String
  var kinds: [String: String]
  var kindOrder: [String]
  var passwordHintFormats: [String: String]
  var sources: [CatalogSource]

  static func load(bundle: Bundle = Bundle(for: SourcesCatalogBundleToken.self)) throws -> SourcesCatalog {
    guard let url = catalogURL(bundle: bundle) else { throw CatalogLoadError.missing }
    return try JSONDecoder().decode(SourcesCatalog.self, from: Data(contentsOf: url))
  }

  static func rawJSON(bundle: Bundle = Bundle(for: SourcesCatalogBundleToken.self)) throws -> String {
    guard let url = catalogURL(bundle: bundle) else { throw CatalogLoadError.missing }
    guard let text = String(data: try Data(contentsOf: url), encoding: .utf8) else { throw CatalogLoadError.missing }
    return text
  }

  private static func catalogURL(bundle: Bundle) -> URL? {
    bundle.url(forResource: "sources.catalog", withExtension: "json")
      ?? bundle.url(forResource: "sources.catalog.json", withExtension: nil)
  }
}

enum SetupSources {
  static let catalog: SourcesCatalog = {
    do { return try SourcesCatalog.load() }
    catch {
      preconditionFailure("sources.catalog.json is missing from the app bundle: \(error)")
    }
  }()
}

func sourceFor(_ id: String, catalog: SourcesCatalog = SetupSources.catalog) -> CatalogSource {
  sourceFor(id: id, custom: nil, catalog: catalog)
}

func sourceFor(_ source: SetupSource, catalog: SourcesCatalog = SetupSources.catalog) -> CatalogSource {
  sourceFor(id: source.catalogId, custom: source.custom, catalog: catalog)
}

func sourceFor(id: String, custom: CustomSource?, catalog: SourcesCatalog = SetupSources.catalog) -> CatalogSource {
  if let known = catalog.sources.first(where: { $0.id == id }) { return known }
  let domain = custom?.domain
  let hasDomain = domain?.isEmpty == false
  return CatalogSource(
    id: id,
    name: custom?.name ?? id,
    aliases: [],
    region: "IN",
    kinds: ["bank"],
    accountTypes: [],
    senders: CatalogSenders(domains: hasDomain ? [domain!] : [], addresses: [], excludeDomains: []),
    searches: hasDomain
      ? [CatalogSearch(id: "statements", label: "Statements", subjectAny: ["statement"], attachment: true, window: "2y")]
      : [],
    importer: CatalogImporter(formats: ["pdf", "csv"], adapters: ["bank.generic", "card.generic"], supported: true, note: nil),
    passwordHints: [],
    cadence: CatalogCadence(every: "month", expectedDay: nil, graceDays: 10),
    download: nil,
    verified: nil
  )
}
