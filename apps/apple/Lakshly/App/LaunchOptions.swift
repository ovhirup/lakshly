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
