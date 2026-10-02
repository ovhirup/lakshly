import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfText, type PdfJsLike } from "../src/index.ts";

export const pdf = pdfjs as unknown as PdfJsLike;
export const extract = (bytes: Uint8Array, password?: string) => extractPdfText(pdf, bytes, { password });
