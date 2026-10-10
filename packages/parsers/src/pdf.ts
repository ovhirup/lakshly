import type { Line, TextDoc, TextItem } from "./types.ts";

/**
 * Minimal structural type for the parts of pdf.js we use. The caller injects the pdf.js module
 * (browser worker or Node legacy build), so this package has no runtime dependency on it.
 */
export interface PdfJsLike {
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDocLike>; destroy?: () => Promise<void> };
}
interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
  destroy?: () => Promise<void>;
}

export class PasswordRequiredError extends Error {
  readonly incorrect: boolean;
  constructor(incorrect: boolean) {
    super(incorrect ? "Incorrect password" : "This PDF is password-protected");
    this.incorrect = incorrect;
    this.name = "PasswordRequiredError";
  }
}

/** pdf.js PasswordException codes: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD. Anything else keeps its real reason. */
export function mapPdfOpenError(e: unknown): Error {
  const err = e as { name?: string; code?: number; message?: string };
  if (err?.name === "PasswordException" && err.code === 2) return new PasswordRequiredError(true);
  if (err?.name === "PasswordException" && err.code === 1) return new PasswordRequiredError(false);
  return e instanceof Error ? e : new Error(String(err?.message ?? e));
}

/** Human reason for a non-password PDF failure (never reported as "wrong password"). */
export function pdfErrorMessage(e: unknown): string {
  const err = e as { name?: string; message?: string };
  if (err?.name === "InvalidPDFException") return "This file isn't a valid PDF (it may be damaged or only partly downloaded).";
  if (err?.name === "MissingPDFException") return "The PDF file is missing or empty.";
  if (err?.name === "PasswordException") return `This PDF couldn't be unlocked (${err.message ?? "unsupported protection"}).`;
  return err?.message ? `Couldn't read this PDF: ${err.message}` : "Couldn't read this PDF.";
}

/** Group positioned text runs into visual lines (same baseline within a tolerance), left → right. */
export function itemsToLines(page: number, raw: { str: string; x: number; y: number; w: number }[], tol = 2.5): Line[] {
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const it of raw) {
    if (!it.str.trim()) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= tol);
    if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
    row.items.push({ str: it.str.trim(), x: it.x, w: it.w });
  }
  rows.sort((a, b) => b.y - a.y); // PDF y grows upwards: top of page first
  return rows.map((r) => {
    const items = r.items.sort((a, b) => a.x - b.x);
    let text = "";
    let lastEnd = -Infinity;
    for (const it of items) {
      const gap = it.x - lastEnd;
      text += text ? (gap > 12 ? "   " : " ") : "";
      text += it.str;
      lastEnd = it.x + it.w;
    }
    return { page, y: r.y, items, text };
  });
}

/**
 * Extract text from PDF bytes, fully on-device. Never sends anything over the network:
 * fonts/CMaps are not fetched, eval is disabled. The password is used only for this call.
 */
export async function extractPdfText(pdfjs: PdfJsLike, data: Uint8Array, opts: { password?: string; fileName?: string } = {}): Promise<TextDoc> {
  const task = pdfjs.getDocument({
    data,
    password: opts.password,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
    verbosity: 0,
  });
  let doc: PdfDocLike;
  try {
    doc = await task.promise;
  } catch (e) {
    throw mapPdfOpenError(e);
  }
  const lines: Line[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const raw = (tc.items as { str?: string; transform?: number[]; width?: number }[])
        .filter((i) => typeof i.str === "string" && i.transform)
        .map((i) => ({ str: i.str as string, x: i.transform![4], y: i.transform![5], w: i.width ?? 0 }));
      lines.push(...itemsToLines(p, raw));
    }
    return { pages: doc.numPages, lines, fileName: opts.fileName };
  } finally {
    await (doc.destroy?.() ?? task.destroy?.());
  }
}

/** Build a TextDoc from plain lines (used by CSV import and tests). */
export function textDocFromLines(texts: string[], fileName?: string): TextDoc {
  return {
    pages: 1,
    fileName,
    lines: texts.map((t, i) => ({ page: 1, y: -i, text: t, items: t.split(/\s{3,}/).map((s, j) => ({ str: s, x: j * 100, w: 90 })) })),
  };
}
