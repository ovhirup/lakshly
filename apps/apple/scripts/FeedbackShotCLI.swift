import SwiftUI
import AppKit
import Foundation

private struct FeedbackShotTransport: FeedbackTransporting {
  func send(_ payload: FeedbackPayload, clientHeader: String) async throws -> FeedbackReceipt { throw FeedbackTransportError.network }
  func fetchStatus(id: String, secret: String, clientHeader: String) async throws -> FeedbackRemoteStatus? { nil }
}
private final class FeedbackShotSecrets: FeedbackSecretStoring {
  func save(_ secret: String, for id: String) throws {}
  func secret(for id: String) throws -> String? { nil }
}
@MainActor @main struct FeedbackShotCLI {
  static func main() throws {
    guard CommandLine.arguments.count == 3 else { throw NSError(domain: "feedback shots usage: outdir roadmap.json", code: 2) }
    let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    let roadmap = try JSONDecoder().decode(FeedbackRoadmap.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2])))
    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    let date = ISO8601DateFormatter().date(from: "2026-10-03T12:30:00Z")!
    let mine = [
      FeedbackRequest(id: "LK-7Q4M2K", kind: .idea, title: "Hide amounts with one tap", area: "Design", createdAt: date, premium: true, status: .shipped,
        replies: [FeedbackHelpers.autoAck(at: "2026-09-02", premium: true), .init(from: "team", name: "Abhirup from Lakshly", at: "2026-09-29", text: "You asked, we built it! Tap the eye on Overview. Thank you, Kavya 💛")]),
      FeedbackRequest(id: "LK-9DX3TA", kind: .idea, title: "Remind me 3 days before card due dates", area: "Credit", createdAt: date, premium: true, status: .planned,
        replies: [.init(from: "team", name: "Abhirup from Lakshly", at: "2026-09-19", text: "Thank you! Planned for the next beta. Would 3 days and 1 day before both be useful?")]),
      FeedbackRequest(id: "LK-H2V8NC", kind: .bug, title: "Refund shows twice after import", area: "Import", createdAt: date, premium: true, status: .inProgress,
        replies: [.init(from: "team", name: "Abhirup from Lakshly", at: "2026-09-28", text: "Thanks for the clear steps, I can reproduce it. A fix is in progress; I'll tell you when it ships.")])
    ]
    for (theme, scheme) in [(ThemeID.lakshmi, ColorScheme.dark), (.monochromeGold, .light)] {
      for width in [390.0, 900.0] {
        for name in ["hub-premium", "hub-free", "form-idea", "form-bug-sensitive", "sent-premium", "mine", "send-failed"] {
          let screen: FeedbackScreen = name.hasPrefix("form") ? .form : name == "sent-premium" ? .sent : name == "mine" ? .mine : name == "send-failed" ? .failed : .hub
          let draft = name == "form-bug-sensitive"
            ? FeedbackDraft(kind: .bug, title: "Refund shows twice after import", detail: "Synthetic example 4111 1111 1111 1111. Steps: import twice. Expected: one refund.", area: "Import")
            : FeedbackDraft(kind: .idea, title: "Hide amounts with one tap", detail: "So I can open the app on the metro without everyone seeing my balance.", area: "Design")
          let height = width == 390 ? 2400.0 : 1900.0
          let view = FeedbackCanvas(premium: name != "hub-free", requests: FeedbackRequestStore(file: nil, secrets: FeedbackShotSecrets(), requests: mine),
            transport: FeedbackShotTransport(), roadmap: roadmap, screen: screen, draft: draft,
            sent: .init(id: "LK-ABC123", kind: .idea, title: draft.title, area: draft.area, createdAt: date, premium: true, status: .received, replies: []))
            .environment(\.setupRendering, true).environment(\.theme, ThemePalette(theme, scheme: scheme)).environment(\.colorScheme, scheme)
            .preferredColorScheme(scheme)
            .frame(width: width, height: height, alignment: .top)
          let renderer = ImageRenderer(content: view); renderer.scale = 2
          guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff), let data = bitmap.representation(using: .png, properties: [:]) else {
              throw NSError(domain: "Feedback image rendering", code: 1)
          }
          let filename = "\(width == 390 ? "iphone" : "mac")-\(theme.rawValue)-\(scheme == .dark ? "dark" : "light")-\(name).png"
          try data.write(to: output.appendingPathComponent(filename))
          print(filename)
        }
      }
    }
    print("feedback shots: 28 images; offscreen, fictional data, stub transport")
  }
}
