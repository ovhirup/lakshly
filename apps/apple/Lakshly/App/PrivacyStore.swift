import SwiftUI
import Observation
import WidgetKit
#if os(iOS)
import UIKit
import ObjectiveC
#else
import AppKit
#endif

/// One process-wide store, shared by every window and every control. No entitlement checks.
@MainActor @Observable final class PrivacyStore {
  static let shared = PrivacyStore()
  @ObservationIgnored @AppStorage private var savedOn: Bool
  @ObservationIgnored @AppStorage private var savedStartHidden: Bool
  @ObservationIgnored @AppStorage private var savedShake: Bool
  @ObservationIgnored @AppStorage private var savedCapture: Bool
  @ObservationIgnored @AppStorage private var savedBlur: Bool
  @ObservationIgnored @AppStorage private var savedPercent: Bool
  @ObservationIgnored private let group: UserDefaults
  @ObservationIgnored private let reload: () -> Void
  @ObservationIgnored private var observers: [NSObjectProtocol] = []
  private var revision = 0
  var transient = false
  var revealedThisSession = false
  private(set) var toast: String?
  private var toasted = false
  private var captured = false
  private var blurred = false

  init(defaults: UserDefaults = .standard, group: UserDefaults = GlanceStore.preferences,
       reload: @escaping () -> Void = { WidgetCenter.shared.reloadAllTimelines() }) {
    _savedOn = AppStorage(wrappedValue: false, "privacy.on", store: defaults)
    _savedStartHidden = AppStorage(wrappedValue: false, "privacy.startHidden", store: defaults)
    _savedShake = AppStorage(wrappedValue: true, "privacy.shakeToHide", store: defaults)
    _savedCapture = AppStorage(wrappedValue: true, "privacy.hideWhenCaptured", store: defaults)
    _savedBlur = AppStorage(wrappedValue: false, "privacy.hideOnBlur", store: defaults)
    _savedPercent = AppStorage(wrappedValue: false, "privacy.hidePercent", store: defaults)
    self.group = group
    self.reload = reload
    GlancePreferences.migrateWidgetAmounts(in: group)
    group.set(savedOn, forKey: "privacy.on")
    observers.append(NotificationCenter.default.addObserver(forName: UserDefaults.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
      Task { @MainActor in self?.revision += 1 }
    })
    #if DEBUG
    if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-privacyOn"),
       ProcessInfo.processInfo.arguments.indices.contains(index + 1) {
      savedOn = ProcessInfo.processInfo.arguments[index + 1] == "YES"
      group.set(savedOn, forKey: "privacy.on")
    }
    #endif
    group.set(masked, forKey: "privacy.effective")
  }
  var on: Bool { _ = revision; return savedOn }
  var startHidden: Bool {
    get { _ = revision; return savedStartHidden }
    set { savedStartHidden = newValue; changed() }
  }
  var shakeToHide: Bool {
    get { _ = revision; return savedShake }
    set { savedShake = newValue; changed() }
  }
  var hideWhenCaptured: Bool {
    get { _ = revision; return savedCapture }
    set { savedCapture = newValue; refreshTransient(); changed() }
  }
  var hideOnBlur: Bool {
    get { _ = revision; return savedBlur }
    set { savedBlur = newValue; refreshTransient(); changed() }
  }
  var hidePercent: Bool {
    get { _ = revision; return savedPercent }
    set { savedPercent = newValue; changed() }
  }
  var widgetAmounts: Bool {
    get { _ = revision; return group.string(forKey: "privacy.widgetAmounts") == "shown" }
    set { group.set(newValue ? "shown" : "hidden", forKey: "privacy.widgetAmounts"); changed() }
  }
  var masked: Bool { Self.effectiveMask(on: on, transient: transient, startHidden: startHidden, revealed: revealedThisSession) }
  static func effectiveMask(on: Bool, transient: Bool, startHidden: Bool, revealed: Bool) -> Bool {
    on || transient || (startHidden && !revealed)
  }
  func setPrivacy(_ on: Bool, source: String) {
    savedOn = on
    if !on { revealedThisSession = true }
    changed()
    AccessibilityNotification.Announcement(masked ? "Amounts hidden" : "Amounts shown").post()
    #if os(iOS)
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    #endif
    if on && !toasted {
      toasted = true
      toast = "Amounts hidden · tap 👁 to show"
      Task { @MainActor [weak self] in
        try? await Task.sleep(for: .seconds(2))
        self?.toast = nil
      }
    }
  }
  func noteLocked() { if startHidden { revealedThisSession = false; changed() } }
  func noteCapture(_ value: Bool) { captured = value; refreshTransient(); changed() }
  func noteBlur(_ value: Bool) { blurred = value; refreshTransient(); changed() }
  private func refreshTransient() { transient = (captured && hideWhenCaptured) || (blurred && hideOnBlur) }
  private func changed() {
    revision += 1
    group.set(on, forKey: "privacy.on")
    // Also communicate the effective runtime mask so a revealed widget cannot leak during capture.
    group.set(masked, forKey: "privacy.effective")
    reload()
  }
}

