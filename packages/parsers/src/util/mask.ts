/** Keep only the last 4 digits of an account/card/folio number. Returns undefined if < 4 digits. */
export function last4(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

/** Remove long digit runs (account/card numbers, phone numbers) from free text. */
export function redactNumbers(text: string): string {
  return text.replace(/\d[\d\s-]{8,}\d/g, (m) => {
    const d = m.replace(/[^0-9]/g, "");
    return d.length >= 9 ? `XXXX${d.slice(-4)}` : m;
  });
}
