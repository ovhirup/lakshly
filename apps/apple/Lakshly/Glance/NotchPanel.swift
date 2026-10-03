#if os(macOS)
import AppKit
import CoreGraphics
import SwiftUI

extension EnvironmentValues {
  @Entry var notchPanel: NotchPanelController? = nil
}

enum NotchScreens {
  static var hasNotch: Bool { NotchGeometry.notchedScreen(in: current()) != nil }

  static func current() -> [NotchScreenDescriptor] {
    NSScreen.screens.map { screen in
      NotchScreenDescriptor(
        frame: screen.frame,
        safeAreaTop: screen.safeAreaInsets.top,
        auxiliaryTopLeftArea: usable(screen.auxiliaryTopLeftArea),
        auxiliaryTopRightArea: usable(screen.auxiliaryTopRightArea),
        isBuiltIn: screen.cgDirectDisplayID.map { CGDisplayIsBuiltin($0) != 0 } ?? false)
    }
  }

  private static func usable(_ rect: CGRect?) -> CGRect? {
    guard let rect, rect.width > 1, rect.height > 1 else { return nil }
    return rect
  }
}

/// Borderless panels over the notch. Showing them never activates Lakshly and never makes a window key.
@MainActor final class NotchPanelController {
  private let session: GlanceRevealSession
  private var revealState = NotchRevealState.disabled
  private var entitled = false
  private var showsNetWorth = false
  private var tier: Tier = .free
  private var theme = ThemePalette()
  private var appearance = "system"
  private var loadDataset: () throws -> Dataset = { throw CocoaError(.fileReadNoSuchFile) }
  private var screens: () -> [NotchScreenDescriptor] = { NotchScreens.current() }
  private var capHeight: CGFloat = 28
  private var contentFrame = CGRect.zero
  private var expanded = false
  private var authenticating = false
  private var observersInstalled = false
  private var hoverTask: Task<Void, Never>?
  private var leaveTask: Task<Void, Never>?
  private var expiryTask: Task<Void, Never>?
  private var hot: NSPanel?
  private var contentPanel: NSPanel?
  private var hosting: NotchHostingView?
  private var localMonitor: Any?
  private var centerTokens: [NSObjectProtocol] = []
  private var workspaceTokens: [NSObjectProtocol] = []
  private var distributedTokens: [NSObjectProtocol] = []

  init() {
    let session = GlanceRevealSession(authenticator: DeviceOwnerAuthenticator())
    session.duration = NotchRevealPolicy.revealDuration
    self.session = session
  }

  func start(loadDataset: @escaping () throws -> Dataset) {
    self.loadDataset = loadDataset
    installObservers()
    refresh()
  }

  func refreshFromPreferences() { refresh() }

  func update(entitled: Bool, showsNetWorth: Bool, tier: Tier, theme: ThemePalette, appearance: String) {
    self.entitled = entitled
    self.showsNetWorth = showsNetWorth
    self.tier = tier
    self.theme = theme
    self.appearance = appearance
    refresh()
  }

  func noteAppLocked() { apply(.lock) }

  private func refresh() {
    let enabled = GlancePreferences.notchPanel(in: GlanceStore.preferences)
    let hasNotch = NotchGeometry.notchedScreen(in: screens()) != nil
    apply(.configure(enabled: enabled, entitled: entitled, hasNotch: hasNotch))
  }

  private func apply(_ event: NotchRevealEvent) {
    let next = NotchRevealPolicy.reduce(revealState, event)
    if revealState.isRevealed && !next.isRevealed {
      session.hide()
      expiryTask?.cancel()
    }
    revealState = next
    guard next.panelEnabled else {
      removePanels()
      return
    }
    switch event {
    case .collapse:
      collapsePanel(animated: true)
    case .lock, .sleep, .spaceChange:
      collapsePanel(animated: false)
      layout()
    default:
      layout()
    }
    renderFace()
  }

  private func layout() {
    guard let screen = NotchGeometry.notchedScreen(in: screens()) else {
      removePanels()
      return
    }
    let size = CGSize(width: NotchMetrics.width, height: NotchMetrics.bodyHeight + screen.safeAreaTop)
    guard let placed = NotchGeometry.layout(
      frame: screen.frame,
      safeAreaTop: screen.safeAreaTop,
      auxiliaryTopLeftArea: screen.auxiliaryTopLeftArea,
      auxiliaryTopRightArea: screen.auxiliaryTopRightArea,
      panelSize: size) else {
      removePanels()
      return
    }
    capHeight = max(screen.safeAreaTop, 1)
    contentFrame = placed.panelRect
    ensureHot(frame: placed.notchRect)
    if expanded {
      contentPanel?.setFrame(contentFrame, display: true)
      contentPanel?.orderFrontRegardless()
    }
  }