private struct PrivacyKey: EnvironmentKey {
  static var defaultValue: PrivacyStore { MainActor.assumeIsolated { PrivacyStore.shared } }
}
extension EnvironmentValues {
  var privacy: PrivacyStore {
    get { self[PrivacyKey.self] }
    set { self[PrivacyKey.self] = newValue }
  }
}

/// String adapter also covers compound labels and percentages without placing real digits in Text.
struct MoneyText: View {
  @Environment(\.privacy) private var privacy
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let value: String
  init(_ value: String) { self.value = value }
  var body: some View {
    let displayed = Money.redact(value, masked: privacy.masked, hidePercent: privacy.hidePercent)
    let hidden = privacy.masked && (value.contains("₹") || value.contains(Money.mask))
    Text(displayed)
      .monospaced(hidden)
      .accessibilityLabel(hidden ? Money.hiddenLabel : displayed)
      .contentTransition(.opacity)
      .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: displayed)
  }
}

struct PrivacyToggle: View {
  @Environment(\.privacy) private var privacy
  var body: some View {
    Button(privacy.masked ? "Show amounts" : "Hide amounts", systemImage: privacy.masked ? "eye.slash" : "eye") {
      privacy.setPrivacy(!privacy.masked, source: "button")
    }
    .labelStyle(.iconOnly)
    .accessibilityIdentifier("privacy.toggle")
    .accessibilityAddTraits(.isToggle)
    .accessibilityAddTraits(privacy.masked ? .isSelected : [])
  }
}

/// Scene snapshots always get a single opaque cover; capture/blur only alter transient state.
struct PrivacyLifecycle: ViewModifier {
  @Environment(\.privacy) private var privacy
  @Environment(\.scenePhase) private var phase
  @Environment(\.theme) private var theme
  func body(content: Content) -> some View {
    content
      .overlay(alignment: .bottom) {
        if let toast = privacy.toast { Text(toast).padding().background(theme.bg, in: Capsule()).padding().allowsHitTesting(false) }
      }
      #if os(iOS)
      .overlay {
        if phase != .active {
          ZStack {
            theme.bg.ignoresSafeArea()
            Image(systemName: "indianrupeesign.circle.fill").font(.system(size: 72)).foregroundStyle(theme.gold)
          }.accessibilityLabel("Lakshly privacy cover").accessibilityIdentifier("privacy.cover")
        }
      }
      .onAppear { privacy.noteCapture(UIScreen.main.isCaptured) }
      .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
        privacy.noteCapture(UIScreen.main.isCaptured)
      }
      .onReceive(NotificationCenter.default.publisher(for: .privacyShake)) { _ in
        if privacy.shakeToHide { privacy.setPrivacy(true, source: "shake") }
      }
      .background(PrivacyShakeInstaller())
      #else
      .onReceive(NotificationCenter.default.publisher(for: NSWindow.didResignKeyNotification)) { _ in privacy.noteBlur(true) }
      .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in privacy.noteBlur(false) }
      #endif
  }
}
#if os(iOS)
extension Notification.Name { static let privacyShake = Notification.Name("LakshlyPrivacyShake") }
// Install a UIWindow motionEnded hook once. Forwarding preserves UIKit's Shake to Undo.
private enum PrivacyShakeHook {
  static let install: Void = {
    let original = #selector(UIWindow.motionEnded(_:with:))
    let replacement = #selector(UIWindow.lakshlyPrivacyMotionEnded(_:with:))
    guard let inherited = class_getInstanceMethod(UIWindow.self, original),
          let hook = class_getInstanceMethod(UIWindow.self, replacement) else { return }
    class_addMethod(UIWindow.self, original, method_getImplementation(inherited), method_getTypeEncoding(inherited))
    guard let own = class_getInstanceMethod(UIWindow.self, original) else { return }
    method_exchangeImplementations(own, hook)
  }()
}
extension UIWindow {
  @objc fileprivate func lakshlyPrivacyMotionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
    lakshlyPrivacyMotionEnded(motion, with: event)
    func editing(_ view: UIView) -> Bool {
      if view.isFirstResponder && (view is UITextField || view is UITextView) { return true }
      return view.subviews.contains(where: editing)
    }
    guard motion == .motionShake, !editing(self) else { return }
    NotificationCenter.default.post(name: .privacyShake, object: nil)
  }
}
private struct PrivacyShakeInstaller: UIViewRepresentable {
  func makeUIView(context: Context) -> UIView {
    _ = PrivacyShakeHook.install
    return UIView(frame: .zero)
  }
  func updateUIView(_ uiView: UIView, context: Context) {}
}
#endif
