"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useAppState, type AppearancePref, type ThemeId } from "./AppState";
import { Icon } from "./Icon";
import { isPremiumTheme, themes } from "@/lib/themes";
import { useTier } from "./useTier";
import { formatINR } from "@/lib/format";
import { IS_BETA } from "@/lib/edition";
import { MoodGrid } from "./ThemeV2";

const APPEARANCES: { value: AppearancePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const switcherQueryListeners = new Set<() => void>();

function subscribeSwitcherQuery(listener: () => void) {
  switcherQueryListeners.add(listener);
  return () => switcherQueryListeners.delete(listener);
}

function readSwitcherQuery() {
  return document.documentElement.dataset.switcher === "open";
}

function clearSwitcherQuery() {
  if (document.documentElement.dataset.switcher !== "open") return;
  delete document.documentElement.dataset.switcher;
  switcherQueryListeners.forEach((listener) => listener());
}

function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 .2 18h1.5a2 2 0 0 0 2-2 2.2 2.2 0 0 1 2.2-2.2H19a2 2 0 0 0 2-2.1A9 9 0 0 0 12 3Z" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.2" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const { setPlan, theme, setTheme, appearance, setAppearance, resolved } = useAppState();
  const premiumThemes = useTier().can("themes.premium");
  const fromQuery = useSyncExternalStore(subscribeSwitcherQuery, readSwitcherQuery, () => false);
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? fromQuery;
  const [upsell, setUpsell] = useState<ThemeId | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const upsellRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const upsellTitleId = useId();
  const wasActive = useRef(false);

  function setOpen(next: boolean) {
    if (!next) clearSwitcherQuery();
    setManual(next);
  }

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect || !panel) return;
      panel.style.setProperty("--theme-popover-top", `${rect.bottom + 8}px`);
      panel.style.setProperty("--theme-popover-right", `${Math.max(12, window.innerWidth - rect.right)}px`);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    const active = open || upsell !== null;
    if (!active) {
      if (wasActive.current) btnRef.current?.focus();
      wasActive.current = false;
      return;
    }
    wasActive.current = true;
    const container = upsell ? upsellRef.current : panelRef.current;
    const focusable = () => [...(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const initial = upsell
      ? container
      : focusable().find((node) => node.getAttribute("data-theme-card") === theme) ?? focusable()[0];
    initial?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (upsell) setUpsell(null);
        else setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const nodes = focusable();
      if (!nodes.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, upsell, theme]);

  function chooseTheme(id: ThemeId) {
    if (isPremiumTheme(id) && !premiumThemes) {
      setUpsell(id);
      return;
    }
    setTheme(id);
  }

  function onAppearanceKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = APPEARANCES.findIndex((item) => item.value === appearance);
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = APPEARANCES[(index + delta + APPEARANCES.length) % APPEARANCES.length].value;
    setAppearance(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-appearance-option="${next}"]`)?.focus();
  }

  const dialog = open && typeof document !== "undefined" ? createPortal(
    <>
      <div className="theme-scrim" onMouseDown={() => { if (!upsell) setOpen(false); }} />
      <div
        ref={panelRef}
        className="glass theme-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="theme-popover-head">
          <h2 id={titleId}>{IS_BETA ? "Look and appearance" : "Theme and appearance"}</h2>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close theme and appearance">×</button>
        </div>
        {IS_BETA ? <MoodGrid /> : <div className="theme-grid">
          {themes.map((item) => {
            const locked = item.premium && !premiumThemes;
            const sw = item.swatches[resolved];
            const selected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="theme-card"
                data-theme-card={item.id}
                aria-pressed={selected}
                aria-label={`${item.name}. ${item.description}${locked ? ". Premium, locked" : ""}`}
                onClick={() => chooseTheme(item.id)}
              >
                <span className="theme-preview" style={{ background: sw.bg, color: sw.text }}>
                  <span className="theme-preview-surface" style={{ background: sw.surface }}>
                    <span className="theme-preview-top">
                      <span className="theme-preview-figure" style={{ color: sw.gold }}>{formatINR(2480000)}</span>
                      <span className="theme-preview-accent" style={{ background: sw.accent }} />
                    </span>
                    <span className="theme-dots" aria-hidden="true">
                      <i style={{ background: sw.income }} />
                      <i style={{ background: sw.spend }} />
                      <i style={{ background: sw.invest }} />
                    </span>
                  </span>
                  <span className="theme-card-meta">
                    <span className="theme-card-name">{item.name}</span>
                    {locked ? <Icon name="lock" size={12} /> : null}
                    {selected ? <span className="theme-check" aria-hidden="true">✓</span> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>}
        <div className="theme-appearance" role="radiogroup" aria-label="Appearance" onKeyDown={onAppearanceKey}>
          {APPEARANCES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              data-appearance-option={item.value}
              aria-checked={appearance === item.value}
              onClick={() => setAppearance(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  const upsellDialog = upsell && typeof document !== "undefined" ? createPortal(
    <div className="theme-modal-backdrop" onMouseDown={() => setUpsell(null)}>
      <div
        ref={upsellRef}
        className="glass theme-upsell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={upsellTitleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={upsellTitleId}>Lakshly Premium — themes, payoff planner, priority requests</h2>
        <ul>
          <li>Ocean, Forest, and Rose Quartz themes</li>
          <li>Payoff planner</li>
          <li>Priority requests</li>
        </ul>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const next = upsell;
            setPlan("premium");
            setTheme(next);
            setUpsell(null);
          }}
        >
          Preview Premium (demo)
        </button>
        <button type="button" className="btn ghost" onClick={() => setUpsell(null)}>Not now</button>
        <p className="tiny muted">Demo only. No payment is taken.</p>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn"
        aria-label="Theme and appearance"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <PaletteIcon />
      </button>
      {dialog}
      {upsellDialog}
    </>
  );
}
