/** Fake bank rows a tester can review before using a real statement. */
export const SAMPLE_BANK_NAME = "bank.synthetic.csv";

export const SAMPLE_BANK_CSV = [
  "Date,Description,Debit,Credit,Balance",
  '01/09/2026,"NEFT CR-DEMO EMPLOYER, SALARY",,"1,25,000.00","1,85,000.00"',
  '03/09/2026,UPI-SWIGGY-swiggy@demo-123456789012-Food,450.00,,"1,84,550.00"',
  '05/09/2026,POS DEMO BIGBASKET,"2,345.50",,"1,82,204.50"',
  "",
].join("\n");

export function sampleBankFile(): File {
  return new File([SAMPLE_BANK_CSV], SAMPLE_BANK_NAME, { type: "text/csv" });
}
