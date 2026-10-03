"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createShakeDetector, DEFAULT_PRIVACY, isMasked, MASK, parsePrivacy, PRIVACY_KEY, setFormatMask, type PrivacySettings } from "@/lib/privacy";
import { Icon } from "./Icon";
import "./privacy.css";

type Source = "button" | "key" | "hero" | "shake" | "settings";
type Ctx = {
  settings: PrivacySettings;
  masked: boolean;
  /** One entry point for every control. */
  setPrivacy: (on: boolean, source: Source) => void;
  toggle: (source: Source) => void;
  update: (patch: Partial<PrivacySettings>) => void;
};
const PrivacyCtx = createContext<Ctx | null>(null);
const REVEALED = "lk-privacy-revealed";
const TOASTED = "lk-privacy-toasted";

const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cache = DEFAULT_PRIVACY;
function read(): PrivacySettings {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PRIVACY_KEY); } catch { /* blocked */ }
  if (raw !== cacheRaw) { cacheRaw = raw; cache = parsePrivacy(raw); }
  return cache;
}
function write(next: PrivacySettings) {
  try { localStorage.setItem(PRIVACY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
const session = {
  get: (k: string) => { try { return sessionStorage.getItem(k) === "1"; } catch { return false; } },
  set: (k: string) => { try { sessionStorage.setItem(k, "1"); } catch { /* ignore */ } },
};

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_PRIVACY);
  const [transient, setTransient] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  useEffect(() => { setRevealed(session.get(REVEALED)); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const masked = isMasked(settings, transient, revealed);
  // The formatters read this flag; set it before the subtree renders so no digits ever reach the DOM.
  setFormatMask(masked, settings.hidePercent);

  useEffect(() => { delete document.documentElement.dataset.privacyBoot; }, [masked]);

  const setPrivacy = useCallback((on: boolean, source: Source) => {
    document.documentElement.dataset.privacySource = source;
    const cur = read();
    if (!on) { session.set(REVEALED); setRevealed(true); }
    write({ ...cur, on });
    setAnnounce(on ? "Amounts hidden" : "Amounts shown");
    if (on && !session.get(TOASTED)) {
      session.set(TOASTED);
      setToast("Amounts hidden · tap 👁 to show");
      setTimeout(() => setToast(null), 2000);
    }
  }, []);
  const currentlyMasked = useRef(masked);
  useEffect(() => { currentlyMasked.current = masked; }, [masked]);
  const toggle = useCallback((source: Source) => setPrivacy(!currentlyMasked.current, source), [setPrivacy]);
  const update = useCallback((patch: Partial<PrivacySettings>) => write({ ...read(), ...patch }), []);

  // "." toggles when focus isn't in a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "." || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      toggle("key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Optional: hide while the tab/window isn't in front (temporary; never changes the saved toggle).
  useEffect(() => {
    if (!settings.hideOnBlur) { setTransient(false); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const hide = () => setTransient(true);
    const show = () => { if (document.visibilityState === "visible" && document.hasFocus()) setTransient(false); };
    const onVis = () => (document.visibilityState === "hidden" ? hide() : show());
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("blur", hide); window.removeEventListener("focus", show); document.removeEventListener("visibilitychange", onVis); };
  }, [settings.hideOnBlur]);

  // Opt-in shake to hide (phones).
  useEffect(() => {
    if (!settings.shake || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    const detect = createShakeDetector(() => toggle("shake"));
    const onMotion = (e: DeviceMotionEvent) => {
      if (isTyping(document.activeElement)) return;
      const a = e.acceleration;
      const g = e.accelerationIncludingGravity;
      const m = a && a.x != null ? Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
        : g ? Math.max(0, Math.hypot(g.x ?? 0, g.y ?? 0, g.z ?? 0) - 9.81) : 0;
      detect(m, performance.now());
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [settings.shake, toggle]);

  const value = useMemo(() => ({ settings, masked, setPrivacy, toggle, update }), [settings, masked, setPrivacy, toggle, update]);
  return (
    <PrivacyCtx.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" role="status">{announce}</div>
      {toast && <div className="toast glass privacy-toast" role="status">{toast}</div>}
    </PrivacyCtx.Provider>
  );
}

export function usePrivacy(): Ctx {
  const c = useContext(PrivacyCtx);
  if (!c) throw new Error("usePrivacy must be used inside PrivacyProvider");
  return c;
}

/** Eye button: top bar (phone) and sidebar footer (desktop). */
export function PrivacyToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { masked, toggle } = usePrivacy();
  const label = masked ? "Show amounts" : "Hide amounts";
  return (
    <button className={`icon-btn privacy-btn ${withLabel ? "with-label" : ""} ${masked ? "on" : ""}`} aria-pressed={masked} aria-label={label} title={`${label} (.)`} onClick={() => toggle("button")}>
      <Icon name={masked ? "eyeOff" : "eye"} size={18} />
      {withLabel && <span>{label}</span>}
    </button>
  );
}

/** Renders a formatted amount; when masked, screen readers hear "Amount hidden" instead of the dots. */
export function Amount({ children, className }: { children: string; className?: string }) {
  if (children.includes(MASK)) {
    return <span className={`${className ?? ""} masked-amount`} role="img" aria-label="Amount hidden"><span aria-hidden="true">{children}</span></span>;
  }
  return className ? <span className={className}>{children}</span> : <>{children}</>;
}

/** Double-tap (or double-click) toggles privacy, e.g. on the Overview hero total. */
export function useDoubleTapToggle() {
  const { toggle } = usePrivacy();
  const last = useRef(0);
  return {
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const now = e.timeStamp;
      if (now - last.current < 320) { last.current = 0; toggle("hero"); } else last.current = now;
    },
    onDoubleClick: (e: React.MouseEvent) => { if ((e.nativeEvent as PointerEvent).pointerType !== "touch") toggle("hero"); },
  };
}
