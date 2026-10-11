import AppKit
import Foundation

@MainActor @main struct TierShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.accessory)
    guard CommandLine.arguments.count == 2 else {
      fputs("usage: tier-renderer <outdir>\n", stderr); exit(2)
    }
    do { try TierShotRenderer.render(to: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)) }
    catch { fputs("tier renderer failed: \(error)\n", stderr); exit(1) }
  }
}
