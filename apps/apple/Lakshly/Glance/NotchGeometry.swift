import CoreGraphics
import Foundation

/// One display, in AppKit's bottom-left screen coordinates. No AppKit types, so iOS tests can run this.
struct NotchScreenDescriptor: Equatable, Sendable {
  var frame: CGRect
  var safeAreaTop: CGFloat
  var auxiliaryTopLeftArea: CGRect?
  var auxiliaryTopRightArea: CGRect?
  var isBuiltIn: Bool
}

struct NotchLayout: Equatable, Sendable {
  /// The camera housing: the gap between the auxiliary areas, inset from the top edge.
  var notchRect: CGRect
  /// The expanded panel. Centred on the notch, top flush with the screen, kept inside the frame.
  var panelRect: CGRect
}

enum NotchGeometry {
  /// `nil` when this display has no notch: the top inset is 0, either auxiliary area is missing,
  /// or the two areas do not leave a gap.
  static func layout(
    frame: CGRect,
    safeAreaTop: CGFloat,
    auxiliaryTopLeftArea: CGRect?,
    auxiliaryTopRightArea: CGRect?,
    panelSize: CGSize
  ) -> NotchLayout? {
    guard safeAreaTop > 0, let left = auxiliaryTopLeftArea, let right = auxiliaryTopRightArea else { return nil }
    let gap = right.minX - left.maxX
    guard gap > 0 else { return nil }
    let notch = CGRect(x: left.maxX, y: frame.maxY - safeAreaTop, width: gap, height: safeAreaTop)
    return NotchLayout(notchRect: notch, panelRect: panel(around: notch, in: frame, size: panelSize))
  }

  /// The notched display to anchor on. A built-in notched display wins over an external one.
  static func notchedScreen(in screens: [NotchScreenDescriptor]) -> NotchScreenDescriptor? {
    let notched = screens.filter(isNotched)
    if let builtIn = notched.first(where: \.isBuiltIn) { return builtIn }
    return notched.first
  }

  static func isNotched(_ screen: NotchScreenDescriptor) -> Bool {
    layout(
      frame: screen.frame,
      safeAreaTop: screen.safeAreaTop,
      auxiliaryTopLeftArea: screen.auxiliaryTopLeftArea,
      auxiliaryTopRightArea: screen.auxiliaryTopRightArea,
      panelSize: CGSize(width: 1, height: 1)) != nil
  }

  private static func panel(around notch: CGRect, in frame: CGRect, size: CGSize) -> CGRect {
    var width = max(0, size.width)
    var height = max(0, size.height)
    if width > frame.width { width = frame.width }
    if height > frame.height { height = frame.height }
    var originX = notch.midX - width / 2
    // Top edge stays flush with the screen top (bottom-left origin: maxY is the top).
    let originY = frame.maxY - height
    if originX < frame.minX { originX = frame.minX }
    if originX + width > frame.maxX { originX = frame.maxX - width }
    return CGRect(x: originX, y: originY, width: width, height: height)
  }
}
