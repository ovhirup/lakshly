// Gmail results: tight statement query, client-side statement filter, dedupe and sequential bulk import.
// Synthetic data only.
import { describe, expect, it } from "vitest";
import {
  classifyStatement, dedupeStatements, GmailClient, gmailStatementQuery, pickSource, statementQueries, assertAllowedGmailUrl,
  type FetchLike, type FoundMessage,
} from "../lib/gmail";
import { runBulkImport, summaryText, type ParseOutcome, type RowStatus } from "../lib/gmail-bulk";
import { importedGmailIds } from "../components/GmailResults";
import { findSource } from "../lib/setup";

const hdfcBank = findSource("hdfc-bank")!;
const hdfcCard = findSource("hdfc-card")!;
const cams = findSource("cams-cas")!;

describe("statement query", () => {
  it("requires a statement subject and a statement file, and excludes promo/EMI/OTP subjects", () => {
    const q = gmailStatementQuery(hdfcCard);
    expect(q).toContain("from:(hdfcbank.net OR hdfcbank.com)");
    expect(q).toMatch(/subject:\(statement OR "e-statement" OR estatement OR CAS OR "consolidated account statement" OR mailback\)/);
    expect(q).toContain("has:attachment");
    expect(q).toContain("{filename:pdf filename:csv filename:xls filename:xlsx}");
    expect(q).toMatch(/-subject:\(EMI OR offer OR offers OR "thank you" OR OTP OR alert/);
    expect(q).toContain("newer_than:2y");
  });
  it("sources sharing senders share one search (HDFC Bank + HDFC Card)", () => {
    const qs = statementQueries([hdfcBank, hdfcCard, cams]);
    expect(qs).toHaveLength(2);
    expect(qs[0].sourceIds).toEqual(["hdfc-bank", "hdfc-card"]);
    // The allow-list accepts exactly these queries.
    expect(() => assertAllowedGmailUrl(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(qs[0].q)}`, qs.map((x) => x.q))).not.toThrow();
  });
});

describe("client-side statement filter", () => {
  const pdf = ["Statement_AUG2026.pdf"];
  it.each([
    ["Your HDFC Bank Pixel Play Credit Card Statement for Aug 2026", pdf],
    ["E-Statement for your savings account (synthetic)", ["estmt.pdf"]],
    ["Consolidated Account Statement - CAS for Sep 2026", ["CAS_SEP2026.PDF"]],
    ["CAMS Mailback: your CAS", ["cas.pdf"]],
    ["Account statement export", ["txns.csv"]],
    ["Your monthly statement", ["stmt.xlsx"]],
  ])("keeps %s", (subject, files) => { expect(classifyStatement(subject, files).ok).toBe(true); });
  it.each([
    ["Merchant EMI on your Pixel Credit Card", pdf, "non-statement-subject"],
    ["Thank you for choosing HDFC Bank", pdf, "non-statement-subject"],
    ["Exclusive offers on your credit card statement", pdf, "non-statement-subject"],
    ["Your OTP for statement download is 123456", [], "non-statement-subject"],
    ["Transaction alert: Rs 499 debited", [], "non-statement-subject"],
    ["Payment reminder for your card statement", pdf, "non-statement-subject"],
    ["Your credit card is on its way", pdf, "not-statement-subject"],
    ["Your statement is ready", ["logo.png", "banner.gif"], "no-statement-file"],
    ["Your statement is ready", [], "no-statement-file"],
  ])("drops %s", (subject, files, reason) => { expect(classifyStatement(subject, files)).toEqual({ ok: false, reason }); });

  it("card statements go to the card source when senders are shared", () => {
    expect(pickSource([hdfcBank, hdfcCard], "Your HDFC Bank Pixel Play Credit Card Statement for Aug 2026").id).toBe("hdfc-card");
    expect(pickSource([hdfcBank, hdfcCard], "Your account statement for Sep 2026").id).toBe("hdfc-bank");
  });
});

const row = (p: Partial<FoundMessage> & { id: string }): FoundMessage => ({ sourceId: "hdfc-card", searchId: "statements", from: "emailstatements.cards@hdfcbank.net", subject: "Your HDFC Bank Pixel Play Credit Card Statement for Aug 2026", date: "2026-09-22", ...p });

describe("dedupe", () => {
  it("folds the same statement sent twice, keeps the newest and counts copies", () => {
    const out = dedupeStatements([
      row({ id: "a", date: "2026-09-22", attachments: [{ name: "Pixel_AUG26.pdf", size: 81234 }] }),
      row({ id: "b", date: "2026-09-23", subject: "Fwd: Your HDFC Bank Pixel Play Credit Card Statement for Aug 2026 ", attachments: [{ name: "Pixel_AUG26.pdf", size: 81234 }] }),
      row({ id: "c", date: "2026-08-22", subject: "Your HDFC Bank Pixel Play Credit Card Statement for Jul 2026" }),
    ]);
    expect(out.map((m) => m.id)).toEqual(["b", "c"]);
    expect(out[0]).toMatchObject({ copies: 2, dupIds: ["a"], date: "2026-09-23" });
    expect(out[1].copies).toBe(1);
  });
  it("dedupes by message id and by thread id", () => {
    const out = dedupeStatements([row({ id: "a" }), row({ id: "a" }), row({ id: "t1", threadId: "T", subject: "Statement for Sep", date: "2026-10-01" }), row({ id: "t2", threadId: "T", subject: "Re: statement for Sep (resent)", date: "2026-09-30" })]);
    expect(out.map((m) => m.id)).toEqual(["t1", "a"]);
    expect(out[0].copies).toBe(2);
  });
  it("different senders or months are not duplicates", () => {
    expect(dedupeStatements([row({ id: "a" }), row({ id: "b", from: "statements@sbicard.com" }), row({ id: "c", subject: "Your HDFC Bank Pixel Play Credit Card Statement for Sep 2026" })])).toHaveLength(3);
  });
});

describe("findStatements against a mocked Gmail (synthetic mail)", () => {
  const mail: Record<string, { from: string; subject: string; date: number; thread: string; files: string[] }> = {
    s1: { from: "HDFC Bank <emailstatements.cards@hdfcbank.net>", subject: "Your HDFC Bank Pixel Play Credit Card Statement for Aug 2026", date: Date.UTC(2026, 8, 22), thread: "t1", files: ["Pixel_AUG26.pdf"] },
    s2: { from: "HDFC Bank <emailstatements.cards@hdfcbank.net>", subject: "Your HDFC Bank Pixel Play Credit Card Statement for Aug 2026", date: Date.UTC(2026, 8, 23), thread: "t2", files: ["Pixel_AUG26.pdf"] },
    emi: { from: "HDFC Bank <alerts@hdfcbank.net>", subject: "Merchant EMI on your Pixel Credit Card", date: Date.UTC(2026, 8, 20), thread: "t3", files: ["EMI_schedule.pdf"] },
    ty: { from: "HDFC Bank <welcome@hdfcbank.com>", subject: "Thank you for choosing HDFC Bank", date: Date.UTC(2026, 8, 19), thread: "t4", files: ["brochure.pdf"] },
    acct: { from: "HDFC Bank <estatement@hdfcbank.net>", subject: "Your account statement for Sep 2026", date: Date.UTC(2026, 9, 2), thread: "t5", files: ["Acct_SEP26.pdf"] },
    img: { from: "HDFC Bank <estatement@hdfcbank.net>", subject: "Your statement is ready", date: Date.UTC(2026, 9, 1), thread: "t6", files: ["banner.png"] },
  };
  const fetch: FetchLike = async (url) => {
    const u = new URL(url);
    const path = u.pathname.replace("/gmail/v1/users/me", "");
    const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
    if (path === "/messages") return json({ messages: Object.keys(mail).map((id) => ({ id })) });
    const id = path.split("/")[2];
    const m = mail[id];
    expect(u.searchParams.get("fields")).not.toMatch(/body\(data|body,|\bdata\b/);
    return json({ id, threadId: m.thread, internalDate: String(m.date), payload: { headers: [{ name: "From", value: m.from }, { name: "Subject", value: m.subject }], parts: m.files.map((f, i) => ({ filename: f, mimeType: "application/pdf", body: { attachmentId: `att${i}`, size: 81234 } })) } });
  };
  it("lists only real statements, one row per statement, attributed to the right source", async () => {
    const c = new GmailClient("ya29.synthetic", [hdfcBank, hdfcCard], fetch);
    const found = await c.findStatements();
    expect(found.map((f) => f.id)).toEqual(["acct", "s2"]);
    expect(found.find((f) => f.id === "s2")).toMatchObject({ sourceId: "hdfc-card", copies: 2, dupIds: ["s1"], attachments: [{ name: "Pixel_AUG26.pdf", size: 81234 }] });
    expect(found.find((f) => f.id === "acct")?.sourceId).toBe("hdfc-bank");
    const skipped = c.log.filter((e) => e.action === "skipped").map((e) => e.detail);
    expect(skipped).toHaveLength(3);
    expect(skipped.join("\n")).toMatch(/Merchant EMI.*promo, EMI, OTP or alert/);
    expect(skipped.join("\n")).toMatch(/Thank you for choosing.*promo/);
    expect(skipped.join("\n")).toMatch(/statement is ready.*no PDF\/CSV\/XLS/);
    // One search for the shared HDFC senders.
    expect(c.log.filter((e) => e.action === "search")).toHaveLength(1);
  });
});

describe("bulk import (sequential, passwords in memory for one run)", () => {
  const file = (name: string) => new File(["%PDF synthetic"], name, { type: "application/pdf" });
  const rows = [
    row({ id: "r1", from: "a@hdfcbank.net" }), row({ id: "r2", from: "a@hdfcbank.net" }), row({ id: "r3", from: "a@hdfcbank.net" }),
    row({ id: "r4", from: "b@sbicard.com" }), row({ id: "r5", from: "c@kotak.com" }), row({ id: "r6", from: "d@icicibank.com" }),
  ];
  it("runs in order, reuses a remembered sender password, prompts again for others, and summarises", async () => {
    const order: string[] = [];
    const statuses: Record<string, RowStatus[]> = {};
    const asks: string[] = [];
    let active = 0;
    const sum = await runBulkImport<{ n: number }>(rows, {
      fetchFile: async (m) => (m.id === "r5" ? null : file(`${m.id}.pdf`)),
      parse: async (f, pw): Promise<ParseOutcome<{ n: number }>> => {
        active++; expect(active).toBe(1); await Promise.resolve(); active--;
        const id = f.name.replace(".pdf", "");
        if (id === "r6") return { kind: "error", message: "Unrecognised layout" };
        if (id.startsWith("r") && ["r1", "r2", "r3"].includes(id)) return pw === "SYNTH1" ? { kind: "result", result: { n: 3 } } : { kind: "password", incorrect: !!pw };
        if (id === "r4") return pw ? { kind: "password", incorrect: true } : { kind: "password", incorrect: false };
        return { kind: "result", result: { n: 1 } };
      },
      save: async (r, f) => { order.push(f.name); return { added: r.n, duplicates: 1 }; },
      askPassword: async (m, incorrect) => {
        asks.push(`${m.id}:${incorrect}`);
        if (m.id === "r1") return incorrect ? { password: "SYNTH1", remember: true } : { password: "wrong", remember: true };
        return null; // r4: skip
      },
      onStatus: (id, st) => { (statuses[id] ??= []).push(st); },
    });
    expect(asks).toEqual(["r1:false", "r1:true", "r4:false"]); // r2/r3 reuse the remembered password, no prompt
    expect(order).toEqual(["r1.pdf", "r2.pdf", "r3.pdf"]);
    expect(statuses.r1.map((s) => s.s)).toEqual(["queued", "importing", "needs-password", "importing", "needs-password", "importing", "imported"]);
    expect(statuses.r2.at(-1)).toEqual({ s: "imported", added: 3, duplicates: 1 });
    expect(statuses.r4.at(-1)).toEqual({ s: "skipped", reason: "No password entered" });
    expect(statuses.r5.at(-1)).toMatchObject({ s: "failed", reason: expect.stringMatching(/No PDF/) });
    expect(statuses.r6.at(-1)).toEqual({ s: "failed", reason: "Unrecognised layout" });
    expect(sum).toEqual({ imported: 3, failed: 2, skipped: 1, added: 9, duplicates: 3 });
    expect(summaryText(sum)).toBe("Imported 3 statements (9 new transactions, 3 already there) · 1 skipped · 2 failed");
  });
  it("a remembered password is not reused across runs", async () => {
    const asks: string[] = [];
    const deps = {
      fetchFile: async (m: FoundMessage) => file(`${m.id}.pdf`),
      parse: async (_f: File, pw?: string): Promise<ParseOutcome<number>> => (pw === "SYNTH1" ? { kind: "result", result: 1 } : { kind: "password", incorrect: !!pw }),
      save: async () => ({ added: 1, duplicates: 0 }),
      askPassword: async (m: FoundMessage) => { asks.push(m.id); return { password: "SYNTH1", remember: true }; },
      onStatus: () => {},
    };
    await runBulkImport([rows[0], rows[1]], deps);
    await runBulkImport([rows[2]], deps);
    expect(asks).toEqual(["r1", "r3"]);
  });
  it("a thrown error fails only that row; stop skips the rest", async () => {
    let n = 0;
    const st: Record<string, RowStatus> = {};
    const sum = await runBulkImport([rows[0], rows[1], rows[2]], {
      fetchFile: async (m) => { if (m.id === "r1") throw new Error("Gmail session expired. Connect again."); return file(`${m.id}.pdf`); },
      parse: async () => ({ kind: "result", result: 1 }),
      save: async () => { n++; return { added: 1, duplicates: 0 }; },
      askPassword: async () => null,
      onStatus: (id, s) => { st[id] = s; },
      cancelled: () => n >= 1,
    });
    expect(st.r1).toEqual({ s: "failed", reason: "Gmail session expired. Connect again." });
    expect(st.r2.s).toBe("imported");
    expect(st.r3).toEqual({ s: "skipped", reason: "Stopped" });
    expect(sum).toMatchObject({ imported: 1, failed: 1, skipped: 1 });
  });
  it("already-imported Gmail rows are recognised from the import log", () => {
    expect([...importedGmailIds([{ ref: "gmail:abc" }, { ref: "manual" }, {}])]).toEqual(["abc"]);
  });
});

describe("bulk: remembered sender password vs a newly typed one", () => {
  it("a remembered password that fails isn't shown as 'wrong'; the typed one is used and replaces it", async () => {
    const mk = (id: string) => ({ id, sourceId: "cams-cas", searchId: "cas", from: "donotreply@camsonline.com", subject: "CAS (synthetic)", date: "2026-10-02" });
    const need: Record<string, string> = { a: "PASS-A", b: "PASS-B", c: "PASS-B" };
    const tried: string[] = [];
    const asks: string[] = [];
    const answers: Record<string, string> = { a: "PASS-A", b: "PASS-B" };
    const sum = await runBulkImport<number>([mk("a"), mk("b"), mk("c")], {
      fetchFile: async (m) => new File(["%PDF"], `${m.id}.pdf`),
      parse: async (f, pw) => { const id = f.name[0]; tried.push(`${id}:${pw ?? ""}`); return pw === need[id] ? { kind: "result", result: 1 } : { kind: "password", incorrect: !!pw }; },
      save: async () => ({ added: 1, duplicates: 0 }),
      askPassword: async (m, incorrect) => { asks.push(`${m.id}:${incorrect}`); return { password: answers[m.id], remember: true }; },
      onStatus: () => {},
    });
    expect(asks).toEqual(["a:false", "b:false"]); // b: remembered PASS-A failed, but that's not reported as the person's wrong password
    expect(tried).toEqual(["a:", "a:PASS-A", "b:PASS-A", "b:PASS-B", "c:PASS-B"]); // typed value used, then remembered for c
    expect(sum.imported).toBe(3);
  });
});
