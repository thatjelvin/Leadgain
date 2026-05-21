export type SearchStatus = "pending" | "running" | "complete" | "partial" | "failed";

export type PipelineStep =
  | "discovery"
  | "owner_identification"
  | "email_discovery"
  | "verification"
  | "complete";

export interface SearchRequest {
  niche: string;
  location: string;
  companySize?: string;
  leadCount: number;
  emailPriority: "owner_first" | "business_only";
}

export interface BusinessDiscoveryItem {
  businessName: string;
  website: string | null;
  location: string | null;
  phone?: string | null;
  source?: string | null;
}

export interface IdentifiedBusiness extends BusinessDiscoveryItem {
  ownerFirstName: string | null;
  ownerLastName: string | null;
}

export interface EmailCandidate {
  email: string;
  emailType: "personal" | "direct-business" | "generic";
  source: string;
  verified: boolean;
}

export interface LeadResultRow {
  business_name: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  email: string | null;
  email_type: "personal" | "direct-business" | "generic" | "not_found";
  email_verified: boolean;
  phone: string | null;
  website: string | null;
  location: string | null;
  source: string | null;
}
