import AppKit
import Foundation

/// Offscreen macOS renderer for privacy shots: accessory process, borderless window never ordered front.
@MainActor @main struct PrivacyShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.prohibited)
    guard CommandLine.arguments.count == 2 else { fputs("usage: privacy-renderer <outdir>\n", stderr); exit(2) }
    do {
      let urls = try PrivacyShotRenderer.render(to: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
      print("privacy shots: \(urls.count)")
    } catch { fputs("privacy renderer failed: \(error)\n", stderr); exit(1) }
  }
}
