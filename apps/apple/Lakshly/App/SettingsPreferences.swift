import Foundation

enum SettingsPreferences {
  /// Must run before constructing any AppStorage, State or observable app models.
  static func prepare(defaults: UserDefaults = .standard,
                      domainName: String? = Bundle.main.bundleIdentifier) {
    #if !DEBUG
    defaults.removeVolatileDomain(forName: UserDefaults.argumentDomain)
    #else
    // DEBUG screenshot controls also use LaunchOptions exclusively. Never migrate
    // an argument-domain value or let a launch argument override an AppStorage key.
    defaults.removeVolatileDomain(forName: UserDefaults.argumentDomain)
    #endif
    // Some Foundation versions retain NSArgumentDomain after removal. Explicitly
    // replace it too, so even namespaced launch arguments cannot override settings.
    defaults.setVolatileDomain([:], forName: UserDefaults.argumentDomain)
    // Read only the persistent application domain, never launch/registration defaults.
    let persisted = domainName.flatMap { defaults.persistentDomain(forName: $0) } ?? [:]
    for key in ["appLock", "premium", "themeID", "appearance"] {
      let destination = "settings." + key
      if persisted[destination] == nil, let previous = persisted[key] {
        defaults.set(previous, forKey: destination)
      }
      defaults.removeObject(forKey: key)
    }
    // The retired demo toggle must not linger and grant nothing. Premium comes from StoreKit.
    defaults.removeObject(forKey: "settings.premium")
  }
}
