"use client";
import { Chips } from "./ui";
import { formatMonth } from "@/lib/format";

export function MonthPicker({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
  return <Chips label="Month" value={value} onChange={onChange} options={months.map((m) => ({ value: m, label: formatMonth(m, true) }))} />;
}
