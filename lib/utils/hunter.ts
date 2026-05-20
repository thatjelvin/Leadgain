export async function hunterDomainSearch(domain: string) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return [] as string[];

  const res = await fetch(
    `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(key)}`,
    { cache: "no-store" },
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.emails ?? []).map((item: { value?: string }) => item.value).filter(Boolean);
}

export async function hunterEmailFinder(domain: string, firstName: string, lastName: string) {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !firstName || !lastName) return null;

  const query = new URLSearchParams({
    domain,
    first_name: firstName,
    last_name: lastName,
    api_key: key,
  });

  const res = await fetch(`https://api.hunter.io/v2/email-finder?${query.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.email ?? null;
}
