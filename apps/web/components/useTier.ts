"use client";
import { useMemo } from "react";
import { useAppState } from "./AppState";
import { can, limit, resolveTier, type FeatureId, type Plan } from "@/lib/entitlements";

/** The one API the UI uses for gating: tier, can(feature), limit(feature). */
export function useTier(): { tier: Plan; can: (f: FeatureId) => boolean; limit: (f: FeatureId) => number | null } {
  const { plan } = useAppState();
  const tier = resolveTier(plan);
  return useMemo(() => ({ tier, can: (f: FeatureId) => can(f, tier), limit: (f: FeatureId) => limit(f, tier) }), [tier]);
}
