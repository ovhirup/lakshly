/** cyrb53: small, fast, deterministic 53-bit string hash (not cryptographic; used for stable ids). */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Stable schema-compatible id, e.g. stableId("txn", ...) → "txn_k3j9x2ab01". */
export function stableId(prefix: string, ...parts: (string | number | undefined)[]): string {
  const key = parts.map((p) => String(p ?? "")).join("|");
  return `${prefix}_${cyrb53(key).toString(36).padStart(11, "0")}`;
}
