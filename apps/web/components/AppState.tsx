"use client";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type Plan = "free" | "premium";
export type Theme = "light" | "dark";

type Ctx = { plan: Plan; setPlan: (p: Plan) => void; theme: Theme; toggleTheme: () => void };
const AppCtx = createContext<Ctx | null>(null);

const PLAN_KEY = "lakshly.plan";
const THEME_KEY = "lakshly.theme";

// Tiny localStorage-backed store (local-first: nothing leaves the device).
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
const readPlan = (): Plan => (localStorage.getItem(PLAN_KEY) === "premium" ? "premium" : "free");
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const plan = useSyncExternalStore(subscribe, readPlan, () => "free" as Plan);
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  const setPlan = useCallback((p: Plan) => { localStorage.setItem(PLAN_KEY, p); emit(); }, []);
  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    emit();
  }, []);

  return <AppCtx.Provider value={{ plan, setPlan, theme, toggleTheme }}>{children}</AppCtx.Provider>;
}

export function useAppState() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useAppState must be used inside AppStateProvider");
  return c;
}

/** Inline, pre-paint theme script (avoids a light/dark flash before hydration). */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;
