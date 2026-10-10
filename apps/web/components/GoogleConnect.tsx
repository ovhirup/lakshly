"use client";
// Sign in with Google + Gmail connect (beta). Google Identity Services in this browser only:
// the ID token is decoded locally (name/email), the gmail.readonly access token stays in memory,
// Gmail is called directly from the browser, and nothing goes to Lakshly's servers.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/edition";
import { decodeIdToken, financeSources, GMAIL_SCOPE, GmailApiError, GmailClient, gmailPane, interpretPopupError, interpretTokenResponse, revokeToken, senderDomains, type FoundMessage, type GoogleIdentity, type ReadLogEntry } from "@/lib/gmail";
import { CATALOG } from "@/lib/sources.gen";
import { Glass } from "./ui";
import { Icon } from "./Icon";
import { Importer, importToast } from "./Importer";
import { GmailResults, gmailRef } from "./GmailResults";
import type { MergeReport, ParseResult } from "@lakshly/parsers";

/* ───────── minimal GIS typings ───────── */
interface TokenResponse { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
interface Gis {
  accounts: {
    id: { initialize: (c: Record<string, unknown>) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void; disableAutoSelect: () => void };
    oauth2: {
      initTokenClient: (c: Record<string, unknown>) => { requestAccessToken: (o?: Record<string, unknown>) => void };
      hasGrantedAllScopes: (r: TokenResponse, ...scopes: string[]) => boolean;
      revoke: (token: string, done?: () => void) => void;
    };
  };
}
declare global { interface Window { google?: Gis } }

let gisPromise: Promise<Gis> | null = null;
export function loadGis(): Promise<Gis> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts) return Promise.resolve(window.google);
  gisPromise ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => (window.google?.accounts ? resolve(window.google) : reject(new Error("Google sign-in didn't load")));
    s.onerror = () => { gisPromise = null; reject(new Error("Couldn't reach Google. Check your connection or content blocker.")); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/* ───────── in-memory store (never persisted) ───────── */
/** retry: show "Try again" (re-prompts with prompt:'consent') after a denial, a closed popup or a Gmail 403. */
interface GState { identity: GoogleIdentity | null; token: string | null; expiresAt: number; email: string | null; log: ReadLogEntry[]; found: FoundMessage[] | null; busy: string | null; error: string | null; retry: boolean }
let st: GState = { identity: null, token: null, expiresAt: 0, email: null, log: [], found: null, busy: null, error: null, retry: false };
let client: GmailClient | null = null;
const subs = new Set<() => void>();
const set = (patch: Partial<GState>) => { st = { ...st, ...patch }; subs.forEach((l) => l()); };
const SERVER: GState = st;
export function useGoogle(): GState { return useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => st, () => SERVER); }
const logNow = () => client ? [...client.log] : st.log;

/* ───────── Sign in with Google ───────── */
// google.accounts.id.initialize() must run once per page (GIS warns and misbehaves when called again on
// every mount). One module-level init; the active button's handler is swapped in through a ref.
let gsiInitFor: string | null = null;
let gsiHandler: ((r: { credential?: string }) => void) | null = null;
export function initGsiOnce(gis: Gis, clientId: string): boolean {
  if (gsiInitFor === clientId) return false;
  gis.accounts.id.initialize({
    client_id: clientId, auto_select: false, ux_mode: "popup", context: "signin", itp_support: true,
    // The popup button flow: a cancelled FedCM sheet otherwise logs NetworkError/AbortError noise.
    use_fedcm_for_button: false,
    callback: (r: { credential?: string }) => gsiHandler?.(r),
  });
  gsiInitFor = clientId;
  return true;
}
/** Test hook: forget the one-time init. */
export function resetGsiForTests() { gsiInitFor = null; gsiHandler = null; }

