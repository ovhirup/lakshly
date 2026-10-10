// Passphrase wrap for the on-device vault key. The passphrase is never stored or sent.
export const VAULT_LOCK_ITERATIONS = 210_000;

export class VaultLockedError extends Error {
  constructor() {
    super("The vault is locked.");
    this.name = "VaultLockedError";
  }
}

export interface WrappedVaultKey { salt: string; iv: string; wrapped: string }

function bytesToB64(bytes: Uint8Array): string {
  let text = "";
  bytes.forEach((b) => { text += String.fromCharCode(b); });
  return btoa(text);
}

function b64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as Uint8Array<ArrayBuffer>, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/** Encrypt the device key so it can be stored without the passphrase. */
export async function wrapDeviceKey(key: CryptoKey, passphrase: string, iterations = VAULT_LOCK_ITERATIONS): Promise<WrappedVaultKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapping = await derive(passphrase, salt, iterations);
  const wrapped = await crypto.subtle.wrapKey("raw", key, wrapping, { name: "AES-GCM", iv });
  return { salt: bytesToB64(salt), iv: bytesToB64(iv), wrapped: bytesToB64(new Uint8Array(wrapped)) };
}

/** Restore the device key. A wrong passphrase rejects. */
export async function unwrapDeviceKey(record: WrappedVaultKey, passphrase: string, iterations = VAULT_LOCK_ITERATIONS): Promise<CryptoKey> {
  const wrapping = await derive(passphrase, b64ToBytes(record.salt), iterations);
  return crypto.subtle.unwrapKey(
    "raw",
    b64ToBytes(record.wrapped),
    wrapping,
    { name: "AES-GCM", iv: b64ToBytes(record.iv) },
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
