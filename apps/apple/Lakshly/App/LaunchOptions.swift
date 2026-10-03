import Foundation

/// Screenshot controls are parsed directly, never through persisted preferences.
struct LaunchOptions {
  var appearance: String?
  var theme: String?

  #if DEBUG
  var demoUnlocked: Bool?
  var showLock: Bool?
  var startTab: String?
  var openSettings: Bool?
  /// Presents the general paywall at launch. Screenshot control only; it does not grant Premium.
  var showPaywall: Bool?
  var importDemo: String?
  var importDemoFile: String?
  var feedbackDemo: Bool?
  var appIconDemo: String?
  var settingsScroll: String?
  /// Screenshot control: force Demo data or My data. Ignored in Release.
  var dataSource: String?

  static func parse(arguments: [String]) -> LaunchOptions {
    var options = LaunchOptions()
    var index = 1 // The first argument is the executable path.
    while index + 1 < arguments.count {
      let key = arguments[index]
      let value = arguments[index + 1]
      guard key.hasPrefix("-"), !value.hasPrefix("-") else {
        index += 1
        continue
      }
      switch String(key.dropFirst()) {
      case "demoUnlocked": options.demoUnlocked = parseBool(value)
      case "showLock": options.showLock = parseBool(value)
      case "startTab": options.startTab = value
      case "openSettings": options.openSettings = parseBool(value)
      case "showPaywall": options.showPaywall = parseBool(value)
      case "importDemo": options.importDemo = value
      case "importDemoFile": options.importDemoFile = value
      case "appIconDemo": options.appIconDemo = value
      case "settingsScroll": options.settingsScroll = value
      case "feedbackDemo": options.feedbackDemo = parseBool(value)
      case "dataSource":
        if value == "demo" || value == "mine" { options.dataSource = value }
      case "appearance": options.appearance = value
      case "theme": options.theme = value
      default: break
      }
      index += 2
    }
    return options
  }

  private static func parseBool(_ value: String) -> Bool? {
    switch value.lowercased() {
    case "yes", "true", "1": true
    case "no", "false", "0": false
    default: nil
    }
  }
  #endif

  static var current: LaunchOptions {
    #if DEBUG
    parse(arguments: ProcessInfo.processInfo.arguments)
    #else
    LaunchOptions()
    #endif
  }
}
