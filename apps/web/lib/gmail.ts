// Gmail connect (beta): pure helpers + a tiny Gmail REST client. Runs entirely in the browser.
// - Sign in with Google returns an ID token; we decode it locally for name/email only (never sent anywhere).
// - Gmail access uses the GIS token client with gmail.readonly; the access token lives in memory only.
// - Every Gmail request is allow-listed: messages.list needs a catalog-built `q`, and only
//   messages.get / attachments.get on users/me are allowed. Senders are re-checked before any body is read.
// Spec: setup-wizard.md §4 step 2 and §4.2a, google-oauth/account-login.md §3 (ported by hand).
import { CATALOG } from "./sources.gen";
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

/** Decodes Gmail's base64url (- and _, padding optional, stray whitespace ignored) into exact bytes. */
export function b64urlToBytes(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, "").replace(/=+$/, "");
  if (/[^A-Za-z0-9\-_+/]/.test(clean) || clean.length % 4 === 1) throw new Error("Gmail sent an attachment that couldn't be decoded.");
  const b64 = clean.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (clean.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** "%PDF-" must appear in the first 1 KB (the spec allows a little junk before it). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

/** Checks a downloaded attachment: exact size (when Gmail reports one) and a PDF header for .pdf files. */
export function checkAttachment(name: string, bytes: Uint8Array, expectedSize?: number): void {
  if (!bytes.length) throw new Error(`${name} downloaded empty from Gmail. Try again.`);
  if (expectedSize && bytes.length !== expectedSize) throw new Error(`${name} didn't download completely from Gmail (${bytes.length} of ${expectedSize} bytes). Try again.`);
  if (/\.pdf$/i.test(name) && !looksLikePdf(bytes)) throw new Error(`${name} from Gmail isn't a readable PDF (no PDF header). Try downloading it from Gmail and dropping it here.`);
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

/* ───────────── statement filter ───────────── */
/** Subject terms a real statement email carries. */
export const STATEMENT_SUBJECT_TERMS = ["statement", "\"e-statement\"", "estatement", "CAS", "\"consolidated account statement\"", "mailback"] as const;
/** Subject terms that mark non-statement mail (promos, EMI offers, OTPs, alerts, welcome mail). */
export const NON_STATEMENT_SUBJECT_TERMS = ["EMI", "offer", "offers", "\"thank you\"", "OTP", "alert", "alerts", "cashback", "reward", "rewards", "welcome", "congratulations", "\"pre-approved\"", "reminder", "upgrade"] as const;
export const STATEMENT_FILE_EXTS = ["pdf", "csv", "xls", "xlsx"] as const;

const STATEMENT_SUBJECT_RE = /\b(e-?statements?|statements?|cas|consolidated account statement|mail\s?back)\b/i;
const NON_STATEMENT_SUBJECT_RE = /\b(emi|offers?|thank\s+you|thanks for|otp|one[- ]time password|alerts?|cashback|rewards?|welcome|congratulations|pre-?approved|reminder|upgrade|promo(tion)?s?|sale|transaction alert|debited|credited|limit (increase|enhancement)|loan offer)\b/i;
const STATEMENT_FILE_RE = /\.(pdf|csv|xlsx?)$/i;

/** Gmail search for one sender group: statement subject, a statement-file attachment, and no promo/EMI/OTP subjects. */
export function gmailStatementQuery(source: Source, window = "2y"): string {
  const senders = [...source.senders.domains, ...source.senders.addresses];
  const from = senders.length === 1 ? `from:${senders[0]}` : `from:(${senders.join(" OR ")})`;
  return [
    from,
    `subject:(${STATEMENT_SUBJECT_TERMS.join(" OR ")})`,
    "has:attachment",
    `{${STATEMENT_FILE_EXTS.map((e) => `filename:${e}`).join(" ")}}`,
    `-subject:(${NON_STATEMENT_SUBJECT_TERMS.join(" OR ")})`,
    `newer_than:${window}`,
    ...source.senders.excludeDomains.map((d) => `-from:${d}`),
  ].join(" ");
}

/** One tight statement search per sender group (sources sharing senders, e.g. HDFC Bank + HDFC Card, share one search). */
export function statementQueries(sources: readonly Source[]): { sourceId: string; searchId: string; q: string; sourceIds: string[] }[] {
  const out: { sourceId: string; searchId: string; q: string; sourceIds: string[] }[] = [];
  for (const s of sources) {
    const search = s.searches.find((x) => x.attachment);
    if (!search) continue;
    const q = gmailStatementQuery(s, search.window || "2y");
    const same = out.find((x) => x.q === q);
    if (same) same.sourceIds.push(s.id);
    else out.push({ sourceId: s.id, searchId: search.id, q, sourceIds: [s.id] });
  }
  return out;
}

export type StatementVerdict = { ok: true } | { ok: false; reason: "no-statement-file" | "not-statement-subject" | "non-statement-subject" };
/** Client-side check after reading headers: a statement-like subject, no promo/EMI/OTP terms, and a PDF/CSV/XLS attachment. */
export function classifyStatement(subject: string, attachmentNames: readonly string[]): StatementVerdict {
  if (NON_STATEMENT_SUBJECT_RE.test(subject)) return { ok: false, reason: "non-statement-subject" };
  if (!STATEMENT_SUBJECT_RE.test(subject)) return { ok: false, reason: "not-statement-subject" };
  if (!attachmentNames.some((n) => STATEMENT_FILE_RE.test(n))) return { ok: false, reason: "no-statement-file" };
  return { ok: true };
}
const VERDICT_TEXT: Record<Exclude<StatementVerdict, { ok: true }>["reason"], string> = {
  "no-statement-file": "no PDF/CSV/XLS statement attached",
  "not-statement-subject": "subject isn't a statement",
  "non-statement-subject": "promo, EMI, OTP or alert mail",
};

/** Sources sharing a sender: card statements go to the card source, the rest to the bank/CAS source. */
export function pickSource(candidates: readonly Source[], subject: string): Source {
  const card = /credit\s*card|card\s*statement/i.test(subject);
  return candidates.find((s) => (s.kinds[0] === "card") === card) ?? candidates[0];
}

const normSubject = (s: string) => s.toLowerCase().replace(/^((re|fwd?|fw)\s*:\s*)+/i, "").replace(/[^a-z0-9]+/g, " ").trim();
/** Same statement sent twice (or in one thread): keep the newest, count copies. Keyed by thread, then subject + sender + attachment. */
export function dedupeStatements(found: readonly FoundMessage[]): FoundMessage[] {
  const sorted = [...found].sort((a, b) => b.date.localeCompare(a.date) || (b.internalDate ?? 0) - (a.internalDate ?? 0));
  const out: FoundMessage[] = [];
  const byKey = new Map<string, FoundMessage>();
  const seenIds = new Set<string>();
  for (const m of sorted) {
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    const att = m.attachments?.[0];
    const keys = [
      ...(m.threadId ? [`t:${m.threadId}`] : []),
      `s:${normSubject(m.subject)}|${m.from}`,
      ...(att ? [`a:${normSubject(m.subject)}|${m.from}|${att.name.toLowerCase()}|${att.size ?? ""}`] : []),
    ];
    const keep = keys.map((k) => byKey.get(k)).find(Boolean);
    if (keep) { keep.copies = (keep.copies ?? 1) + 1; keep.dupIds = [...(keep.dupIds ?? []), m.id]; continue; }
    const row = { ...m, copies: 1, dupIds: [] as string[] };
    keys.forEach((k) => byKey.set(k, row));
    out.push(row);
  }
  return out;
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
  if (path === "/profile") return; // access check on connect: mailbox address only, no mail content
  if (/^\/messages\/[A-Za-z0-9_-]+$/.test(path) || /^\/messages\/[A-Za-z0-9_-]+\/attachments\/[A-Za-z0-9_-]+$/.test(path)) return;
  throw new Error("Blocked: endpoint not allowed");
}

/* ───────────── Gmail client ───────────── */
export interface GmailPart { partId?: string; mimeType?: string; filename?: string; headers?: { name: string; value: string }[]; body?: { attachmentId?: string; size?: number; data?: string }; parts?: GmailPart[] }
export interface GmailMessage { id: string; threadId?: string; internalDate?: string; payload?: GmailPart; snippet?: string }
export interface FoundMessage {
  id: string; sourceId: string; searchId: string; from: string; subject: string; date: string;
  threadId?: string; internalDate?: number;
  /** Statement attachments (name + size only, read from the MIME structure; no body). */
  attachments?: { name: string; size?: number }[];
  /** Identical statement emails folded into this row (newest kept). */
  copies?: number; dupIds?: string[];
}
export interface ReadLogEntry { at: string; action: "search" | "headers" | "attachment" | "skipped" | "revoked" | "error" | "check"; detail: string; sourceId?: string }
export interface StatementFile { name: string; mimeType: string; bytes: Uint8Array }

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const header = (m: GmailMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
const ATTACH_RE = STATEMENT_FILE_RE;
/** MIME structure + headers only: never the message body or attachment bytes. */
const STRUCTURE_FIELDS = "id,threadId,internalDate,payload(headers,filename,mimeType,body(attachmentId,size),parts(filename,mimeType,body(attachmentId,size),parts(filename,mimeType,body(attachmentId,size),parts(filename,mimeType,body(attachmentId,size)))))";

/** Statement attachments (PDF/CSV) anywhere in the MIME tree. */
export function statementParts(part: GmailPart | undefined): GmailPart[] {
  if (!part) return [];
  const here = part.filename && ATTACH_RE.test(part.filename) && part.body?.attachmentId ? [part] : [];
  return [...here, ...(part.parts ?? []).flatMap(statementParts)];
}

/** Why a Gmail API call failed. kind drives the UI: "denied" = re-ask the user, "api-disabled" = fix in Google Cloud. */
export type GmailErrorKind = "expired" | "denied" | "api-disabled" | "rate-limited" | "other";
export class GmailApiError extends Error {
  constructor(message: string, readonly status: number, readonly kind: GmailErrorKind, readonly reason?: string) { super(message); this.name = "GmailApiError"; }
}

/** Maps a Gmail API error (status + Google JSON error body) to a precise, user-facing error. */
export function gmailApiError(status: number, body: unknown): GmailApiError {
  const e = (body as { error?: { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } } | null)?.error;
  const reasons = [e?.status, ...(e?.errors ?? []).map((x) => x.reason), ...(e?.details ?? []).map((x) => x.reason)].filter(Boolean) as string[];
  const has = (...r: string[]) => reasons.some((x) => r.includes(x));
  const reason = reasons.find((x) => x !== "PERMISSION_DENIED") ?? reasons[0];
  if (status === 401) return new GmailApiError("Gmail session expired. Connect again.", status, "expired", reason);
  if (has("accessNotConfigured", "SERVICE_DISABLED") || /has not been used in project|is disabled/i.test(e?.message ?? ""))
    return new GmailApiError("Google accepted the connection, but the Gmail API is switched off for Lakshly's Google Cloud project. This is on our side, not yours; we're fixing it.", status, "api-disabled", reason ?? "accessNotConfigured");
  if (has("rateLimitExceeded", "userRateLimitExceeded", "RATE_LIMIT_EXCEEDED", "RESOURCE_EXHAUSTED") || status === 429)
    return new GmailApiError("Google is rate-limiting Gmail requests. Wait a minute and try again.", status, "rate-limited", reason);
  if (status === 403) return new GmailApiError("Gmail read access wasn't granted. Try again and tick the Gmail box on Google's screen.", status, "denied", reason ?? "insufficientPermissions");
  return new GmailApiError(`Gmail error ${status}${e?.message ? `: ${e.message}` : ""}`, status, "other", reason);
}

export interface TokenResponseLike { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
export type TokenOutcome = { ok: true; token: string; expiresIn: number } | { ok: false; kind: "denied" | "closed" | "error"; message: string };

/** Decides whether a GIS token response really grants gmail.readonly. Only ok:true may mark Gmail as connected. */
export function interpretTokenResponse(resp: TokenResponseLike, hasGrantedAllScopes: (r: TokenResponseLike, ...s: string[]) => boolean): TokenOutcome {
  if (resp.error === "access_denied") return { ok: false, kind: "denied", message: "You didn't give Lakshly Gmail access. Nothing was read." };
  if (resp.error || !resp.access_token) return { ok: false, kind: "error", message: resp.error_description || resp.error || "Google didn't return access." };
  if (!hasGrantedAllScopes(resp, GMAIL_SCOPE)) return { ok: false, kind: "denied", message: "Gmail read access wasn't granted. On Google's screen, tick \u201cView your email messages and settings\u201d, then continue." };
  return { ok: true, token: resp.access_token, expiresIn: resp.expires_in ?? 3600 };
}

/** GIS error_callback (popup closed/blocked) is not a denial: the user can simply try again. */
export function interpretPopupError(e: { type?: string; message?: string }): TokenOutcome {
  if (e.type === "popup_closed") return { ok: false, kind: "closed", message: "The Google window was closed before Gmail access was given." };
  if (e.type === "popup_failed_to_open") return { ok: false, kind: "closed", message: "Your browser blocked Google's window. Allow pop-ups for this site and try again." };
  return { ok: false, kind: "error", message: e.message || "Google didn't connect." };
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
    if (!r.ok) {
      let body: unknown = null;
      try { body = await r.json(); } catch { /* no JSON body */ }
      const err = gmailApiError(r.status, body);
      this.note("error", `Gmail API ${r.status}${err.reason ? ` (${err.reason})` : ""}: ${err.message}`);
      throw err;
    }
    return (await r.json()) as T;
  }

  /** Confirms the token really works for Gmail before the UI says "connected". Returns the mailbox address. */
  async verifyAccess(): Promise<string> {
    const p = await this.get<{ emailAddress?: string }>(`${GMAIL_API}/profile`);
    const email = (p.emailAddress ?? "").toLowerCase();
    this.note("check", `Gmail read-only access confirmed for ${email || "this mailbox"} (no mail read)`);
    return email;
  }

  /** Searches each finance sender group with the tight statement query, reads only headers + MIME structure,
   *  re-checks sender, subject and attachment on this device, then folds duplicates (newest kept). */
  async findStatements(maxPerSearch = 10): Promise<FoundMessage[]> {
    const found: FoundMessage[] = [];
    const seen = new Set<string>();
    for (const { searchId, q, sourceIds } of statementQueries(this.sources)) {
      const cands = sourceIds.map((id) => this.sources.find((s) => s.id === id)!);
      const label = cands.map((c) => c.name).join(" / ");
      const list = await this.get<{ messages?: { id: string; threadId?: string }[]; resultSizeEstimate?: number }>(`${GMAIL_API}/messages?${new URLSearchParams({ q, maxResults: String(maxPerSearch) })}`);
      this.note("search", `${label}: ${list.messages?.length ?? 0} match${list.messages?.length === 1 ? "" : "es"} · ${q}`, cands[0].id);
      for (const { id } of list.messages ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const m = await this.get<GmailMessage>(`${GMAIL_API}/messages/${id}?${new URLSearchParams({ format: "full", fields: STRUCTURE_FIELDS })}`);
        const from = header(m, "From");
        const subject = header(m, "Subject");
        const src = pickSource(cands.filter((c) => senderAllowed(c, from)).length ? cands.filter((c) => senderAllowed(c, from)) : cands, subject);
        if (!senderAllowed(src, from)) { this.note("skipped", `Not a listed ${src.name} sender, dropped unread`, src.id); continue; }
        const parts = statementParts(m.payload);
        const verdict = classifyStatement(subject, parts.map((p) => p.filename ?? ""));
        if (!verdict.ok) { this.note("skipped", `${subject || "(no subject)"}: ${VERDICT_TEXT[verdict.reason]}, not listed`, src.id); continue; }
        const internalDate = m.internalDate ? Number(m.internalDate) : undefined;
        const date = internalDate ? new Date(internalDate).toISOString().slice(0, 10) : header(m, "Date");
        this.note("headers", `${date} · ${fromAddress(from)} · ${subject}`, src.id);
        found.push({ id, sourceId: src.id, searchId, from: fromAddress(from), subject, date, ...(m.threadId ? { threadId: m.threadId } : {}), ...(internalDate ? { internalDate } : {}), attachments: parts.map((p) => ({ name: p.filename!, ...(p.body?.size ? { size: p.body.size } : {}) })) });
      }
    }
    return dedupeStatements(found);
  }

  /** Downloads the PDF/CSV attachments of one allow-listed message. */
  async fetchStatementFiles(msg: FoundMessage): Promise<StatementFile[]> {
    const src = this.sources.find((s) => s.id === msg.sourceId);
    if (!src || !senderAllowed(src, msg.from)) throw new Error("Blocked: sender not in the finance list");
    const m = await this.get<GmailMessage>(`${GMAIL_API}/messages/${msg.id}?${new URLSearchParams({ format: "full", fields: STRUCTURE_FIELDS })}`);
    if (!senderAllowed(src, header(m, "From"))) throw new Error("Blocked: sender not in the finance list");
    const files: StatementFile[] = [];
    for (const p of statementParts(m.payload)) {
      // Always the attachments endpoint (full file), never a truncated inline body.
      const a = await this.get<{ data: string; size?: number }>(`${GMAIL_API}/messages/${msg.id}/attachments/${p.body!.attachmentId!}`);
      const bytes = b64urlToBytes(a.data ?? "");
      checkAttachment(p.filename!, bytes, a.size ?? p.body?.size);
      files.push({ name: p.filename!, mimeType: p.mimeType || (/\.csv$/i.test(p.filename!) ? "text/csv" : /\.xlsx?$/i.test(p.filename!) ? "application/vnd.ms-excel" : "application/pdf"), bytes });
      this.note("attachment", `${p.filename} from ${msg.from} (${msg.date}) · ${bytes.length.toLocaleString("en-IN")} bytes, size matches Gmail${/\.pdf$/i.test(p.filename!) ? ", PDF header OK" : ""}`, msg.sourceId);
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
