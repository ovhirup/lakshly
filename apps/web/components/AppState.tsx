"use client";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  APPEARANCE_KEY, applyDocumentTheme, isPremiumTheme, isThemeId, LEGACY_THEME_KEY, PLAN_KEY,
  THEME_ID_KEY, themeById, type AppearancePref, type ResolvedAppearance, type ThemeId,
} from "@/lib/themes";

import type { Plan } from "@/lib/entitlements";
export type { Plan } from "@/lib/entitlements";
export type { AppearancePref, ThemeId };

type Snapshot = {
  plan: Plan;
  privacy: boolean;
  theme: ThemeId;
  appearance: AppearancePref;
  resolved: ResolvedAppearance;
};

type Ctx = Snapshot & {
  setPrivacy: (hidden: boolean) => void;
  setPlan: (plan: Plan) => void;
  setTheme: (theme: ThemeId) => void;
  setAppearance: (appearance: AppearancePref) => void;
  /** Toggles the resolved appearance and saves it as an explicit light/dark preference. */
  toggleTheme: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const SERVER: Snapshot = { plan: "free", privacy: false, theme: "lakshmi", appearance: "system", resolved: "light" };
let current: Snapshot = SERVER;
let migrated = false;

function readPlan(): Plan {
  try {
    return localStorage.getItem(PLAN_KEY) === "premium" ? "premium" : "free";
  } catch {
    return "free";
  }
}

function migrateAppearance() {
  if (migrated) return;
  migrated = true;
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "light" || legacy === "dark") {
      localStorage.setItem(APPEARANCE_KEY, legacy);
      localStorage.removeItem(LEGACY_THEME_KEY);
    }
  } catch {
    /* Storage can be blocked; the pre-paint script already tried. */
  }
}

function readAppearancePref(): AppearancePref {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    /* ignore */
  }
  return "system";
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_ID_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "lakshmi";
}

/** Mirrors the pre-paint script: query params win for this load and are not saved. */
function readSnapshot(): Snapshot {
  migrateAppearance();
  const plan = readPlan();
  let privacy = false;
  try { privacy = localStorage.getItem("lakshly.privacy") === "hidden"; } catch { /* optional preference */ }
  const storedAppearance = readAppearancePref();
  const root = document.documentElement;
  const painted = root.dataset.theme;
  let theme: ThemeId = readStoredTheme();
  let ephemeralTheme = false;
  if (root.dataset.themeEphemeral === "1" && isThemeId(painted)) {
    theme = painted;
    ephemeralTheme = true;
  }
  if (!ephemeralTheme && isPremiumTheme(theme) && plan !== "premium") theme = "lakshmi";
  const ephemeralAppearance = root.dataset.appearanceEphemeral;
  if (ephemeralAppearance === "light" || ephemeralAppearance === "dark") {
    return { plan, privacy, theme, appearance: ephemeralAppearance, resolved: ephemeralAppearance };
  }
  if (storedAppearance === "light" || storedAppearance === "dark") {
    return { plan, privacy, theme, appearance: storedAppearance, resolved: storedAppearance };
  }
  const resolved: ResolvedAppearance = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return { plan, privacy, theme, appearance: "system", resolved };
}

function publish() {
  const next = readSnapshot();
  applyDocumentTheme(next.theme, next.resolved);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    const ephemeral = document.documentElement.dataset.appearanceEphemeral;
    if (ephemeral === "light" || ephemeral === "dark") return;
    if (readAppearancePref() !== "system") return;
    publish();
  };
  media.addEventListener("change", onMedia);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onMedia);
  };
}

function getSnapshot(): Snapshot {
  const next = readSnapshot();
  if (
    current.plan === next.plan &&
    current.privacy === next.privacy &&
    current.theme === next.theme &&
    current.appearance === next.appearance &&
    current.resolved === next.resolved
  ) return current;
  current = next;
  return current;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => SERVER);

  useEffect(() => {
    const live = getSnapshot();
    applyDocumentTheme(live.theme, live.resolved);
  }, [snap]);

  const setPrivacy = useCallback((hidden: boolean) => {
    try { localStorage.setItem("lakshly.privacy", hidden ? "hidden" : "visible"); } catch { /* optional preference */ }
    publish();
  }, []);

  const setPlan = useCallback((plan: Plan) => {
    try { localStorage.setItem(PLAN_KEY, plan); } catch { /* ignore */ }
    publish();
  }, []);

  const setTheme = useCallback((theme: ThemeId) => {
    if (!isThemeId(theme) || themeById(theme).id !== theme) return;
    if (isPremiumTheme(theme) && readPlan() !== "premium") return;
    try { localStorage.setItem(THEME_ID_KEY, theme); } catch { /* ignore */ }
    delete document.documentElement.dataset.themeEphemeral;
    publish();
  }, []);

  const setAppearance = useCallback((appearance: AppearancePref) => {
    try { localStorage.setItem(APPEARANCE_KEY, appearance); } catch { /* ignore */ }
    delete document.documentElement.dataset.appearanceEphemeral;
    publish();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: AppearancePref = getSnapshot().resolved === "dark" ? "light" : "dark";
    try { localStorage.setItem(APPEARANCE_KEY, next); } catch { /* ignore */ }
    delete document.documentElement.dataset.appearanceEphemeral;
    publish();
  }, []);

  return (
    <AppCtx.Provider value={{ ...snap, setPrivacy, setPlan, setTheme, setAppearance, toggleTheme }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