  private func expand() {
    guard revealState.panelEnabled, !expanded else { return }
    layout()
    guard contentFrame.width > 1, contentFrame.height > 1 else { return }
    expanded = true
    ensureContent()
    let full = contentFrame
    let start = CGRect(x: full.minX, y: full.maxY - 1, width: full.width, height: 1)
    contentPanel?.setFrame(start, display: false)
    contentPanel?.orderFrontRegardless()
    renderFace()
    guard let contentPanel else { return }
    if reducesMotion {
      contentPanel.setFrame(full, display: true)
    } else {
      NSAnimationContext.runAnimationGroup { context in
        context.duration = 0.28
        context.timingFunction = CAMediaTimingFunction(name: .easeOut)
        contentPanel.animator().setFrame(full, display: true)
      }
    }
  }

  private func collapsePanel(animated: Bool) {
    hoverTask?.cancel()
    leaveTask?.cancel()
    guard expanded, let contentPanel else {
      expanded = false
      return
    }
    expanded = false
    let end = CGRect(x: contentPanel.frame.minX, y: contentPanel.frame.maxY - 1, width: contentPanel.frame.width, height: 1)
    if animated && !reducesMotion {
      NSAnimationContext.runAnimationGroup { context in
        context.duration = 0.22
        contentPanel.animator().setFrame(end, display: true)
      } completionHandler: { [weak contentPanel] in
        Task { @MainActor in contentPanel?.orderOut(nil) }
      }
    } else {
      contentPanel.orderOut(nil)
    }
  }

  private func removePanels() {
    hoverTask?.cancel()
    leaveTask?.cancel()
    expiryTask?.cancel()
    session.hide()
    revealState = .disabled
    expanded = false
    authenticating = false
    hot?.orderOut(nil)
    contentPanel?.orderOut(nil)
    hot = nil
    contentPanel = nil
    hosting = nil
  }

