"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const COMPANY_SIZE_OPTIONS = ["Any", "1–10 employees", "11–50 employees", "51–200 employees", "200+"];

export function SearchForm() {
  const router = useRouter();
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [companySize, setCompanySize] = useState("Any");
  const [leadCount, setLeadCount] = useState(30);
  const [ownerFirst, setOwnerFirst] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/leads/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        niche,
        location,
        companySize,
        leadCount,
        emailPriority: ownerFirst ? "owner_first" : "business_only",
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to start search.");
      return;
    }

    const body = await res.json();
    router.push(`/search/${body.searchId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-[#2a2a2a] bg-[#111] p-5">
      <h2 className="text-xl font-semibold">New Lead Search</h2>

      <label className="block text-sm">
        Niche / Keyword
        <input
          type="text"
          required
          placeholder="e.g. HVAC businesses, plumbers, roofing contractors"
          className="mt-1 w-full rounded border border-[#363636] bg-[#0f0f0f] p-2"
          value={niche}
          onChange={(event) => setNiche(event.target.value)}
        />
      </label>

      <label className="block text-sm">
        Location
        <input
          type="text"
          required
          placeholder="e.g. Manchester UK, Texas USA"
          className="mt-1 w-full rounded border border-[#363636] bg-[#0f0f0f] p-2"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </label>

      <label className="block text-sm">
        Company Size
        <select
          value={companySize}
          onChange={(event) => setCompanySize(event.target.value)}
          className="mt-1 w-full rounded border border-[#363636] bg-[#0f0f0f] p-2"
        >
          {COMPANY_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Number of Leads: <span className="text-[#c8a97e]">{leadCount}</span>
        <input
          type="range"
          min={5}
          max={50}
          value={leadCount}
          onChange={(event) => setLeadCount(Number(event.target.value))}
          className="mt-2 w-full"
        />
      </label>

      <label className="flex items-center justify-between text-sm rounded border border-[#2d2d2d] p-3">
        <span>Email Priority</span>
        <button
          type="button"
          onClick={() => setOwnerFirst((current) => !current)}
          className={`rounded-full px-3 py-1 ${ownerFirst ? "bg-[#c8a97e] text-black" : "bg-[#2f2f2f]"}`}
        >
          {ownerFirst ? "Owner email first" : "Business email only"}
        </button>
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-[#c8a97e] text-black px-4 py-2 font-medium disabled:opacity-60"
      >
        {loading ? "Starting..." : "Start Search"}
      </button>
    </form>
  );
}
