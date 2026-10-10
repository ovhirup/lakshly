import { describe, expect, it } from "vitest";
import { HAS_DATA_KEY, SOURCE_KEY, VAULT_SLOW_MS, vaultBootScript, vaultPending } from "@/lib/vault-boot";

function runBoot(store: Record<string, string>) {
  const dataset: Record<string, string> = {};
  const timers: (() => void)[] = [];
  const g = {
    document: { documentElement: { dataset } },
    localStorage: { getItem: (k: string) => store[k] ?? null },
    setTimeout: (fn: () => void) => { timers.push(fn); return 0; },
  };
  new Function("document", "localStorage", "setTimeout", vaultBootScript)(g.document, g.localStorage, g.setTimeout);
  return { dataset, fireTimers: () => timers.forEach((t) => t()) };
}

describe("vault boot gate (no demo flash on reload)", () => {
  it("gates whenever real data exists, or the demo wasn't explicitly chosen", () => {
    expect(vaultPending({ hasData: true, source: "mine", ready: false })).toBe(true);
    expect(vaultPending({ hasData: true, source: "demo", ready: false })).toBe(true);
    expect(vaultPending({ hasData: false, source: null, ready: false })).toBe(true);
    expect(vaultPending({ hasData: false, source: "demo", ready: false })).toBe(false);
    expect(vaultPending({ hasData: true, source: "mine", ready: true })).toBe(false);
  });
  it("head script marks the page pending before paint and never lifts itself", () => {
    const b = runBoot({ [HAS_DATA_KEY]: "1", [SOURCE_KEY]: "mine" });
    expect(b.dataset).toMatchObject({ vault: "pending", hasData: "1" });
    b.fireTimers(); // a slow network only adds the "still opening" hint; it never reveals demo data
    expect(b.dataset).toMatchObject({ vault: "pending", vaultSlow: "1" });
    expect(VAULT_SLOW_MS).toBeGreaterThanOrEqual(10000);
  });
  it("fresh visitor gets the skeleton too; an explicit demo choice without data does not", () => {
    expect(runBoot({}).dataset.vault).toBe("pending");
    expect(runBoot({ [SOURCE_KEY]: "demo" }).dataset.vault).toBeUndefined();
  });
  it("reads only the plain flag and the source choice", () => {
    expect(vaultBootScript).not.toMatch(/indexedDB|lakshly\.vault|delete d\.dataset\.vault/);
  });
});
