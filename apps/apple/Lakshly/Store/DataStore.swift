import Foundation
import Observation

@MainActor @Observable final class DataStore {
  var dataset: Dataset?
  var requests: [CommunityRequest] = []
  var error: String?
  var selectedMonth = "2026-09"
  private let secure = SecureStore()
  private var writable = true
  var encryptionStatus: String {
    secure.keys.persisted
      ? (secure.keys.enclaveWrapped
        ? "AES-GCM · Secure Enclave wrapped key" : "AES-GCM · Keychain key")
      : "Encryption key not persisted (dev build)"
  }
  var months: [String] {
    Array(Set((dataset?.transactions ?? []).map { String($0.date.prefix(7)) })).sorted()
  }
  var transactions: [Transaction] {
    (dataset?.transactions ?? []).filter { $0.date.hasPrefix(selectedMonth) }
  }
  var categoryTotals: [AmountGroup] {
    totals(transactions.filter { $0.amount < 0 }, by: { $0.category })
  }
  func totals(_ transactions: [Transaction], by group: (Transaction) -> String) -> [AmountGroup] {
    Dictionary(grouping: transactions, by: group).map {
      AmountGroup(name: $0.key, amount: $0.value.reduce(0) { $0 + abs($1.amount) })
    }.sorted { $0.amount > $1.amount }
  }
  init() {
    do {
      if let saved = try secure.load() {
        dataset = saved.dataset
        requests = saved.requests
      } else {
        try seed()
      }
    } catch {
      writable = false
      self.error =
        "Saved data could not be opened. Demo data is shown; your saved file is preserved. Reset demo data to replace it."
      try? seed(persist: false)
    }
  }
  private func seed(persist: Bool = true) throws {
    guard let url = Bundle.main.url(forResource: "sample.synthetic", withExtension: "json") else {
      throw CocoaError(.fileNoSuchFile)
    }
    dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: url))
    requests = zip(
      [
        "Category colours", "SIP reminders", "Larger type", "Rollover clarity", "Search merchants",
        "Debt milestones",
      ], ["Asha R.", "Dev M.", "Mira K.", "Sam T.", "Ira P.", "Nila S."]
    ).enumerated().map { index, pair in
      CommunityRequest(
        title: pair.0, details: "A synthetic community suggestion for a calmer finance experience.",
        type: index == 2 ? "Bug" : "Feature", author: pair.1, priority: index == 1 || index == 4,
        status: ["Shipped", "Planned", "In progress", "Received", "Shipped", "Received"][index])
    }
    if persist { save() }
  }
  func save() {
    guard writable, let dataset else { return }
    do {
      try secure.save(StoredData(dataset: dataset, requests: requests))
      error = nil
    } catch { self.error = "Could not save locally: \(error.localizedDescription)" }
    GlancePublisher.publish(dataset: dataset)
  }
  func submit(title: String, details: String, type: String, premium: Bool) -> Bool {
    requests.append(
      CommunityRequest(
        title: title, details: details, type: type, author: "Demo user", priority: premium,
        status: "Received"))
    save()
    if error != nil {
      requests.removeLast()
      return false
    }
    return true
  }
  func reset() {
    writable = true
    do { try seed() } catch { self.error = error.localizedDescription }
  }
}
