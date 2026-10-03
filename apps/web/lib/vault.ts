// Local encrypted vault for the user's own imported data.
// IndexedDB holds (1) a non-extractable AES-GCM-256 key and (2) the ciphertext of the user's dataset.
// Nothing ever leaves the device. Threat model: protects data at rest from casual inspection of the
// browser profile; it does not protect against code running on this origin. A passphrase lock is a
// planned follow-up.
import type { Holding, LakshlyDataset, StatementMeta } from "@lakshly/parsers";

import type { SetupGoal } from "./setup";

export interface ImportLog { at: string; file: string; adapter: string; added: number; duplicates: number; /** Setup source this file was attributed to. */ sourceId?: string }
export interface UserData {
  version: 1; dataset: LakshlyDataset; holdings: Holding[]; statements: StatementMeta[]; imports: ImportLog[];
  /** When each transaction first arrived on this device (used by the weekly review for late imports). */
  importedAt?: Record<string, string>;
  goals?: SetupGoal[];
}

const DB = "lakshly-vault";
const STORE = "kv";

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

async function key(): Promise<CryptoKey> {
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
export type RecordName = "setup.state" | "review.state" | "review.demo" | "game.ledger" | "game.demo" | "game.nudges";

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
