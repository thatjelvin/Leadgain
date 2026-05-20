import { searchSerpApi } from "@/lib/utils/serpapi";
import { extractDomain } from "@/lib/utils/url";
import type { BusinessDiscoveryItem } from "@/lib/types";

export async function discoverBusinesses(niche: string, location: string, targetLeads: number) {
  const queries = [
    `"${niche}" in "${location}"`,
    `"${niche}" "${location}" contact`,
    `site:yelp.com OR site:yell.com "${niche}" "${location}"`,
  ];

  const deduped = new Map<string, BusinessDiscoveryItem>();

  for (const query of queries) {
    const results = await searchSerpApi(query);
    for (const result of results) {
      const website = result.link ?? null;
      const domain = extractDomain(website);
      if (!domain || deduped.has(domain)) continue;

      deduped.set(domain, {
        businessName: result.title?.split("|")[0]?.split("-")[0]?.trim() || domain,
        website,
        location: result.snippet ?? location,
        source: "serpapi",
      });
    }
  }

  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (mapsKey) {
    const mapsQuery = new URLSearchParams({
      query: `${niche} ${location}`,
      key: mapsKey,
    });

    const mapsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${mapsQuery.toString()}`,
      { cache: "no-store" },
    );

    if (mapsRes.ok) {
      const mapsData = await mapsRes.json();
      for (const result of mapsData.results ?? []) {
        const website = result.website ?? null;
        const domain = extractDomain(website);
        if (!domain || deduped.has(domain)) continue;

        deduped.set(domain, {
          businessName: result.name ?? domain,
          website,
          location: result.formatted_address ?? location,
          phone: result.formatted_phone_number ?? null,
          source: "google_maps",
        });
      }
    }
  }

  return Array.from(deduped.values()).slice(0, Math.max(targetLeads * 2, targetLeads));
}
