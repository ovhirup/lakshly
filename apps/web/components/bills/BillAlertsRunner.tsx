"use client";
import { useEffect, useRef } from "react";
import { useBills } from "@/components/useBills";
import { useData } from "@/components/DataState";
import { useTier } from "@/components/useTier";
import { billAlerts, type BillAlert } from "@/lib/bills/radar";
import { deliverAlert, dueAlerts, FIRED_STORAGE, rememberFired, reconcileAlertPlan } from "@/lib/bills/notify";

export function BillAlertsRunner() {
  const { bills, state } = useBills();
  const { source, review } = useData();
  const { limit } = useTier();
  const planned = useRef<{ source: string; signature: string; leadDays: number; alerts: BillAlert[] } | null>(null);
  const maximum = limit("bills.alerts");
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const eligible = bills.filter((bill) => !bill.paid && !bill.muted).slice(0, maximum ?? undefined);
    const signature = JSON.stringify([eligible.map((bill) => [bill.id, bill.name, bill.due, bill.amount, bill.kind]), state, maximum]);
    if (!planned.current || planned.current.source !== source || planned.current.signature !== signature) {
      const next = billAlerts(bills, state, maximum, true, review.now).alerts;
      const previous = planned.current;
      const keep = state.alertsOn && previous?.source === source && previous.leadDays === state.leadDays;
      const alerts = keep ? reconcileAlertPlan(previous.alerts, next, new Set(eligible.map((bill) => bill.id))) : next;
      planned.current = { source, signature, leadDays: state.leadDays, alerts };
    }
    async function check() {
      if (busy || document.visibilityState === "hidden" || !state.alertsOn || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      busy = true;
      try {
        let fired: string[] = [];
        try {
          const stored: unknown = JSON.parse(localStorage.getItem(FIRED_STORAGE) ?? "[]");
          if (Array.isArray(stored)) fired = stored.filter((item): item is string => typeof item === "string" && item.startsWith("lakshly.bill."));
        } catch { /* A blocked store must not stop the radar. */ }
        for (const alert of dueAlerts(planned.current?.alerts ?? [], fired, new Date())) {
          if (cancelled) break;
          if (await deliverAlert(alert, () => !cancelled)) {
            fired = rememberFired(fired, [alert.id]);
            try { localStorage.setItem(FIRED_STORAGE, JSON.stringify(fired)); } catch { /* Keep the in-memory plan deduplicated too. */ }
            if (planned.current?.source === source) planned.current.alerts = planned.current.alerts.filter((item) => item.id !== alert.id);
          }
        }
      } finally { busy = false; }
    }
    void check();
    const interval = window.setInterval(() => { void check(); }, 30 * 60 * 1000);
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [bills, state, maximum, source, review.now]);
  return null;
}
