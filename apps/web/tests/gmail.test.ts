// Gmail connect: allow-list, ID-token decoding and the client against a mocked (synthetic) Gmail API.
import { describe, expect, it } from "vitest";
import {
  assertAllowedGmailUrl, decodeIdToken, financeSources, fromAddress, GMAIL_API, GMAIL_SCOPE, GmailApiError, gmailApiError, interpretPopupError, interpretTokenResponse, GmailClient, GOOGLE_CLIENT_ID_DEFAULT, revokeToken,
  senderAllowed, senderDomains, statementParts, statementQueries, type FetchLike,
} from "../lib/gmail";
import { findSource } from "../lib/setup";

const b64url = (s: string | Uint8Array) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload: object) => `${b64url(JSON.stringify({ alg: "RS256" }))}.${b64url(JSON.stringify(payload))}.sig`;
const hdfc = findSource("hdfc-bank")!;

describe("ID token (display only)", () => {
  it("decodes name/email for our client and rejects other audiences", () => {
    const ok = decodeIdToken(jwt({ iss: "https://accounts.google.com", aud: GOOGLE_CLIENT_ID_DEFAULT, sub: "123", email: "Test.User@Example.com", name: "Test User", given_name: "Test", email_verified: true }));
    expect(ok).toEqual({ email: "test.user@example.com", sub: "123", name: "Test User", givenName: "Test", emailVerified: true });
    expect(decodeIdToken(jwt({ iss: "https://accounts.google.com", aud: "someone-else", sub: "1", email: "a@b.co" }))).toBeNull();
    expect(decodeIdToken("garbage")).toBeNull();
  });
});

describe("allow-list", () => {
  it("only bank/card/CAS sources, statement searches only", () => {
    const all = financeSources();
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((s) => ["bank", "card", "cas"].includes(s.kinds[0]))).toBe(true);
    expect(financeSources(["hdfc-bank", "netflix"]).map((s) => s.id)).toEqual(["hdfc-bank"]);
    const qs = statementQueries([hdfc]);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => q.q.includes("from:") && q.q.includes("has:attachment"))).toBe(true);
    expect(senderDomains([hdfc])).toContain("hdfcbank.net");
  });
  it("sender check: domain + subdomains, never look-alikes", () => {
    expect(fromAddress('"HDFC Bank" <Estatement@HDFCBank.net>')).toBe("estatement@hdfcbank.net");
    expect(senderAllowed(hdfc, "HDFC <alerts@hdfcbank.net>")).toBe(true);
    expect(senderAllowed(hdfc, "x@mail.hdfcbank.com")).toBe(true);
    expect(senderAllowed(hdfc, "x@hdfcbank.net.evil.example")).toBe(false);
    expect(senderAllowed(hdfc, "x@nothdfcbank.net")).toBe(false);
  });
  it("blocks any Gmail URL that isn't a catalog search, a message or an attachment", () => {
    const q = statementQueries([hdfc])[0].q;
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/messages?q=${encodeURIComponent(q)}`, [q])).not.toThrow();
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/messages?q=in%3Ainbox`, [q])).toThrow(/catalog/);
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/messages`, [q])).toThrow(/catalog/);
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/messages/abc/attachments/def`, [q])).not.toThrow();
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/messages/abc/modify`, [q])).toThrow();
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/threads`, [q])).toThrow();
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/history`, [q])).toThrow();
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/profile`, [q])).not.toThrow();
    expect(() => assertAllowedGmailUrl(`${GMAIL_API}/settings/filters`, [q])).toThrow();
    expect(() => assertAllowedGmailUrl("https://evil.example/gmail/v1/users/me/messages/abc", [q])).toThrow();
  });
});

