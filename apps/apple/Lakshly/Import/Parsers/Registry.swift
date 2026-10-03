import Foundation

let specificThreshold = 0.6

private enum RegistryStore {
  static var specifics: [Adapter] = [depositoryCas, cas, hdfcBank, sbiBank, iciciBank, hdfcCard, sbiCard]
  static let fallbacks: [Adapter] = [genericCard, genericBank]
}

func registerAdapter(_ adapter: Adapter) {
  if !RegistryStore.specifics.contains(where: { $0.id == adapter.id }) {
    RegistryStore.specifics.append(adapter)
  }
}

func listAdapters() -> [(id: String, label: String, kind: String, institution: String)] {
  (RegistryStore.specifics + RegistryStore.fallbacks).map {
    (id: $0.id, label: $0.label, kind: $0.kind, institution: $0.institution)
  }
}

func rankAdapters(_ doc: TextDoc) -> [(adapter: Adapter, score: Double)] {
  (RegistryStore.specifics + RegistryStore.fallbacks)
    .map { (adapter: $0, score: $0.detect(doc)) }
    .sorted { $0.score > $1.score }
}

func parseDocument(_ doc: TextDoc, forceAdapter: String? = nil) -> ParseResult {
  let ranked = rankAdapters(doc)
  var pick = forceAdapter.flatMap { id in ranked.first { $0.adapter.id == id } }
  if pick == nil {
    if let best = ranked.first(where: { candidate in RegistryStore.specifics.contains { $0.id == candidate.adapter.id } }),
       best.score >= specificThreshold {
      pick = best
    } else {
      pick = ranked.first { candidate in RegistryStore.fallbacks.contains { $0.id == candidate.adapter.id } }
    }
  }
  let chosen = pick ?? ranked[0]
  let body = chosen.adapter.parse(doc)
  let confidence = Double(jsRound(chosen.score * 100)) / 100
  return ParseResult(
    adapter: chosen.adapter.id,
    adapterLabel: chosen.adapter.label,
    kind: chosen.adapter.kind,
    confidence: confidence,
    accounts: body.accounts,
    transactions: body.transactions,
    sips: body.sips,
    holdings: body.holdings,
    meta: body.meta,
    warnings: body.warnings,
    accountAliases: body.accountAliases)
}

func extractPdfText(data: Data, password: String? = nil, fileName: String? = nil) throws -> TextDoc {
  try PDFTextExtractor.extract(data: data, password: password, fileName: fileName)
}
