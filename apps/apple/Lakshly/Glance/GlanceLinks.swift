import Foundation

enum GlanceNavEffect: Equatable {
  case ignore
  case select(String)
  case deferUntilUnlock(String)
  case openSetup(step: String?)
  case deferSetup(step: String?)
}

enum SetupDeepLink: Equatable {
  case open(step: String?)
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

  static let setupSteps: Set<String> = ["welcome", "email", "accounts", "import", "plan", "done"]

  /// `lakshly://setup` and `lakshly://setup?step=email`. An unknown step opens the wizard where it already is.
  static func setupLink(from url: URL) -> SetupDeepLink? {
    guard url.scheme?.lowercased() == scheme else { return nil }
    let host = url.host?.trimmingCharacters(in: CharacterSet(charactersIn: "/")) ?? ""
    let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let raw = host.isEmpty ? path : host
    let head = raw.split(separator: "/").first.map { String($0).lowercased() } ?? ""
    guard head == "setup" else { return nil }
    let step = URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?
      .first { $0.name == "step" }?
      .value?
      .lowercased()
    if let step, setupSteps.contains(step) { return .open(step: step) }
    return .open(step: nil)
  }

  static func effect(for url: URL, locked: Bool) -> GlanceNavEffect {
    if let link = setupLink(from: url) {
      switch link {
      case .open(let step):
        return locked ? .deferSetup(step: step) : .openSetup(step: step)
      }
    }
    guard let tab = tab(from: url) else { return .ignore }
    return locked ? .deferUntilUnlock(tab) : .select(tab)
  }

  static func url(for tab: String) -> URL? {
    URL(string: "\(scheme)://\(tab)")
  }
}
