import { checklist, type SetupDataset, type SetupState } from "@lakshly/shared";
export const SETUP_FLAGS_KEY = "lk-setup-flags";
export interface SetupFlags { seen: boolean; mode: "mine" | "demo"; dismissed: boolean; percent: number; v: 1 }
type StorageView = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function setupFlags(state: SetupState, dataset: SetupDataset, today: string): SetupFlags {
  return { seen: true, mode: state.mode, dismissed: !!state.dismissedAt,
    percent: checklist(state, dataset, "web", today).percent, v: 1 };
}
export function writeSetupFlags(storage: StorageView, state: SetupState, dataset: SetupDataset, today: string) {
  // Explicit projection: never spread the encrypted setup state into localStorage.
  storage.setItem(SETUP_FLAGS_KEY, JSON.stringify(setupFlags(state, dataset, today)));
}
export function isFirstRun(storage: StorageView, user: unknown): boolean {
  return !user && storage.getItem("lakshly.source") === null && storage.getItem(SETUP_FLAGS_KEY) === null;
}
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
