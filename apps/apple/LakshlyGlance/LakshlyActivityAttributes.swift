#if os(iOS)
import ActivityKit
import Foundation

/// Shared by the iOS app and the widget extension so ActivityKit sees one type.
public struct LakshlyActivityAttributes: ActivityAttributes {
  public enum Kind: String, Codable, Hashable, Sendable {
    case bill
    case budget
  }

  public struct ContentState: Codable, Hashable, Sendable {
    public var title: String
    public var subtitle: String
    public var progress: Double
    /// Present only when Lock Screen amounts are allowed.
    public var amount: String?

    public init(title: String, subtitle: String, progress: Double, amount: String?) {
      self.title = title
      self.subtitle = subtitle
      self.progress = progress
      self.amount = amount
    }
  }

  public var kind: Kind

  public init(kind: Kind) {
    self.kind = kind
  }
}
#endif
