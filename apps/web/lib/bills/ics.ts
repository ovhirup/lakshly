import { BILL_KINDS, type RadarBill } from "./radar";
import { formatINR } from "@/lib/format";

export interface CalendarOptions { leadDays: number; amountsInAlerts: boolean }
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

/** Fold at 75 UTF-8 octets, including the continuation space. */
function fold(text: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = "";
  let size = 0;
  for (const character of text) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) { lines.push(line); line = " "; size = 1; }
    line += character;
    size += bytes;
  }
  lines.push(line);
  return lines.join("\r\n");
}

export function billsToIcs(bills: readonly RadarBill[], allowed: ReadonlySet<string>, now: Date, options: CalendarOptions = { leadDays: 3, amountsInAlerts: false }): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lakshly//Bill radar//EN", "CALSCALE:GREGORIAN"];
  for (const bill of bills) {
    if (!allowed.has(bill.id) || bill.paid || bill.muted) continue;
    const due = new Date(bill.due + "T00:00:00Z");
    if (!Number.isFinite(due.getTime())) continue;
    const end = new Date(due.getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    const description = BILL_KINDS[bill.kind].title + (options.amountsInAlerts && bill.amount !== null ? " · " + formatINR(bill.amount) : "");
    lines.push("BEGIN:VEVENT", "UID:" + escapeText(bill.id + "@lakshly.local"), "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + bill.due.replace(/-/g, ""), "DTEND;VALUE=DATE:" + end,
      "SUMMARY:" + escapeText(bill.name), "DESCRIPTION:" + escapeText(description), "BEGIN:VALARM", "ACTION:DISPLAY",
      "TRIGGER:-P" + (options.leadDays === 1 || options.leadDays === 7 ? options.leadDays : 3) + "D",
      "DESCRIPTION:" + escapeText(bill.name + " · " + description), "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
