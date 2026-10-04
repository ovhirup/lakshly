"use client";
// Setup wizard state: encrypted vault record "setup.state" (email, picked sources, progress) plus a tiny
// localStorage flag record for the shell (never the email or institutions). No network.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loadRecord, saveRecord, VAULT_DELETED_EVENT } from "@/lib/vault";
import { useProfile } from "@/lib/profile";
import {
  checklist, currentStep, EMPTY_FLAGS, FLAGS_KEY, initialSetup, markCompletion, parseFlags, progressOf, serialiseFlags, setupReducer,
  type ChecklistItem, type SetupAction, type SetupFlags, type SetupState,
} from "@/lib/setup";
import { useData } from "./DataState";

const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cache: SetupFlags = EMPTY_FLAGS;
function readFlags(): SetupFlags {
  let raw: string | null = null;
  try { raw = localStorage.getItem(FLAGS_KEY); } catch { /* blocked */ }
  if (raw !== cacheRaw) { cacheRaw = raw; cache = parseFlags(raw); }
  return cache;
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
export function writeFlags(next: Partial<SetupFlags>) {
  const merged = { ...readFlags(), ...next, v: 1 as const };
  try { localStorage.setItem(FLAGS_KEY, serialiseFlags(merged)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function useSetupFlags(): SetupFlags {
  return useSyncExternalStore(subscribe, readFlags, () => EMPTY_FLAGS);
}

interface SetupCtx {
  ready: boolean;
  state: SetupState;
  dispatch: (a: SetupAction) => void;
  items: ChecklistItem[];
  progress: ReturnType<typeof progressOf>;
  resume: ReturnType<typeof currentStep>;
  /** True for one render cycle after setup.completed fired (drives the celebration). */
  justCompleted: boolean;
  ackCompleted: () => void;
}
const Ctx = createContext<SetupCtx | null>(null);

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const data = useData();
  const profile = useProfile();
  const [state, setState] = useState<SetupState>(() => initialSetup("1970-01-01T00:00:00.000Z"));
  const [ready, setReady] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    loadRecord<SetupState>("setup.state")
      .then((s) => { if (alive) { setState(s && s.v === 1 ? { ...initialSetup(s.startedAt), ...s } : initialSetup(new Date().toISOString())); setReady(true); } })
      .catch(() => { if (alive) { setState(initialSetup(new Date().toISOString())); setReady(true); } });
    return () => { alive = false; };
  }, []);

  // After "Delete all my data" the vault is gone: start over.
  const hadUser = useRef(false);
  useEffect(() => {
    if (data.user) hadUser.current = true;
    else if (hadUser.current && data.ready) { hadUser.current = false; setState(initialSetup(new Date().toISOString())); }
  }, [data.user, data.ready]);

  // Deleting from Import before any statement was imported: still start over.
  useEffect(() => {
    const onDeleted = () => { dirty.current = false; hadUser.current = false; setState(initialSetup(new Date().toISOString())); };
    window.addEventListener(VAULT_DELETED_EVENT, onDeleted);
    return () => window.removeEventListener(VAULT_DELETED_EVENT, onDeleted);
  }, []);

  // Persist after user actions (never the initial empty state before the vault is read).
  useEffect(() => {
    if (!ready || !dirty.current) return;
    void saveRecord("setup.state", state).catch(() => undefined);
  }, [ready, state]);

  const facts = useMemo(() => ({
    name: profile.name,
    importCount: data.user?.imports.length ?? 0,
    budgetLines: data.user?.dataset.budgets?.length ?? 0,
  }), [profile.name, data.user]);

  const dispatch = useCallback((a: SetupAction) => {
    dirty.current = true;
    setState((prev) => setupReducer(prev, a));
  }, []);

  const items = useMemo(() => checklist(state, facts), [state, facts]);
  const progress = useMemo(() => progressOf(items), [items]);

  // setup.completed: exactly once, in "mine" mode, the first time every required item is done.
  useEffect(() => {
    if (!ready) return;
    const { state: stamped, fired } = markCompletion(state, items, new Date().toISOString());
    if (!fired) return;
    dirty.current = true;
    // Completion depends on facts outside the reducer (imports, name), so it is checked here, once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(stamped);
    setJustCompleted(true);
  }, [ready, state, items]);

  // Mirror only non-sensitive bits for the shell.
  useEffect(() => {
    if (!ready) return;
    const f = readFlags();
    const complete = !!state.completedAt || (state.mode === "mine" && progress.requiredDone);
    if (f.mode !== state.mode || f.percent !== progress.percent || f.complete !== complete) writeFlags({ mode: state.mode, percent: progress.percent, complete });
  }, [ready, state.mode, state.completedAt, progress.percent, progress.requiredDone]);

  const value: SetupCtx = {
    ready, state, dispatch, items, progress, resume: currentStep(state), justCompleted, ackCompleted: () => setJustCompleted(false),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSetup(): SetupCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSetup must be used inside SetupProvider");
  return c;
}
