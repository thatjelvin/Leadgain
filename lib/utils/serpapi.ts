export interface SerpResult {
  title?: string;
  link?: string;
  snippet?: string;
}

export async function searchSerpApi(query: string) {
  const key = process.env.SERP_API_KEY;
  if (!key) return [] as SerpResult[];

  const params = new URLSearchParams({
    api_key: key,
    engine: "google",
    q: query,
    num: "10",
  });

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`SerpAPI error ${res.status}`);
  }

  const data = await res.json();
  return (data.organic_results ?? []) as SerpResult[];
}
