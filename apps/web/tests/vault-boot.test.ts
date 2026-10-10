import { describe, expect, it } from "vitest";
import { HAS_DATA_KEY, vaultBootScript, vaultPending } from "@/lib/vault-boot";

describe("vault pending gate (no demo flash for people with real data)", () => {
  it("pending only when real data exists, the demo was not chosen, and the vault is not read yet", () => {
    expect(vaultPending({ hasData: true, source: "mine", ready: false })).toBe(true);
    expect(vaultPending({ hasData: true, source: null, ready: false })).toBe(true);
    expect(vaultPending({ hasData: true, source: "demo", ready: false })).toBe(false);
    expect(vaultPending({ hasData: false, source: "mine", ready: false })).toBe(false);
    expect(vaultPending({ hasData: true, source: "mine", ready: true })).toBe(false);
  });
  it("boot script only reads the plain flag and the source choice, and always lifts itself", () => {
    expect(vaultBootScript).toContain(JSON.stringify(HAS_DATA_KEY));
    expect(vaultBootScript).toContain('dataset.vault="pending"');
    expect(vaultBootScript).toMatch(/setTimeout\(function\(\)\{delete d\.dataset\.vault\},8000\)/);
    expect(vaultBootScript).not.toMatch(/indexedDB|lakshly\.vault/);
  });
});
