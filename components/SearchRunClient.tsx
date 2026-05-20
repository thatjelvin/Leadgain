"use client";

import { useEffect, useMemo, useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ResultsTable } from "@/components/ResultsTable";
import type { PipelineStep, SearchStatus } from "@/lib/types";

interface LeadView {
  business_name: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  email: string | null;
  email_type: "personal" | "direct-business" | "generic" | "not_found";
  email_verified: boolean;
  phone: string | null;
  website: string | null;
  location: string | null;
}

export function SearchRunClient({
  searchId,
  leadsTarget,
  initialStatus,
  initialStep,
  initialMessage,
}: {
  searchId: string;
  leadsTarget: number;
  initialStatus: SearchStatus;
  initialStep: PipelineStep;
  initialMessage: string;
}) {
  const [status, setStatus] = useState<SearchStatus>(initialStatus);
  const [step, setStep] = useState<PipelineStep>(initialStep);
  const [message, setMessage] = useState(initialMessage);
  const [leadsFound, setLeadsFound] = useState(0);
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    async function poll() {
      const res = await fetch(`/api/leads/status?searchId=${searchId}`, { cache: "no-store" });
      if (!res.ok) return;

      const body = await res.json();
      setStatus(body.status);
      setStep(body.step);
      setMessage(body.latestMessage);
      setLeadsFound(body.leadsFound);
      setLeads(body.leads ?? []);

      if (body.status === "complete") {
        setToast("Search complete.");
      }
      if (body.status === "partial") {
        setToast("Search timed out — showing partial results");
      }
    }

    poll();

    if (status === "running" || status === "pending") {
      timer = setInterval(poll, 3000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [searchId, status]);

  const done = useMemo(() => leadsFound > 0, [leadsFound]);

  return (
    <section className="space-y-4">
      {toast ? <div className="rounded bg-[#1f2d1d] border border-[#38543c] px-3 py-2 text-sm">{toast}</div> : null}

      {status === "partial" ? (
        <div className="rounded bg-[#3b2b14] border border-[#7c5b2e] px-3 py-2 text-sm">
          Search timed out — showing partial results
        </div>
      ) : null}

      <ProgressIndicator currentStep={step} />

      <div className="rounded border border-[#2a2a2a] bg-[#111] p-4 text-sm">
        <p className="font-medium">{message}</p>
        <p className="text-[#c7c2b9] mt-1">
          Leads found: {leadsFound} / {leadsTarget}
        </p>
      </div>

      <ExportButtons searchId={searchId} disabled={!done} />
      <ResultsTable leads={leads} />
    </section>
  );
}