  private var reducesMotion: Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }

  private func ensureHot(frame: CGRect) {
    if hot == nil {
      let panel = makePanel(frame: frame)
      let hit = NotchHitView(frame: NSRect(origin: .zero, size: frame.size))
      hit.onEntered = { [weak self] in self?.pointerEntered(content: false) }
      hit.onExited = { [weak self] in self?.pointerExited() }
      hit.onClick = { [weak self] in self?.clickHot() }
      panel.contentView = hit
      hot = panel
    }
    hot?.setFrame(frame, display: true)
    hot?.orderFrontRegardless()
  }

  private func ensureContent() {
    guard contentPanel == nil else { return }
    let panel = makePanel(frame: contentFrame)
    let hit = NotchHitView(frame: NSRect(origin: .zero, size: contentFrame.size))
    hit.onEntered = { [weak self] in self?.pointerEntered(content: true) }
    hit.onExited = { [weak self] in self?.pointerExited() }
    let host = NotchHostingView(rootView: AnyView(EmptyView()))
    host.safeAreaRegions = []
    host.autoresizingMask = [.width, .height]
    host.frame = hit.bounds
    hit.addSubview(host)
    panel.contentView = hit
    contentPanel = panel
    hosting = host
  }

  /// `orderFrontRegardless` only. No `NSApp.activate`, no `makeKey`.
  private func makePanel(frame: CGRect) -> NSPanel {
    let panel = NSPanel(
      contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    panel.level = .statusBar
    panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = false
    panel.hidesOnDeactivate = false
    panel.becomesKeyOnlyIfNeeded = true
    panel.isMovable = false
    panel.isMovableByWindowBackground = false
    panel.isReleasedWhenClosed = false
    panel.isExcludedFromWindowsMenu = true
    panel.animationBehavior = .none
    return panel
  }

  private func renderFace() {
    guard let hosting else { return }
    let model = currentModel()
    let message = session.message
    let cap = capHeight
    hosting.rootView = AnyView(
      NotchPanelFace(content: model, message: message, capHeight: cap) { [weak self] in
        self?.toggleReveal()
      }
      .environment(\.theme, theme)
    )
  }

  private func currentModel() -> NotchGlanceContent {
    let revealed = session.isRevealed && revealState.panelEnabled
    let source = (revealed ? session.snapshot : nil) ?? builtSnapshot()
    guard let source else {
      return NotchGlanceContent(
        paceWord: "On track", pace: .onTrack, spendPercent: 0, elapsedPercent: 0,
        budgetUsedText: "0% used", monthProgressText: "0% of the month",
        safeToSpend: nil, upcomingTitle: nil, upcomingLabel: nil, upcomingDate: nil, upcomingAmount: nil,
        showsNetWorth: showsNetWorth, netWorthTrend: nil, netWorth: nil, revealed: false)
    }
    // The in-memory snapshot may hold amounts. The model copies them into text only while revealed.
    return NotchGlanceModel.make(snapshot: source, revealed: revealed, showsNetWorth: showsNetWorth)
  }

  private func builtSnapshot() -> GlanceSnapshot? {
    guard let dataset = try? loadDataset() else { return nil }
    return GlanceBuilder.build(
      dataset: dataset, now: Date(), includeAmounts: true, tier: tier,
      themeID: theme.id.rawValue, appearance: appearance)
  }

  private func toggleReveal() {
    if session.isRevealed {
      session.hide()
      expiryTask?.cancel()
      revealState = NotchRevealPolicy.hidingAmounts(revealState)
      renderFace()
      return
    }
    guard revealState.panelEnabled else { return }
    authenticating = true
    let tier = self.tier
    let themeID = theme.id.rawValue
    let appearance = self.appearance
    Task { @MainActor in
      await session.reveal(tier: tier, themeID: themeID, appearance: appearance) { [weak self] in
        guard let self else { throw CocoaError(.fileReadNoSuchFile) }
        return try self.loadDataset()
      }
      authenticating = false
      if session.isRevealed && revealState.panelEnabled {
        revealState = NotchRevealPolicy.reduce(revealState, .reveal(now: Date()))
        armExpiry()
      }
      renderFace()
      if expanded && !pointerInside() { pointerExited() }
    }
  }

  private func armExpiry() {
    expiryTask?.cancel()
    expiryTask = Task { @MainActor in
      while !Task.isCancelled {
        try? await Task.sleep(for: .seconds(1))
        guard !Task.isCancelled else { return }
        session.expireIfNeeded()
        if !session.isRevealed {
          revealState = NotchRevealPolicy.hidingAmounts(revealState)
          renderFace()
          return
        }
      }
    }
  }

  private func clickHot() {
    hoverTask?.cancel()
    hoverTask = nil
    expand()
  }

  private func pointerEntered(content: Bool) {
    leaveTask?.cancel()
    if content || expanded {
      hoverTask?.cancel()
      hoverTask = nil
      return
    }
    guard hoverTask == nil else { return }
    hoverTask = Task { @MainActor in
      try? await Task.sleep(for: .seconds(NotchMetrics.hoverDelay))
      guard !Task.isCancelled else { return }
      hoverTask = nil
      expand()
    }
  }

  private func pointerExited() {
    hoverTask?.cancel()
    hoverTask = nil
    guard expanded else { return }
    leaveTask?.cancel()
    leaveTask = Task { @MainActor in
      try? await Task.sleep(for: .seconds(NotchMetrics.leaveDelay))
      guard !Task.isCancelled else { return }
      if authenticating { return }
      if !pointerInside() { apply(.collapse) }
    }
  }

  private func pointerInside() -> Bool {
    let point = NSEvent.mouseLocation
    if let hot, hot.isVisible, hot.frame.contains(point) { return true }
    if expanded, let contentPanel, contentPanel.isVisible, contentPanel.frame.contains(point) { return true }
    return false
  }

  private func installObservers() {
    guard !observersInstalled else { return }
    observersInstalled = true
    let center = NotificationCenter.default
    centerTokens.append(center.addObserver(
      forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
    ) { [weak self] _ in
      Task { @MainActor in self?.refresh() }
    })
    let workspace = NSWorkspace.shared.notificationCenter
    for name in [NSWorkspace.screensDidSleepNotification, NSWorkspace.willSleepNotification] {
      workspaceTokens.append(workspace.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        Task { @MainActor in self?.apply(.sleep) }
      })
    }
    workspaceTokens.append(workspace.addObserver(
      forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      Task { @MainActor in self?.apply(.spaceChange) }
    })
    distributedTokens.append(DistributedNotificationCenter.default().addObserver(
      forName: Notification.Name("com.apple.screenIsLocked"), object: nil, queue: .main
    ) { [weak self] _ in
      Task { @MainActor in self?.apply(.lock) }
    })
    // Escape is handled only for Lakshly's own events. No global key monitor: Lakshly never observes
    // keystrokes typed into other apps. Moving the pointer away collapses the panel.
    localMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
      guard event.keyCode == 53 || event.charactersIgnoringModifiers == "\u{1b}" else { return event }
      let swallow = MainActor.assumeIsolated { () -> Bool in
        guard let self, self.expanded else { return false }
        let ours = event.window === self.hot || event.window === self.contentPanel
        guard ours || self.pointerInside() else { return false }
        self.apply(.collapse)
        return true
      }
      return swallow ? nil : event
    }
  }

  deinit {
    if let localMonitor { NSEvent.removeMonitor(localMonitor) }
    let center = NotificationCenter.default
    centerTokens.forEach(center.removeObserver)
    let workspace = NSWorkspace.shared.notificationCenter
    workspaceTokens.forEach(workspace.removeObserver)
    let distributed = DistributedNotificationCenter.default()
    distributedTokens.forEach(distributed.removeObserver)
  }
}

private final class NotchHitView: NSView {
  var onEntered: () -> Void = {}
  var onExited: () -> Void = {}
  var onClick: (() -> Void)?
  override var isOpaque: Bool { false }
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    for area in trackingAreas { removeTrackingArea(area) }
    addTrackingArea(NSTrackingArea(
      rect: bounds,
      options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
      owner: self,
      userInfo: nil))
  }
  override func mouseEntered(with event: NSEvent) { onEntered() }
  override func mouseExited(with event: NSEvent) { onExited() }
  override func mouseDown(with event: NSEvent) { onClick?() }
}

private final class NotchHostingView: NSHostingView<AnyView> {
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override var isOpaque: Bool { false }
}
#endif
