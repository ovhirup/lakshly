import { describe, expect, it } from "vitest";
import { unwrapDeviceKey, wrapDeviceKey } from "@/lib/vault-lock";

describe("vault lock", () => {
  it("round-trips the device key and rejects a wrong passphrase", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const wrapped = await wrapDeviceKey(key, "correct horse", 1_000);
    expect(JSON.stringify(wrapped)).not.toContain("correct horse");
    const opened = await unwrapDeviceKey(wrapped, "correct horse", 1_000);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("hello"));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, opened, ct);
    expect(new TextDecoder().decode(plain)).toBe("hello");
    await expect(unwrapDeviceKey(wrapped, "wrong passphrase", 1_000)).rejects.toBeTruthy();
  });
});
