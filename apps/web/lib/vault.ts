// Local encrypted vault for the user's own imported data.
// IndexedDB holds the ciphertext. The device key stays in memory while unlocked.
// A passphrase lock wraps that key so a closed tab cannot decrypt the vault.
// Nothing ever leaves the device. Threat model: protects data at rest from casual inspection of the
// browser profile; it does not protect against code running on this origin.
import type { Holding, LakshlyDataset, StatementMeta } from "@lakshly/parsers";

import type { SetupGoal } from "./setup";
import { unwrapDeviceKey, VaultLockedError, wrapDeviceKey, type WrappedVaultKey } from "./vault-lock";

export { VaultLockedError };

export interface ImportLog { at: string; file: string; adapter: string; added: number; duplicates: number; /** Setup source this file was attributed to. */ sourceId?: string; /** Where it came from, e.g. "gmail:<message id>" (marks Gmail rows as already imported). */ ref?: string }
export interface UserData {
  version: 1; dataset: LakshlyDataset; holdings: Holding[]; statements: StatementMeta[]; imports: ImportLog[];
  /** When each transaction first arrived on this device (used by the weekly review for late imports). */
  importedAt?: Record<string, string>;
  goals?: SetupGoal[];
}

const DB = "lakshly-vault";
const STORE = "kv";
let sessionKey: CryptoKey | null = null;

export const VAULT_LOCKED_EVENT = "lk-vault-locked";
export const VAULT_UNLOCKED_EVENT = "lk-vault-unlocked";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

async function readLock(): Promise<WrappedVaultKey | undefined> {
  return tx<WrappedVaultKey | undefined>("readonly", (s) => s.get("lock") as IDBRequest<WrappedVaultKey | undefined>);
}

export async function vaultLockState(): Promise<"unset" | "locked" | "open"> {
  if (sessionKey) return "open";
  return (await readLock()) ? "locked" : "unset";
}

async function allKeys(): Promise<IDBValidKey[]> {
  return tx("readonly", (s) => s.getAllKeys());
}

async function reencrypt(oldKey: CryptoKey, nextKey: CryptoKey): Promise<void> {
  for (const name of await allKeys()) {
    if (name === "key" || name === "lock") continue;
    const rec = await tx<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get(name) as IDBRequest<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>);
    if (!rec?.ct || !rec.iv) continue;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv as Uint8Array<ArrayBuffer> }, oldKey, rec.ct);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, nextKey, plain);
    await tx("readwrite", (s) => s.put({ v: 1, alg: "AES-GCM-256", iv, ct }, name));
  }
}

/** Wrap the device key with a passphrase and drop the unwrapped copy from storage. */
export async function enableVaultLock(passphrase: string): Promise<void> {
  if (passphrase.trim().length < 8) throw new Error("Use at least 8 characters.");
  if (await readLock()) throw new Error("Vault lock is already on.");
  const existing = await tx<CryptoKey | undefined>("readonly", (s) => s.get("key") as IDBRequest<CryptoKey | undefined>);
  const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  if (existing) await reencrypt(existing, fresh);
  const record = await wrapDeviceKey(fresh, passphrase);
  await tx("readwrite", (s) => s.put(record, "lock"));
  await tx("readwrite", (s) => s.delete("key"));
  sessionKey = await unwrapDeviceKey(record, passphrase);
}

/** Restore the device key for this tab. A wrong passphrase throws. */
export async function unlockVault(passphrase: string): Promise<void> {
  const lock = await readLock();
  if (!lock) throw new Error("No vault lock is set.");
  sessionKey = await unwrapDeviceKey(lock, passphrase);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VAULT_UNLOCKED_EVENT));
}

/** Forget the device key in this tab. The wrapped copy stays on the device. */
export function lockVaultNow(): void {
  sessionKey = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VAULT_LOCKED_EVENT));
}

async function key(): Promise<CryptoKey> {
  if (sessionKey) return sessionKey;
  if (await readLock()) throw new VaultLockedError();
  const existing = await tx<CryptoKey | undefined>("readonly", (s) => s.get("key") as IDBRequest<CryptoKey | undefined>);
  if (existing) return existing;
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await tx("readwrite", (s) => s.put(k, "key"));
  return k;
}

export async function saveUserData(data: UserData): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), plain);
  await tx("readwrite", (s) => s.put({ v: 1, alg: "AES-GCM-256", iv, ct }, "vault"));
}

export async function loadUserData(): Promise<UserData | null> {
  const rec = await tx<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get("vault") as IDBRequest<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>);
  if (!rec) return null;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv as Uint8Array<ArrayBuffer> }, await key(), rec.ct);
  return JSON.parse(new TextDecoder().decode(plain)) as UserData;
}

/** Named records (setup progress, review state, …) encrypted with the same device key as the dataset. */
export type RecordName = "profile" | "setup.state" | "review.state" | "review.demo" | "game.ledger" | "game.demo" | "game.nudges";

export async function saveRecord(name: RecordName, value: unknown): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), plain);
  await tx("readwrite", (s) => s.put({ v: 1, alg: "AES-GCM-256", iv, ct }, `rec:${name}`));
}

export async function loadRecord<T>(name: RecordName): Promise<T | null> {
  const rec = await tx<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get(`rec:${name}`) as IDBRequest<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>);
  if (!rec) return null;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv as Uint8Array<ArrayBuffer> }, await key(), rec.ct);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** Peek at the stored record without decrypting (used to prove the data is encrypted at rest). */
export async function vaultInfo(): Promise<{ encrypted: boolean; bytes: number } | null> {
  const rec = await tx<{ alg: string; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get("vault") as IDBRequest<{ alg: string; ct: ArrayBuffer } | undefined>);
  return rec ? { encrypted: rec.alg === "AES-GCM-256", bytes: rec.ct.byteLength } : null;
}

/** Window event fired after "Delete all my data" so providers can drop in-memory copies. */
export const VAULT_DELETED_EVENT = "lk-vault-deleted";

export function deleteVault(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
