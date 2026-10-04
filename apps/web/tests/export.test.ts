import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { datasetJson, exportFilename, transactionsCsv } from "@/lib/export";

describe("export your own data", () => {
  it("writes the dataset as JSON and keeps the synthetic flag", () => {
    const text = datasetJson(dataset);
    const parsed = JSON.parse(text) as { synthetic: boolean; accounts: unknown[] };
    expect(parsed.synthetic).toBe(true);
    expect(parsed.accounts.length).toBe(dataset.accounts.length);
    expect(text).not.toMatch(/https?:/i);
  });

  it("writes a CSV with paise and escapes commas", () => {
    const csv = transactionsCsv([
      { id: "t", accountId: "a", date: "2026-09-01", amount: -29900, description: "Sample, Store", merchant: "Demo \"Shop\"", category: "shopping" },
    ]);
    expect(csv.split("\n")[0]).toBe("date,description,merchant,category,amount_paise,account_id");
    expect(csv).toContain("\"Sample, Store\"");
    expect(csv).toContain("\"Demo \"\"Shop\"\"\"");
    expect(csv).toContain("-29900");
    expect(exportFilename("csv", "2026-10-04")).toBe("lakshly-2026-10-04.csv");
    expect(exportFilename("json", "2026-10-04")).toBe("lakshly-2026-10-04.json");
  });

  it("does not call the network", () => {
    const src = readFileSync(new URL("../lib/export.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bfetch\b/);
    expect(src).not.toMatch(/XMLHttpRequest/);
  });
});
