// pdf.js ships no types for its worker entry; we only need it to register the in-thread handler.
declare module "pdfjs-dist/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
