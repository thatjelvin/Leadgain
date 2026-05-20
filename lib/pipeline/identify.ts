import { load } from "cheerio";
import pLimit from "p-limit";
import { extractOwnerWithGroq } from "@/lib/utils/groq";
import { searchSerpApi } from "@/lib/utils/serpapi";
import { toAbsoluteUrl } from "@/lib/utils/url";
import type { BusinessDiscoveryItem, IdentifiedBusiness } from "@/lib/types";

async function fetchTextFromPage(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "LeadForgeBot/1.0" },
  });

  if (!res.ok) return "";
  const html = await res.text();
  const $ = load(html);
  return $("body").text().replace(/\s+/g, " ").trim();
}

async function companiesHouseOwner(businessName: string) {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return { firstName: null as string | null, lastName: null as string | null };

  const authHeader = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  const searchRes = await fetch(
    `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(businessName)}`,
    { headers: { Authorization: authHeader }, cache: "no-store" },
  );
  if (!searchRes.ok) return { firstName: null, lastName: null };

  const searchData = await searchRes.json();
  const item = searchData.items?.[0];
  if (!item?.links?.officers) return { firstName: null, lastName: null };

  const officersRes = await fetch(`https://api.company-information.service.gov.uk${item.links.officers}`, {
    headers: { Authorization: authHeader },
    cache: "no-store",
  });

  if (!officersRes.ok) return { firstName: null, lastName: null };

  const officersData = await officersRes.json();
  const officerName = officersData.items?.[0]?.name as string | undefined;
  if (!officerName) return { firstName: null, lastName: null };

  const [firstName, ...rest] = officerName.trim().split(/\s+/);
  return {
    firstName: firstName ?? null,
    lastName: rest.join(" ") || null,
  };
}

export async function identifyOwners(businesses: BusinessDiscoveryItem[], location: string) {
  const limit = pLimit(5);

  return Promise.all(
    businesses.map((business) =>
      limit(async () => {
        let combinedText = "";

        if (business.website) {
          const pages = ["/", "/about", "/about-us", "/team", "/contact"];
          for (const path of pages) {
            const target = toAbsoluteUrl(business.website, path);
            if (!target) continue;
            combinedText += ` ${await fetchTextFromPage(target)}`;
          }
        }

        let owner = await extractOwnerWithGroq(combinedText.slice(0, 16000));

        if (!owner.firstName && !owner.lastName) {
          const serp = await searchSerpApi(`"${business.businessName}" owner name`);
          const snippets = serp.slice(0, 3).map((item) => item.snippet ?? "").join("\n");
          owner = await extractOwnerWithGroq(snippets);
        }

        if ((!owner.firstName || !owner.lastName) && /(uk|united kingdom)/i.test(location)) {
          const companiesHouse = await companiesHouseOwner(business.businessName);
          owner = {
            firstName: owner.firstName ?? companiesHouse.firstName,
            lastName: owner.lastName ?? companiesHouse.lastName,
            title: owner.title,
          };
        }

        const identified: IdentifiedBusiness = {
          ...business,
          ownerFirstName: owner.firstName,
          ownerLastName: owner.lastName,
        };

        return identified;
      }),
    ),
  );
}
