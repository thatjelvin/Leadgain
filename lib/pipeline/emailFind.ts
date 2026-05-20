import { load } from "cheerio";
import pLimit from "p-limit";
import { hunterDomainSearch, hunterEmailFinder } from "@/lib/utils/hunter";
import { searchSerpApi } from "@/lib/utils/serpapi";
import { extractDomain, toAbsoluteUrl } from "@/lib/utils/url";
import type { EmailCandidate, IdentifiedBusiness } from "@/lib/types";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function classifyEmail(email: string, firstName: string | null, lastName: string | null): EmailCandidate["emailType"] {
  const lower = email.toLowerCase();
  if (firstName && lower.includes(firstName.toLowerCase())) return "direct-business";
  if (lastName && lower.includes(lastName.toLowerCase())) return "direct-business";
  if (/^(info|contact|hello|admin|support)@/.test(lower)) return "generic";
  return "direct-business";
}

async function crawlEmails(website: string, firstName: string | null, lastName: string | null) {
  const candidates: EmailCandidate[] = [];
  const pages = ["/", "/contact"];

  for (const path of pages) {
    const target = toAbsoluteUrl(website, path);
    if (!target) continue;

    const res = await fetch(target, {
      cache: "no-store",
      headers: { "User-Agent": "LeadForgeBot/1.0" },
    });

    if (!res.ok) continue;
    const html = await res.text();
    const $ = load(html);
    const bodyText = $("body").text();
    const linksText =
      $("a[href^='mailto:']")
        .map((_, el) => $(el).attr("href"))
        .get()
        .join(" ") || "";

    const emails = new Set([...(bodyText.match(EMAIL_REGEX) ?? []), ...(linksText.match(EMAIL_REGEX) ?? [])]);

    for (const email of Array.from(emails)) {
      candidates.push({
        email,
        emailType: classifyEmail(email, firstName, lastName),
        source: "website",
        verified: false,
      });
    }
  }

  return candidates;
}

function patternCandidates(firstName: string, lastName: string, domain: string) {
  const f = firstName.toLowerCase();
  const l = lastName.toLowerCase();
  return [
    `${f}@${domain}`,
    `${f[0]}.${l}@${domain}`,
    `${f}.${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `${f}${l}@${domain}`,
  ];
}

export async function findEmailCandidates(businesses: IdentifiedBusiness[]) {
  const limit = pLimit(5);

  return Promise.all(
    businesses.map((business) =>
      limit(async () => {
        const domain = extractDomain(business.website);
        const all = new Map<string, EmailCandidate>();

        if (business.website) {
          const websiteEmails = await crawlEmails(
            business.website,
            business.ownerFirstName,
            business.ownerLastName,
          );
          for (const candidate of websiteEmails) {
            all.set(candidate.email.toLowerCase(), candidate);
          }
        }

        if (domain && process.env.HUNTER_API_KEY) {
          const domainEmails = await hunterDomainSearch(domain);
          for (const email of domainEmails) {
            all.set(email.toLowerCase(), {
              email,
              emailType: classifyEmail(email, business.ownerFirstName, business.ownerLastName),
              source: "hunter_domain_search",
              verified: false,
            });
          }

          if (business.ownerFirstName && business.ownerLastName) {
            const finder = await hunterEmailFinder(domain, business.ownerFirstName, business.ownerLastName);
            if (finder) {
              all.set(finder.toLowerCase(), {
                email: finder,
                emailType: "personal",
                source: "hunter_email_finder",
                verified: false,
              });
            }
          }
        }

        if (domain && all.size === 0 && business.ownerFirstName && business.ownerLastName) {
          for (const email of patternCandidates(business.ownerFirstName, business.ownerLastName, domain)) {
            all.set(email.toLowerCase(), {
              email,
              emailType: "direct-business",
              source: "pattern_generation",
              verified: false,
            });
          }
        }

        if (domain && business.ownerFirstName && business.ownerLastName && all.size === 0) {
          const searchQuery = `"${business.ownerFirstName} ${business.ownerLastName}" "${domain}" email`;
          const serp = await searchSerpApi(searchQuery);
          const extracted = (serp.map((item) => `${item.title ?? ""} ${item.snippet ?? ""}`).join(" ").match(EMAIL_REGEX) ?? []);

          for (const email of extracted) {
            all.set(email.toLowerCase(), {
              email,
              emailType: classifyEmail(email, business.ownerFirstName, business.ownerLastName),
              source: "serp_fallback",
              verified: false,
            });
          }
        }

        return {
          business,
          candidates: Array.from(all.values()),
        };
      }),
    ),
  );
}
