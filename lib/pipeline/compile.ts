import type { EmailCandidate, IdentifiedBusiness, LeadResultRow } from "@/lib/types";

function selectBestEmail(candidates: EmailCandidate[]) {
  const personalVerified = candidates.find((item) => item.emailType === "personal" && item.verified);
  if (personalVerified) return personalVerified;

  const direct = candidates.find((item) => item.emailType === "direct-business");
  if (direct) return direct;

  const generic = candidates.find((item) => item.emailType === "generic");
  if (generic) return generic;

  return null;
}

export function compileLead(business: IdentifiedBusiness, candidates: EmailCandidate[]): LeadResultRow {
  const selected = selectBestEmail(candidates);

  return {
    business_name: business.businessName,
    owner_first_name: business.ownerFirstName,
    owner_last_name: business.ownerLastName,
    email: selected?.email ?? null,
    email_type: selected?.emailType ?? "not_found",
    email_verified: selected?.verified ?? false,
    phone: business.phone ?? null,
    website: business.website,
    location: business.location,
    source: selected?.source ?? business.source ?? null,
  };
}
