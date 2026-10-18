import { describe, expect, it } from "vitest";
import { feeFormIssue, paiseFromRupees } from "../lib/wow/fee-runway";

describe("fee runway form", () => {
  it("parses a rupee field to paise", () => {
    expect(paiseFromRupees("1,500")).toBe(150_000);
    expect(paiseFromRupees("₹3.50")).toBe(350);
    expect(paiseFromRupees("3.5")).toBe(350);
    expect(paiseFromRupees("")).toBeNull();
    expect(paiseFromRupees("0")).toBeNull();
    expect(paiseFromRupees("12.345")).toBeNull();
  });

  it("says what the add form still needs", () => {
    expect(feeFormIssue("", "", "2027-02-01")).toBe("Add a name and an amount above ₹0.");
    expect(feeFormIssue("Demo Cover", "1,500", "2027-02-01")).toBe("");
    expect(feeFormIssue("Demo Cover", "₹3.50", "2027-02-01")).toBe("");
    expect(feeFormIssue("Demo Cover", "0", "2027-02-01")).toBe("Enter an amount above ₹0.");
    expect(feeFormIssue("  Demo  ", "12", "")).toBe("Pick a due date.");
    expect(feeFormIssue("Demo Cover", "12", "2027-02-31")).toBe("Pick a due date.");
    expect(feeFormIssue("  ", "nope", "2027-13-40")).toBe("Add a name, an amount above ₹0, and a due date.");
  });
});
