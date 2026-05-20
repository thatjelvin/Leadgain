import pLimit from "p-limit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { compileLead } from "@/lib/pipeline/compile";
import { discoverBusinesses } from "@/lib/pipeline/discover";
import { findEmailCandidates } from "@/lib/pipeline/emailFind";
import { identifyOwners } from "@/lib/pipeline/identify";
import { verifyCandidates } from "@/lib/pipeline/emailVerify";
import type { PipelineStep, SearchRequest } from "@/lib/types";

interface RunLeadPipelineInput {
  searchId: string;
  userId: string;
  request: SearchRequest;
}

async function updateSearch(
  searchId: string,
  data: Partial<{ status: string; current_step: PipelineStep; status_message: string; completed_at: string; lead_count_found: number }>,
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("search_history").update(data).eq("id", searchId);
}

export async function runLeadPipeline({ searchId, request }: RunLeadPipelineInput) {
  const timeoutMs = 180_000;
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const supabase = createSupabaseAdminClient();

  const checkTimeout = () => Date.now() > deadline;

  try {
    await updateSearch(searchId, {
      status: "running",
      current_step: "discovery",
      status_message: "Discovering businesses...",
    });

    const businesses = await discoverBusinesses(request.niche, request.location, request.leadCount);

    if (businesses.length === 0) {
      await updateSearch(searchId, {
        status: "complete",
        current_step: "complete",
        status_message: "No businesses found for this search. Try broadening your niche or location.",
        completed_at: new Date().toISOString(),
        lead_count_found: 0,
      });
      return;
    }

    if (checkTimeout()) {
      await updateSearch(searchId, {
        status: "partial",
        current_step: "complete",
        status_message: "Search timed out — showing partial results",
        completed_at: new Date().toISOString(),
      });
      return;
    }

    await updateSearch(searchId, {
      current_step: "owner_identification",
      status_message: "Identifying business owners...",
    });

    const identified = await identifyOwners(businesses, request.location);

    if (checkTimeout()) {
      const { count } = await supabase
        .from("lead_results")
        .select("id", { count: "exact", head: true })
        .eq("search_id", searchId);

      await updateSearch(searchId, {
        status: "partial",
        current_step: "complete",
        status_message: "Search timed out — showing partial results",
        completed_at: new Date().toISOString(),
        lead_count_found: count ?? 0,
      });
      return;
    }

    await updateSearch(searchId, {
      current_step: "email_discovery",
      status_message: "Finding email addresses...",
    });

    const emailResults = await findEmailCandidates(identified);

    await updateSearch(searchId, {
      current_step: "verification",
      status_message: "Verifying email addresses...",
    });

    const limit = pLimit(5);
    let inserted = 0;

    for (const row of emailResults) {
      if (inserted >= request.leadCount) break;
      if (checkTimeout()) break;

      await limit(async () => {
        const verified = await verifyCandidates(row.candidates);
        const lead = compileLead(row.business, verified);

        const { error } = await supabase.from("lead_results").insert({
          search_id: searchId,
          ...lead,
        });

        if (!error) {
          inserted += 1;
          await updateSearch(searchId, {
            status: "running",
            current_step: "verification",
            status_message: `Processing ${row.business.businessName}...`,
            lead_count_found: inserted,
          });
        }
      });
    }

    const timedOut = checkTimeout();
    await updateSearch(searchId, {
      status: timedOut ? "partial" : "complete",
      current_step: "complete",
      status_message: timedOut
        ? "Search timed out — showing partial results"
        : "Search completed successfully.",
      completed_at: new Date().toISOString(),
      lead_count_found: inserted,
    });
  } catch (error) {
    console.error("Pipeline error", error);
    await updateSearch(searchId, {
      status: "failed",
      current_step: "complete",
      status_message: "Search failed. Please try again.",
      completed_at: new Date().toISOString(),
    });
  }
}
