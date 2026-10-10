"use client";
import { parseCsv, type ParseResult } from "@lakshly/parsers";

export type Outcome =
  | { kind: "result"; result: ParseResult }
  | { kind: "password"; incorrect: boolean }
  | { kind: "error"; message: string };

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module", name: "lakshly-parser" });
  return worker;
}

/** Parse a statement file on-device. The password (if any) is used for this call only and never stored. */
export async function parseFile(file: File, password?: string): Promise<Outcome> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || file.type === "text/csv") {
    const r = parseCsv(await file.text(), file.name);
    return r.transactions.length ? { kind: "result", result: r } : { kind: "error", message: "Couldn't find Date / Description / Amount columns in this CSV." };
  }
  if (!(name.endsWith(".pdf") || file.type === "application/pdf")) {
    return { kind: "error", message: "Please choose a PDF statement, a CAS PDF, or a CSV export. (XLS/XLSX: save as CSV first.)" };
  }
  // Exactly what was typed first. Only if that is reported incorrect, retry common invisible slips
  // (leading/trailing spaces from paste/autofill, Unicode compatibility forms). Never changes letter case.
  return withPasswordAttempts((pw) => parsePdfOnce(file, pw), password);
}

/** Runs one parse per password candidate (exact first) until one isn't "incorrect". */
export async function withPasswordAttempts<O extends { kind: string; incorrect?: boolean }>(once: (pw: string | undefined) => Promise<O>, password: string | undefined): Promise<O> {
  let out!: O;
  for (const pw of passwordAttempts(password)) {
    out = await once(pw);
    if (!(out.kind === "password" && out.incorrect)) return out;
  }
  return out;
}

/** Password candidates, exact first. Internal characters and case are never altered. */
export function passwordAttempts(password: string | undefined): (string | undefined)[] {
  if (password === undefined || password === "") return [password];
  const list = [password, password.trim(), password.normalize("NFKC"), password.normalize("NFKC").trim()];
  return list.filter((p, i) => p && list.indexOf(p) === i);
}

async function parsePdfOnce(file: File, password: string | undefined): Promise<Outcome> {
  // A fresh copy of the bytes for every attempt: the buffer is transferred to the worker and pdf.js
  // detaches it, so a retry must never reuse the bytes of a failed attempt.
  const bytes = (await file.arrayBuffer()).slice(0);
  const id = ++seq;
  const w = getWorker();
  return new Promise<Outcome>((resolve) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; id?: number; result?: ParseResult; incorrect?: boolean; message?: string };
      if (d?.id !== id || !d.type?.startsWith("lk-")) return;
      w.removeEventListener("message", onMsg);
      if (d.type === "lk-result") resolve({ kind: "result", result: d.result! });
      else if (d.type === "lk-password") resolve({ kind: "password", incorrect: !!d.incorrect });
      else resolve({ kind: "error", message: d.message ?? "Couldn't read this file." });
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "lk-parse", id, bytes, password, fileName: file.name }, [bytes]);
  });
}
