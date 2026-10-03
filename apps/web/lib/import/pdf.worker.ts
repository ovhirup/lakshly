/// <reference lib="webworker" />
// Parses statement PDFs entirely inside this Web Worker. No network: pdf.js runs in-thread here
// (its own worker handler is registered on globalThis), fonts/CMaps are never fetched.
import * as pdfjs from "pdfjs-dist";
import * as pdfWorker from "pdfjs-dist/build/pdf.worker.mjs";
import { extractPdfText, parseDocument, pdfErrorMessage, PasswordRequiredError, type PdfJsLike } from "@lakshly/parsers";

(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfWorker;

export type WorkerIn = { type: "lk-parse"; id: number; bytes: ArrayBuffer; password?: string; fileName: string; forceAdapter?: string };

self.addEventListener("message", async (e: MessageEvent) => {
  const msg = e.data as WorkerIn;
  if (!msg || msg.type !== "lk-parse") return; // ignore pdf.js internal messages
  const { id } = msg;
  try {
    if (!msg.bytes?.byteLength) { self.postMessage({ type: "lk-error", id, message: "The file arrived empty. Please try again." }); return; }
    const doc = await extractPdfText(pdfjs as unknown as PdfJsLike, new Uint8Array(msg.bytes.slice(0)), { password: msg.password, fileName: msg.fileName });
    const text = doc.lines.length;
    if (!text) {
      self.postMessage({ type: "lk-error", id, message: "No text found. This looks like a scanned/image PDF, which needs OCR (not supported yet)." });
      return;
    }
    self.postMessage({ type: "lk-result", id, result: parseDocument(doc, msg.forceAdapter) });
  } catch (err) {
    if (err instanceof PasswordRequiredError) self.postMessage({ type: "lk-password", id, incorrect: err.incorrect });
    else self.postMessage({ type: "lk-error", id, message: pdfErrorMessage(err) });
  }
});
