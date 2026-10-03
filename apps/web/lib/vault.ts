// Local encrypted vault for the user's own imported data.
// IndexedDB holds (1) a non-extractable AES-GCM-256 key and (2) the ciphertext of the user's dataset.
// Nothing ever leaves the device. Threat model: protects data at rest from casual inspection of the
// browser profile; it does not protect against code running on this origin. A passphrase lock is a
// planned follow-up.
import type { Holding, LakshlyDataset, StatementMeta } from "@lakshly/parsers";

import type { SetupState, SetupGoal } from "@lakshly/shared";

export interface ImportLog { id: string; accountIds: string[]; confidence?: number; at: string; file: string; adapter: string; added: number; duplicates: number }
export interface UserData { version: 2; setup?: SetupState; goals?: SetupGoal[]; dataset: LakshlyDataset; holdings: Holding[]; statements: StatementMeta[]; imports: ImportLog[] }

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
  return migrateUserData(JSON.parse(new TextDecoder().decode(plain)) as LegacyUserData | UserData);
}

/** Peek at the stored record without decrypting (used to prove the data is encrypted at rest). */
export async function vaultInfo(): Promise<{ encrypted: boolean; bytes: number } | null> {
  const rec = await tx<{ alg: string; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get("vault") as IDBRequest<{ alg: string; ct: ArrayBuffer } | undefined>);
  return rec ? { encrypted: rec.alg === "AES-GCM-256", bytes: rec.ct.byteLength } : null;
}

export function deleteVault(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Payload migration only: the encrypted envelope and dataset are unchanged. */
export type LegacyUserData = Omit<UserData, "version" | "imports"> & {
  version: 1; imports: Omit<ImportLog, "id" | "accountIds">[];
};
export function migrateUserData(data: LegacyUserData | UserData): UserData {
  if (data.version === 2) return data;
  return { ...data, version: 2, imports: data.imports.map((entry, index) => ({
    ...entry, id: `imp_legacy${String(index + 1).padStart(6, "0")}`, accountIds: [],
  })) };
}
