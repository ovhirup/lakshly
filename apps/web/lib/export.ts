// A copy of the books already on this device. Nothing is uploaded.
import type { LakshlyDataset, Transaction } from "./schema.gen";

export function datasetJson(dataset: LakshlyDataset): string {
  return JSON.stringify(dataset);
}

function cell(value: string | number | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Transactions only. Amounts stay in paise. */
export function transactionsCsv(transactions: Transaction[]): string {
  const header = "date,description,merchant,category,amount_paise,account_id";
  const rows = transactions.map((t) =>
    [t.date, t.description, t.merchant ?? "", t.category, t.amount, t.accountId].map(cell).join(","),
  );
  return [header, ...rows].join("\n");
}

export function exportFilename(kind: "json" | "csv", today: string): string {
  return `lakshly-${today}.${kind === "json" ? "json" : "csv"}`;
}
