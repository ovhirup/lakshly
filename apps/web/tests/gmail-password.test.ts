// Regression: a password-protected statement fetched from Gmail must open with the right password.
// Synthetic locked PDF (pdf-lib fixture), mocked Gmail, real pdf.js (legacy build) for decryption.
import { beforeAll, describe, expect, it } from "vitest";
import { b64urlToBytes, checkAttachment, GmailClient, looksLikePdf, type FetchLike, type FoundMessage } from "../lib/gmail";
import { runBulkImport, type ParseOutcome } from "../lib/gmail-bulk";
import { passwordAttempts, withPasswordAttempts } from "../lib/import/client";
import { extractPdfText, parseDocument, PasswordRequiredError, pdfErrorMessage, type PdfJsLike, type ParseResult } from "@lakshly/parsers";
import * as F from "../../../packages/parsers/tests/fixtures/synthetic";
import { findSource } from "../lib/setup";

let pdfjs: PdfJsLike;
beforeAll(async () => {
  // pdf.js 6 needs Promise.withResolvers (Node 22+); polyfill for the Node 20 test runner.
  const P = Promise as unknown as { withResolvers?: () => unknown };
  P.withResolvers ??= function <T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsLike;
});

const b64url = (b: Uint8Array, pad = false) => { const s = Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"); return pad ? s : s.replace(/=+$/, ""); };

/** Mirrors parseFile: a fresh copy of the bytes for every attempt, exact password first. */
function parser(file: File) {
  return (pw?: string) => withPasswordAttempts(async (p): Promise<ParseOutcome<ParseResult>> => {
    const bytes = new Uint8Array((await file.arrayBuffer()).slice(0));
    try { return { kind: "result", result: parseDocument(await extractPdfText(pdfjs, bytes, { password: p, fileName: file.name })) }; }
    catch (e) { return e instanceof PasswordRequiredError ? { kind: "password", incorrect: e.incorrect } : { kind: "error", message: pdfErrorMessage(e) }; }
  }, pw);
}

describe("base64url attachment decoding", () => {
  it("round-trips binary bytes with - and _, with or without padding", async () => {
    const bytes = await F.casPdf(F.PASSWORD);
    expect(b64url(bytes)).toMatch(/[-_]/);
    for (const pad of [false, true]) {
      const back = b64urlToBytes(b64url(bytes, pad));
      expect(back.length).toBe(bytes.length);
      expect(Buffer.compare(Buffer.from(back), Buffer.from(bytes))).toBe(0);
      expect(looksLikePdf(back)).toBe(true);
    }
    const all = new Uint8Array(256).map((_, i) => i);
    for (let n = 0; n < 8; n++) expect([...b64urlToBytes(b64url(all.subarray(0, 250 + n)))]).toEqual([...all.subarray(0, 250 + n)]);
  });
  it("rejects incomplete or non-PDF downloads instead of letting them look like a wrong password", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 synthetic");
    expect(() => checkAttachment("cas.pdf", pdf, pdf.length)).not.toThrow();
    expect(() => checkAttachment("cas.pdf", pdf.subarray(0, 5), pdf.length)).toThrow(/didn't download completely/);
    expect(() => checkAttachment("cas.pdf", new TextEncoder().encode("<html>"), 6)).toThrow(/isn't a readable PDF/);
    expect(() => checkAttachment("cas.pdf", new Uint8Array(0))).toThrow(/empty/);
    expect(() => b64urlToBytes("ab$c")).toThrow(/couldn't be decoded/);
  });
});

describe("password attempts", () => {
  it("exact password first; only invisible slips retried; case never changed", () => {
    expect(passwordAttempts("Ab#12 x")).toEqual(["Ab#12 x"]);
    expect(passwordAttempts(" Ab#12 ")).toEqual([" Ab#12 ", "Ab#12"]);
    expect(passwordAttempts("ＡＢ12")).toEqual(["ＡＢ12", "AB12"]);
    expect(passwordAttempts(undefined)).toEqual([undefined]);
    expect(passwordAttempts("abcd").some((p) => p === "ABCD")).toBe(false);
  });
});

describe("Gmail → bulk import of a locked CAS (synthetic)", () => {
  const cams = findSource("cams-cas")!;
  async function fetchFromMockGmail(bytes: Uint8Array) {
    const fetch: FetchLike = async (url) => {
      const path = new URL(url).pathname.replace("/gmail/v1/users/me", "");
      const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      if (path.includes("/attachments/")) return json({ size: bytes.length, data: b64url(bytes) });
      return json({ id: "c1", payload: { headers: [{ name: "From", value: "CAMS <donotreply@camsonline.com>" }], parts: [{ filename: "CAS_SYNTH_0000891.pdf", mimeType: "application/pdf", body: { attachmentId: "att-1_x-Y", size: bytes.length } }] } });
    };
    const c = new GmailClient("ya29.synthetic", [cams], fetch);
    const m: FoundMessage = { id: "c1", sourceId: "cams-cas", searchId: "cas", from: "donotreply@camsonline.com", subject: "Consolidated Account Statement (synthetic)", date: "2026-10-02" };
    const files = await c.fetchStatementFiles(m);
    return { m, file: new File([files[0].bytes.slice().buffer as ArrayBuffer], files[0].name, { type: files[0].mimeType }), log: c.log };
  }

  it("downloads exact bytes and opens after a wrong attempt, using the newly typed password", async () => {
    const original = await F.casPdf(F.PASSWORD);
    const { m, file, log } = await fetchFromMockGmail(original);
    expect(file.size).toBe(original.length);
    expect(log.at(-1)?.detail).toMatch(/size matches Gmail, PDF header OK/);
    const typed = ["wrong-one", F.PASSWORD];
    const asks: boolean[] = [];
    let saved: ParseResult | null = null;
    const sum = await runBulkImport<ParseResult>([m], {
      fetchFile: async () => file,
      parse: (f, pw) => parser(f)(pw),
      save: async (r) => { saved = r; return { added: r.transactions.length, duplicates: 0 }; },
      askPassword: async (_m, incorrect) => { asks.push(incorrect); return { password: typed.shift()!, remember: true }; },
      onStatus: () => {},
    });
    expect(asks).toEqual([false, true]); // needs password, then wrong, then the typed right one opens it
    expect(sum).toMatchObject({ imported: 1, failed: 0 });
    expect(saved!.adapter).toMatch(/cas/);
    expect(saved!.accounts).toHaveLength(3);
  });

  it("a trailing space from paste still opens it (exact attempt first)", async () => {
    const { file } = await fetchFromMockGmail(await F.casPdf(F.PASSWORD));
    const out = await parser(file)(`${F.PASSWORD} `);
    expect(out.kind).toBe("result");
  });

  it("a corrupted download is a clear error, not 'wrong password'", async () => {
    const original = await F.casPdf(F.PASSWORD);
    const broken = original.slice(0, Math.floor(original.length / 3));
    const file = new File([broken], "CAS_SYNTH_0000891.pdf", { type: "application/pdf" });
    const out = await parser(file)(F.PASSWORD);
    expect(out.kind).not.toBe("password");
  });
});
