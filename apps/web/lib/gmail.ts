// Gmail connect (beta): pure helpers + a tiny Gmail REST client. Runs entirely in the browser.
// - Sign in with Google returns an ID token; we decode it locally for name/email only (never sent anywhere).
// - Gmail access uses the GIS token client with gmail.readonly; the access token lives in memory only.
// - Every Gmail request is allow-listed: messages.list needs a catalog-built `q`, and only
//   messages.get / attachments.get on users/me are allowed. Senders are re-checked before any body is read.
// Spec: setup-wizard.md §4 step 2 and §4.2a, google-oauth/account-login.md §3 (ported by hand).
import { CATALOG } from "./sources.gen";
import { gmailQuery } from "./setup";
import type { Source, SourceKind } from "./setup-types";

export const GOOGLE_CLIENT_ID_DEFAULT = "285824172297-123lnqmgv8mmfmcjd53pa9ev6q9iknsb.apps.googleusercontent.com";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const SIGNIN_SCOPES = ["openid", "email", "profile"] as const;
export const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
/** Statement sources only: banks, cards and consolidated account statements. */
export const FINANCE_KINDS: readonly SourceKind[] = ["bank", "card", "cas"];

/* ───────────── identity (ID token, display only) ───────────── */
export interface GoogleIdentity { email: string; name: string; givenName?: string; sub: string; emailVerified: boolean }

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Decodes (does not verify) a Google ID token for display. Only name/email/sub are kept. */
export function decodeIdToken(jwt: string, clientId = GOOGLE_CLIENT_ID_DEFAULT): GoogleIdentity | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as Record<string, unknown>;
    if (p.aud !== clientId || !(p.iss === "https://accounts.google.com" || p.iss === "accounts.google.com")) return null;
    if (typeof p.email !== "string" || typeof p.sub !== "string") return null;
    return {
      email: p.email.toLowerCase(), sub: p.sub,
      name: typeof p.name === "string" ? p.name : "",
      ...(typeof p.given_name === "string" ? { givenName: p.given_name } : {}),
      emailVerified: p.email_verified === true || p.email_verified === "true",
    };
  } catch { return null; }
}

/* ───────────── allow-list ───────────── */
export function financeSources(picked: readonly string[] = [], catalog = CATALOG): Source[] {
  const all = catalog.sources.filter((s) => FINANCE_KINDS.includes(s.kinds[0]) && s.importer.supported);
  const chosen = all.filter((s) => picked.includes(s.id));
  return chosen.length ? chosen : all;
}

export function senderDomains(sources: readonly Source[]): string[] {
  return [...new Set(sources.flatMap((s) => [...s.senders.domains, ...s.senders.addresses]))].sort();
}

/** Extracts the address from a From header like `"HDFC Bank" <alerts@hdfcbank.net>`. */
export function fromAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

/** Domain or subdomain match (or an exact listed address); excludeDomains win. */
export function senderAllowed(src: Source, from: string): boolean {
  const addr = fromAddress(from);
  const at = addr.lastIndexOf("@");
  if (at < 1) return false;
  const domain = addr.slice(at + 1);
  const match = (d: string) => domain === d || domain.endsWith(`.${d}`);
  if (src.senders.excludeDomains.some(match)) return false;
  return src.senders.addresses.map((a) => a.toLowerCase()).includes(addr) || src.senders.domains.some(match);
}

/** Statement searches only (those that expect an attachment). */
export function statementQueries(sources: readonly Source[]): { sourceId: string; searchId: string; q: string }[] {
  return sources.flatMap((s) => s.searches.filter((x) => x.attachment).map((x) => ({ sourceId: s.id, searchId: x.id, q: gmailQuery(s, x.id) })));
}

/** Throws unless the URL is one of the three allowed read-only Gmail endpoints (list must carry a q). */
export function assertAllowedGmailUrl(url: string, allowedQueries: readonly string[]): void {
  const u = new URL(url);
  if (u.origin !== "https://gmail.googleapis.com") throw new Error("Blocked: not the Gmail API");
  const path = u.pathname.replace("/gmail/v1/users/me", "");
  if (path === "/messages") {
    const q = u.searchParams.get("q");
    if (!q || !allowedQueries.includes(q)) throw new Error("Blocked: search must be built from the finance catalog");
    return;
  }
  if (/^\/messages\/[A-Za-z0-9_-]+$/.test(path) || /^\/messages\/[A-Za-z0-9_-]+\/attachments\/[A-Za-z0-9_-]+$/.test(path)) return;
  throw new Error("Blocked: endpoint not allowed");
}

