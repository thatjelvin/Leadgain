import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchForm } from "@/components/SearchForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: searches } = await supabase
    .from("search_history")
    .select("id,niche,location,status,lead_count_found,lead_count_requested,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">LeadForge Dashboard</h1>
          <p className="text-sm text-[#c7c2b9]">Discover, verify, and export B2B leads.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SearchForm />

        <aside className="rounded-lg border border-[#2a2a2a] bg-[#111] p-5">
          <h2 className="text-lg font-semibold">Past Searches</h2>
          <ul className="mt-4 space-y-3">
            {(searches ?? []).map((search) => (
              <li key={search.id} className="rounded border border-[#252525] p-3 text-sm">
                <p className="font-medium">{search.niche}</p>
                <p className="text-[#c7c2b9]">{search.location}</p>
                <p className="mt-1">
                  <span className="text-[#c8a97e]">{search.status}</span> · {search.lead_count_found}/{search.lead_count_requested}
                </p>
                <div className="mt-2 flex gap-3">
                  <Link href={`/search/${search.id}`}>View</Link>
                  {search.lead_count_found > 0 ? (
                    <>
                      <a href={`/api/leads/export?searchId=${search.id}&format=csv`}>CSV</a>
                      <a href={`/api/leads/export?searchId=${search.id}&format=xlsx`}>XLSX</a>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
            {(searches ?? []).length === 0 ? <li className="text-sm text-[#b1aba0]">No searches yet.</li> : null}
          </ul>
        </aside>
      </div>
    </main>
  );
}
