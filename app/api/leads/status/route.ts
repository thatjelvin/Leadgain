import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { PipelineStep, SearchStatus } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchId = url.searchParams.get("searchId");

  if (!searchId) {
    return NextResponse.json({ error: "searchId is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: search } = await supabase
    .from("search_history")
    .select("id,status,current_step,status_message,lead_count_requested")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (!search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const { data: leads } = await supabase
    .from("lead_results")
    .select("business_name,owner_first_name,owner_last_name,email,email_type,email_verified,phone,website,location")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    status: (search.status as SearchStatus) ?? "pending",
    step: (search.current_step as PipelineStep) ?? "discovery",
    leadsFound: leads?.length ?? 0,
    leadsTarget: search.lead_count_requested ?? 0,
    latestMessage: search.status_message ?? "Working...",
    leads: leads ?? [],
  });
}