/* ───────────── Gmail client ───────────── */
export interface GmailPart { partId?: string; mimeType?: string; filename?: string; headers?: { name: string; value: string }[]; body?: { attachmentId?: string; size?: number; data?: string }; parts?: GmailPart[] }
export interface GmailMessage { id: string; threadId?: string; internalDate?: string; payload?: GmailPart; snippet?: string }
export interface FoundMessage { id: string; sourceId: string; searchId: string; from: string; subject: string; date: string }
export interface ReadLogEntry { at: string; action: "search" | "headers" | "attachment" | "skipped" | "revoked"; detail: string; sourceId?: string }
export interface StatementFile { name: string; mimeType: string; bytes: Uint8Array }

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const header = (m: GmailMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
const ATTACH_RE = /\.(pdf|csv)$/i;

/** Statement attachments (PDF/CSV) anywhere in the MIME tree. */
export function statementParts(part: GmailPart | undefined): GmailPart[] {
  if (!part) return [];
  const here = part.filename && ATTACH_RE.test(part.filename) && part.body?.attachmentId ? [part] : [];
  return [...here, ...(part.parts ?? []).flatMap(statementParts)];
}

export class GmailClient {
  readonly log: ReadLogEntry[] = [];
  private readonly allowed: string[];
  constructor(private token: string, private readonly sources: readonly Source[], private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i), private readonly now = () => new Date()) {
    this.allowed = statementQueries(sources).map((x) => x.q);
  }
  private note(action: ReadLogEntry["action"], detail: string, sourceId?: string) { this.log.push({ at: this.now().toISOString(), action, detail, ...(sourceId ? { sourceId } : {}) }); }
  private async get<T>(url: string): Promise<T> {
    assertAllowedGmailUrl(url, this.allowed);
    const r = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!r.ok) throw new Error(r.status === 401 ? "Gmail session expired. Connect again." : r.status === 403 ? "Gmail access was not granted." : `Gmail error ${r.status}`);
    return (await r.json()) as T;
  }

  /** Searches each picked finance source (statements only), then reads headers to re-check the sender. */
  async findStatements(maxPerSearch = 5): Promise<FoundMessage[]> {
    const found: FoundMessage[] = [];
    const seen = new Set<string>();
    for (const { sourceId, searchId, q } of statementQueries(this.sources)) {
      const src = this.sources.find((s) => s.id === sourceId)!;
      const list = await this.get<{ messages?: { id: string }[]; resultSizeEstimate?: number }>(`${GMAIL_API}/messages?${new URLSearchParams({ q, maxResults: String(maxPerSearch) })}`);
      this.note("search", `${src.name}: ${list.messages?.length ?? 0} match${list.messages?.length === 1 ? "" : "es"} · ${q}`, sourceId);
      for (const { id } of list.messages ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const m = await this.get<GmailMessage>(`${GMAIL_API}/messages/${id}?${new URLSearchParams([["format", "metadata"], ["metadataHeaders", "From"], ["metadataHeaders", "Subject"], ["metadataHeaders", "Date"]])}`);
        const from = header(m, "From");
        if (!senderAllowed(src, from)) { this.note("skipped", `Not a listed ${src.name} sender, dropped unread`, sourceId); continue; }
        const subject = header(m, "Subject");
        const date = m.internalDate ? new Date(Number(m.internalDate)).toISOString().slice(0, 10) : header(m, "Date");
        this.note("headers", `${date} · ${fromAddress(from)} · ${subject}`, sourceId);
        found.push({ id, sourceId, searchId, from: fromAddress(from), subject, date });
      }
    }
    return found.sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Downloads the PDF/CSV attachments of one allow-listed message. */
  async fetchStatementFiles(msg: FoundMessage): Promise<StatementFile[]> {
    const src = this.sources.find((s) => s.id === msg.sourceId);
    if (!src || !senderAllowed(src, msg.from)) throw new Error("Blocked: sender not in the finance list");
    const m = await this.get<GmailMessage>(`${GMAIL_API}/messages/${msg.id}?format=full`);
    if (!senderAllowed(src, header(m, "From"))) throw new Error("Blocked: sender not in the finance list");
    const files: StatementFile[] = [];
    for (const p of statementParts(m.payload)) {
      const a = await this.get<{ data: string; size?: number }>(`${GMAIL_API}/messages/${msg.id}/attachments/${p.body!.attachmentId!}`);
      files.push({ name: p.filename!, mimeType: p.mimeType || (p.filename!.toLowerCase().endsWith(".csv") ? "text/csv" : "application/pdf"), bytes: b64urlToBytes(a.data) });
      this.note("attachment", `${p.filename} from ${msg.from} (${msg.date})`, msg.sourceId);
    }
    return files;
  }

  forgetToken() { this.token = ""; }
}

/** Revokes the access token at Google (the browser calls Google directly). */
export async function revokeToken(token: string, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<boolean> {
  try {
    const r = await fetchImpl(`${REVOKE_URL}?${new URLSearchParams({ token })}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    return r.ok;
  } catch { return false; }
}
