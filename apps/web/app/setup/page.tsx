"use client";
import { useEffect, useRef } from "react";
import { useData } from "@/components/DataState";
import { SetupWizard } from "@/components/SetupWizard";
import { PageHeader } from "@/components/ui";
export default function SetupPage() {
  const { ready, setup, storageError, dispatchSetup } = useData();
  const started = useRef(false);
  useEffect(() => {
    if (!ready || setup || storageError || started.current) return;
    started.current = true;
    void dispatchSetup({ type: "start" }).catch(() => { started.current = false; });
  }, [ready, setup, storageError, dispatchSetup]);
  if (storageError && !setup) return <PageHeader title="Your vault needs a look" subtitle={storageError} />;
  if (!ready || !setup) return <PageHeader title="Get Lakshly up and running" subtitle="Opening your on-device setup…" />;
  return <SetupWizard state={setup} />;
}
