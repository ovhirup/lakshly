"use client";
import { DataGate } from "@/components/DataState";
import { BillRadar } from "@/components/bills/BillRadar";

export default function BillsPage() {
  return <DataGate title="Bill radar"><BillRadar /></DataGate>;
}