describe("GmailClient with a mocked API (synthetic mail)", () => {
  const PDF = new TextEncoder().encode("%PDF-1.4 synthetic statement");
  const msgs: Record<string, { from: string; subject: string; date: number; parts?: object[] }> = {
    m1: { from: '"HDFC Bank" <estatement@hdfcbank.net>', subject: "Your account statement for Sep 2026 (synthetic)", date: Date.UTC(2026, 9, 2), parts: [{ partId: "1", mimeType: "application/pdf", filename: "Acct_Statement_SEP2026.pdf", body: { attachmentId: "att1", size: PDF.length } }] },
    m2: { from: "Phish <estatement@hdfcbank.net.evil.example>", subject: "Statement", date: Date.UTC(2026, 9, 1) },
  };
  function mock(): { fetch: FetchLike; calls: string[] } {
    const calls: string[] = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push(url);
      expect(init?.headers?.Authorization).toBe("Bearer ya29.synthetic");
      const u = new URL(url);
      const path = u.pathname.replace("/gmail/v1/users/me", "");
      const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      if (path === "/messages") return json({ messages: [{ id: "m1" }, { id: "m2" }], resultSizeEstimate: 2 });
      const att = path.match(/^\/messages\/(\w+)\/attachments\/(\w+)$/);
      if (att) return json({ data: b64url(PDF), size: PDF.length });
      const id = path.split("/")[2];
      const m = msgs[id];
      return json({ id, internalDate: String(m.date), payload: { headers: [{ name: "From", value: m.from }, { name: "Subject", value: m.subject }], parts: u.searchParams.get("format") === "full" ? m.parts ?? [] : undefined } });
    };
    return { fetch, calls };
  }

  it("finds statements, drops look-alike senders unread, fetches the PDF and logs every read", async () => {
    const { fetch, calls } = mock();
    const c = new GmailClient("ya29.synthetic", [hdfc], fetch, () => new Date("2026-10-03T08:00:00Z"));
    const found = await c.findStatements(5);
    expect(found.map((f) => f.id)).toEqual(["m1"]);
    expect(found[0]).toMatchObject({ sourceId: "hdfc-bank", from: "estatement@hdfcbank.net", date: "2026-10-02" });
    expect(c.log.some((e) => e.action === "skipped")).toBe(true);
    const files = await c.fetchStatementFiles(found[0]);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("Acct_Statement_SEP2026.pdf");
    expect(new TextDecoder().decode(files[0].bytes)).toContain("%PDF");
    // Never a full-format read or attachment for the dropped sender.
    expect(calls.some((u) => u.includes("/messages/m2?format=full") || u.includes("/messages/m2/attachments"))).toBe(false);
    expect(calls.every((u) => u.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages"))).toBe(true);
    expect(c.log.map((e) => e.action)).toEqual(expect.arrayContaining(["search", "headers", "skipped", "attachment"]));
  });

  it("refuses to fetch attachments for a sender outside the list", async () => {
    const { fetch } = mock();
    const c = new GmailClient("ya29.synthetic", [hdfc], fetch);
    await expect(c.fetchStatementFiles({ id: "m2", sourceId: "hdfc-bank", searchId: "statements", from: "x@evil.example", subject: "", date: "" })).rejects.toThrow(/Blocked/);
  });

  it("maps 401 to a reconnect message", async () => {
    const c = new GmailClient("ya29.synthetic", [hdfc], async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(c.findStatements()).rejects.toThrow(/Connect again/);
  });

  it("finds PDF/CSV parts in nested MIME", () => {
    expect(statementParts({ parts: [{ parts: [{ filename: "a.pdf", body: { attachmentId: "x" } }, { filename: "logo.png", body: { attachmentId: "y" } }] }, { filename: "b.CSV", body: { attachmentId: "z" } }] }).map((p) => p.filename)).toEqual(["a.pdf", "b.CSV"]);
  });

  it("revoke posts to Google's revoke endpoint only", async () => {
    const seen: { url: string; method?: string }[] = [];
    expect(await revokeToken("ya29.synthetic", async (url, init) => { seen.push({ url, method: init?.method }); return { ok: true, status: 200, json: async () => ({}) }; })).toBe(true);
    expect(seen[0].url.startsWith("https://oauth2.googleapis.com/revoke?token=")).toBe(true);
    expect(seen[0].method).toBe("POST");
  });
});

describe("grant + error handling (connect bug: 'Gmail access was not granted.' while shown as connected)", () => {
  const granted = (r: { scope?: string }, ...s: string[]) => s.every((x) => (r.scope ?? "").split(" ").includes(x));
  it("connects only when gmail.readonly is actually granted", () => {
    expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(interpretTokenResponse({ access_token: "ya29.x", expires_in: 3599, scope: `openid email ${GMAIL_SCOPE}` }, granted)).toEqual({ ok: true, token: "ya29.x", expiresIn: 3599 });
    // Granular consent with the Gmail box unticked: a token comes back, but without the scope.
    const unticked = interpretTokenResponse({ access_token: "ya29.x", scope: "openid email profile" }, granted);
    expect(unticked).toMatchObject({ ok: false, kind: "denied" });
    expect(interpretTokenResponse({ error: "access_denied" }, granted)).toMatchObject({ ok: false, kind: "denied" });
    expect(interpretTokenResponse({}, granted)).toMatchObject({ ok: false, kind: "error" });
  });
  it("a closed or blocked popup is not a denial", () => {
    expect(interpretPopupError({ type: "popup_closed" })).toMatchObject({ ok: false, kind: "closed" });
    expect(interpretPopupError({ type: "popup_failed_to_open" }).ok).toBe(false);
    expect(interpretPopupError({ type: "popup_failed_to_open" })).toMatchObject({ kind: "closed", message: expect.stringMatching(/pop-ups/) });
  });
  it("tells a disabled Gmail API apart from a missing grant", () => {
    const disabled = gmailApiError(403, { error: { code: 403, status: "PERMISSION_DENIED", message: "Gmail API has not been used in project 285824172297 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }], details: [{ reason: "SERVICE_DISABLED" }] } });
    expect(disabled).toMatchObject({ kind: "api-disabled", status: 403 });
    expect(disabled.message).not.toMatch(/wasn't granted|not granted/);
    expect(gmailApiError(403, { error: { status: "PERMISSION_DENIED", message: "Request had insufficient authentication scopes.", errors: [{ reason: "insufficientPermissions" }], details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } })).toMatchObject({ kind: "denied" });
    expect(gmailApiError(401, {})).toMatchObject({ kind: "expired" });
    expect(gmailApiError(429, { error: { errors: [{ reason: "rateLimitExceeded" }] } })).toMatchObject({ kind: "rate-limited" });
    expect(gmailApiError(500, null)).toMatchObject({ kind: "other" });
  });
  it("verifyAccess confirms via /profile only and logs failures in the read log", async () => {
    const calls: string[] = [];
    const ok = new GmailClient("ya29.synthetic", [hdfc], async (u) => { calls.push(u); return { ok: true, status: 200, json: async () => ({ emailAddress: "Tester@Gmail.com", messagesTotal: 1 }) }; });
    expect(await ok.verifyAccess()).toBe("tester@gmail.com");
    expect(calls).toEqual([`${GMAIL_API}/profile`]);
    expect(ok.log.map((e) => e.action)).toEqual(["check"]);
    const bad = new GmailClient("ya29.synthetic", [hdfc], async () => ({ ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: "accessNotConfigured" }], message: "Gmail API has not been used in project 1 before or it is disabled." } }) }));
    await expect(bad.verifyAccess()).rejects.toBeInstanceOf(GmailApiError);
    expect(bad.log).toHaveLength(1);
    expect(bad.log[0]).toMatchObject({ action: "error" });
    expect(bad.log[0].detail).toMatch(/403.*accessNotConfigured/);
  });
  it("a 403 during search is logged, not silent", async () => {
    const c = new GmailClient("ya29.synthetic", [hdfc], async () => ({ ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: "insufficientPermissions" }] } }) }));
    await expect(c.findStatements()).rejects.toMatchObject({ kind: "denied" });
    expect(c.log.map((e) => e.action)).toEqual(["error"]);
  });
});
