import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runLeadPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";

const requestSchema = z.object({
  niche: z.string().min(1),
  location: z.string().min(1),
  companySize: z.string().optional(),
  leadCount: z.number().int().min(5).max(50),
  emailPriority: z.enum(["owner_first", "business_only"]),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { count: activeCount } = await supabase
    .from("search_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["pending", "running"]);

  if ((activeCount ?? 0) >= 3) {
    return NextResponse.json({ error: "Maximum 3 active searches allowed." }, { status: 429 });
  }

  const { data: inserted, error } = await supabase
    .from("search_history")
    .insert({
      user_id: user.id,
      niche: parsed.data.niche,
      location: parsed.data.location,
      company_size: parsed.data.companySize,
      lead_count_requested: parsed.data.leadCount,
      email_priority: parsed.data.emailPriority,
      status: "running",
      current_step: "discovery",
      status_message: "Starting lead search...",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Failed to create search" }, { status: 500 });
  }

  // Decouple the long-running pipeline from the request/response lifecycle as required.
  setTimeout(() => {
    void runLeadPipeline({
      searchId: inserted.id,
      request: {
        niche: parsed.data.niche,
        location: parsed.data.location,
        companySize: parsed.data.companySize,
        leadCount: parsed.data.leadCount,
        emailPriority: parsed.data.emailPriority,
      },
    }).catch((pipelineError) => {
      console.error("Pipeline background execution failed", pipelineError);
    });
  }, 0);

  return NextResponse.json({ searchId: inserted.id, status: "running" });
}
