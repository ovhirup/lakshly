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
  const bytes = await file.arrayBuffer();
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