export function SignInWithGoogle({ onIdentity }: { onIdentity?: (id: GoogleIdentity) => void }) {
  const g = useGoogle();
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onIdentity);
  useEffect(() => { cb.current = onIdentity; });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (g.identity) return;
    let alive = true;
    loadGis().then((gis) => {
      if (!alive || !ref.current) return;
      gsiHandler = (r) => {
        // No credential = the person closed or cancelled Google's window: stay quiet, the button is still there.
        if (!r.credential) return;
        const id = decodeIdToken(r.credential, GOOGLE_CLIENT_ID); // decoded here, never sent anywhere
        if (!id) { setErr("Google sign-in didn't return a valid account."); return; }
        set({ identity: id }); cb.current?.(id);
      };
      try { initGsiOnce(gis, GOOGLE_CLIENT_ID); } catch { /* GIS throws only on a bad config; the button below then shows its own state */ }
      const dark = document.documentElement.dataset.appearance === "dark";
      gis.accounts.id.renderButton(ref.current, { type: "standard", theme: dark ? "filled_black" : "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "left", width: 280 });
    }).catch((e: Error) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [g.identity]);

  if (g.identity) {
    return (
      <div className="gsi-signed-in" data-testid="gsi-signed-in">
        <span className="gsi-avatar" aria-hidden="true">{(g.identity.givenName || g.identity.name || g.identity.email)[0]?.toUpperCase()}</span>
        <span className="grow"><strong>{g.identity.name || g.identity.email}</strong><small className="muted">{g.identity.email} · signed in with Google on this device</small></span>
        <button className="btn ghost small" onClick={() => { window.google?.accounts.id.disableAutoSelect(); set({ identity: null }); }}>Sign out</button>
      </div>
    );
  }
  return (
    <div className="gsi-wrap">
      <div ref={ref} className="gsi-button" data-testid="gsi-button" />
      {err && <p className="tiny down" role="alert">{err}</p>}
      <p className="tiny muted">Asks Google for your name and email only. Used to fill in your name and inbox here; not sent to Lakshly.</p>
    </div>
  );
}

/* ───────── Gmail connect ───────── */
/** Requests gmail.readonly. "Connected" (token set) only after Google grants the scope AND Gmail answers a profile check. */
export async function connectGmail(loginHint: string | undefined, picked: readonly string[], opts: { consent?: boolean } = {}): Promise<void> {
  set({ busy: "Waiting for Google…", error: null, retry: false });
  try {
    const gis = await loadGis();
    const outcome = await new Promise<ReturnType<typeof interpretTokenResponse>>((resolve) => {
      const tc = gis.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: GMAIL_SCOPE, include_granted_scopes: true, ...(loginHint ? { login_hint: loginHint } : {}),
        callback: (r: TokenResponse) => resolve(interpretTokenResponse(r, (x, ...s) => gis.accounts.oauth2.hasGrantedAllScopes(x, ...s))),
        error_callback: (e: { type?: string; message?: string }) => resolve(interpretPopupError(e)),
      });
      // Try again forces Google's consent screen so the Gmail checkbox is shown (and can be ticked) again.
      tc.requestAccessToken({ prompt: opts.consent ? "consent" : "" });
    });
    if (!outcome.ok) { set({ busy: null, error: outcome.message, retry: true }); return; }
    const c = new GmailClient(outcome.token, financeSources(picked));
    set({ busy: "Checking Gmail access…" });
    let mailbox: string;
    try { mailbox = await c.verifyAccess(); }
    catch (e) {
      c.forgetToken();
      const err = e as GmailApiError;
      set({ busy: null, error: err.message, retry: err.kind !== "api-disabled", log: [...c.log] });
      return;
    }
    client = c;
    const tok = outcome.token;
    const ttl = outcome.expiresIn * 1000;
    window.setTimeout(() => { if (st.token === tok) { client?.forgetToken(); client = null; set({ token: null, found: null, retry: true, error: "Gmail access ended after an hour (Google's limit). Connect again to keep going." }); } }, ttl);
    set({ token: tok, expiresAt: Date.now() + ttl, email: mailbox || loginHint || null, busy: null, found: null, error: null, retry: false, log: [...c.log] });
  } catch (e) {
    set({ busy: null, error: (e as Error).message, retry: true });
  }
}

/** A Gmail 403/401 after connecting means the access is gone: drop it and offer Try again. */
function onGmailFailure(e: unknown) {
  const kind = e instanceof GmailApiError ? e.kind : "other";
  if (kind === "denied" || kind === "expired") {
    client?.forgetToken(); const log = logNow(); client = null;
    set({ token: null, found: null, busy: null, error: (e as Error).message, retry: true, log });
  } else set({ busy: null, error: (e as Error).message, log: logNow() });
}

