import { notFound, redirect } from "next/navigation";
import { SearchRunClient } from "@/components/SearchRunClient";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { PipelineStep, SearchStatus } from "@/lib/types";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: search } = await supabase
    .from("search_history")
    .select("id,lead_count_requested,status,current_step,status_message")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!search) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Search Progress</h1>
      <SearchRunClient
        searchId={search.id}
        leadsTarget={search.lead_count_requested ?? 0}
        initialStatus={(search.status as SearchStatus) ?? "pending"}
        initialStep={(search.current_step as PipelineStep) ?? "discovery"}
        initialMessage={search.status_message ?? "Starting search..."}
      />
    </main>
  );
}
