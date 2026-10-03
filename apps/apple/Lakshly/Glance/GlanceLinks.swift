import Foundation

enum GlanceNavEffect: Equatable {
  case ignore
  case select(String)
  case deferUntilUnlock(String)
}

enum GlanceLinks {
  static let scheme = "lakshly"
  static let tabs: Set<String> = [
    "overview", "spend", "budget", "debt", "credit", "investments", "rewards", "history", "feedback", "import",
  ]

  static func tab(from url: URL) -> String? {
    guard url.scheme?.lowercased() == scheme else { return nil }
    let host = url.host?.trimmingCharacters(in: CharacterSet(charactersIn: "/")) ?? ""
    let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let raw = host.isEmpty ? path : host
    let tab = raw.split(separator: "/").first.map { String($0).lowercased() } ?? ""
    return tabs.contains(tab) ? tab : nil
  }

  static func effect(for url: URL, locked: Bool) -> GlanceNavEffect {
    guard let tab = tab(from: url) else { return .ignore }
    return locked ? .deferUntilUnlock(tab) : .select(tab)
  }

  static func url(for tab: String) -> URL? {
    URL(string: "\(scheme)://\(tab)")
  }
}