export async function disconnectGmail(): Promise<void> {
  const token = st.token;
  client?.forgetToken();
  const log = [...logNow(), { at: new Date().toISOString(), action: "revoked" as const, detail: "Access revoked at Google and removed from this browser" }];
  client = null;
  set({ token: null, expiresAt: 0, found: null, busy: null, error: null, retry: false, log });
  if (!token) return;
  const gis = window.google?.accounts?.oauth2;
  if (gis) gis.revoke(token); else await revokeToken(token);
}

/** Look for statement mail only when this tab already has a Gmail token. Does not connect or open a window. */
export async function checkConnectedMailbox(): Promise<{ connected: false } | { connected: true; found: number }> {
  if (!st.token || !client) return { connected: false };
  const found = await client.findStatements(5);
  set({ found, busy: null, error: null, log: logNow() });
  return { connected: true, found: found.length };
}

export function GmailConnectCard({ email, picked, onImported }: { email: string; picked: readonly string[]; onImported?: (sourceId: string, r: ParseResult, report: MergeReport) => void }) {
  const g = useGoogle();
  const [consent, setConsent] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [incoming, setIncoming] = useState<{ file: File; sourceId: string; ref?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const sources = financeSources(picked);
  const domains = senderDomains(sources);
  const connected = !!g.token;
  const pane = gmailPane(connected, consent);
  const isGmail = /@(gmail|googlemail)\.com$/i.test(email) || !!g.identity;
  const hint = email || g.identity?.email;
  const nameOf = (id: string) => CATALOG.sources.find((s) => s.id === id)?.name ?? id;

  async function find() {
    if (!client) return;
    set({ busy: "Searching finance senders…", error: null });
    try { const found = await client.findStatements(5); set({ found, busy: null, log: logNow() }); }
    catch (e) { onGmailFailure(e); }
  }
  /** Downloads the first statement attachment of one listed email (browser ↔ Google only). */
  async function fetchFile(m: FoundMessage): Promise<File | null> {
    if (!client) throw new Error("Gmail isn't connected any more. Connect again.");
    try {
      const files = await client.fetchStatementFiles(m);
      set({ log: logNow() });
      const f = files[0];
      return f ? new File([f.bytes.slice().buffer as ArrayBuffer], f.name, { type: f.mimeType }) : null;
    } catch (e) { set({ log: logNow() }); onGmailFailure(e); throw e; }
  }
  async function fetchOne(m: FoundMessage) {
    if (!client) return;
    set({ busy: `Downloading ${m.subject}…`, error: null });
    try {
      const file = await fetchFile(m);
      set({ busy: null });
      if (!file) { set({ error: "That email has no PDF or CSV statement attached." }); return; }
      setIncoming({ file, sourceId: m.sourceId, ref: gmailRef(m.id) });
    } catch { set({ busy: null }); }
  }
  const hintsFor = (id: string) => CATALOG.sources.find((s) => s.id === id)?.passwordHints.map((k) => CATALOG.passwordHintFormats[k]).filter(Boolean);

  return (
    <Glass className="card connect-card gmail-card" as="div">
      <div className="card-head"><h3><Icon name="shield" size={16} /> Connect Gmail (read-only)</h3><span className="badge soon-pill" data-testid="gmail-soon">Coming soon · testers only</span></div>
      {pane === "start" ? (
        <>
          <p className="muted tiny" data-testid="gmail-invite-note">Google currently allows Gmail connect only for invited testers; everyone else, use manual import above.</p>
          <div className="row-actions">
            <button className="btn outline" onClick={() => setConsent(true)} disabled={!isGmail && !!email} data-testid="gmail-start">Connect Gmail (read-only)</button>
          </div>
          {!isGmail && !!email && <p className="tiny muted">Gmail connect works for Gmail and Google Workspace addresses. For other mailboxes, use the guided search below.</p>}
        </>
      ) : pane === "consent" ? (
        <div className="consent-sheet" role="group" aria-label="What Lakshly will read" data-testid="gmail-consent">
          <h4>Before you connect</h4>
          <ul>
            <li><b>Only finance senders.</b> Lakshly searches {domains.length} sender domains of {sources.length} banks, cards and CAS providers{picked.length ? " you picked" : ""}. <button className="linkish" aria-expanded={showDomains} onClick={() => setShowDomains(!showDomains)}>{showDomains ? "Hide list" : "Show list"}</button></li>
            {showDomains && <li className="domain-list"><code>{domains.join(" · ")}</code></li>}
            <li><b>What is read:</b> matching statement emails (date, sender, subject) and their PDF/CSV attachments. Everything else in your inbox is never searched or opened.</li>
            <li><b>Where it goes:</b> straight from Google to this browser. Statements are read on this device. Nothing is sent to Lakshly.</li>
            <li><b>Read-only:</b> Lakshly can&apos;t send, delete, label or mark anything. Access is kept in memory and ends when you close the tab.</li>
            <li><b>Withdraw any time:</b> Disconnect revokes access at Google in one tap.</li>
          </ul>
          <p className="tiny muted">Beta: Google allows Gmail access only for invited test accounts while Lakshly&apos;s app review is pending.</p>
          <div className="row-actions">
            <button className="btn outline" disabled={!!g.busy} onClick={() => void connectGmail(hint, picked)} data-testid="gmail-agree">Agree and connect</button>
            <button className="btn ghost" onClick={() => setConsent(false)}>Not now</button>
          </div>
        </div>
      ) : (
        <div className="mailbox" data-testid="gmail-connected">
          <div className="mailbox-head">
            <span className="provider-dot" aria-hidden="true">G</span>
            <span className="grow"><strong>{g.email || g.identity?.email || "Gmail"}</strong><small className="muted">Read-only · finance senders only · access ends when you close this tab</small></span>
            <button className="btn ghost small" onClick={() => { setConsent(false); void disconnectGmail(); }} data-testid="gmail-disconnect">Disconnect</button>
          </div>
          <div className="row-actions">
            <button className="btn primary" disabled={!!g.busy} onClick={() => void find()} data-testid="gmail-find">{g.found ? "Search again" : "Find my statements"}</button>
            <button className="btn ghost" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>Read log ({g.log.length})</button>
          </div>
          {g.found && (
            g.found.length ? (
              <GmailResults key={g.found.map((m) => m.id).join(",")} found={g.found} disabled={!!g.busy} nameOf={nameOf} passwordHintsFor={hintsFor}
                fetchFile={fetchFile} onImportOne={(m) => void fetchOne(m)} onImported={onImported} />
            ) : <p className="muted tiny">No statement emails from these senders yet. Try the guided search, or pick more accounts.</p>
          )}
          {incoming && (
            <Importer incoming={incoming.file} sourceId={incoming.sourceId} importRef={incoming.ref} prompt="Or drop another statement here"
              passwordHints={hintsFor(incoming.sourceId)}
              onImported={(r, report) => { setToast(importToast(report)); setTimeout(() => setToast(null), 4000); onImported?.(incoming.sourceId, r, report); setIncoming(null); }} />
          )}
          {showLog && (
            <ol className="read-log" aria-label="Read log">
              {g.log.length ? g.log.map((e, i) => <li key={i}><span className={`log-tag ${e.action}`}>{e.action}</span> {e.detail}</li>) : <li className="muted">Nothing read yet.</li>}
            </ol>
          )}
        </div>
      )}
      {g.busy && <p className="tiny muted" role="status"><span className="spinner small" aria-hidden="true" /> {g.busy}</p>}
      {g.error && (
        <div className="gmail-error" role="alert" data-testid="gmail-error">
          <p className="tiny down">{g.error}</p>
          {g.retry && !connected && <button className="btn outline small" disabled={!!g.busy} onClick={() => void connectGmail(hint, picked, { consent: true })} data-testid="gmail-retry">Try again</button>}
        </div>
      )}
      {!connected && g.log.some((e) => e.action === "revoked") && !g.error && <p className="tiny muted">Disconnected. Access was revoked at Google.</p>}
      {toast && <p className="tiny up" role="status">{toast}</p>}
    </Glass>
  );
}
