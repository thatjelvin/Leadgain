# Architecture Document
## LeadForge — System Design & Data Flow

**Version:** 1.0  
**Stack:** Next.js (App Router) · Supabase · Tailwind CSS · Vercel

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│              Next.js Frontend (Browser)                 │
│   Search Form → Progress UI → Results Table → Download  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS (fetch / SSE)
┌───────────────────────▼─────────────────────────────────┐
│                   NEXT.JS BACKEND                        │
│              API Routes (Server-Side)                    │
│                                                         │
│  /api/leads/search     ← Triggers the AI pipeline       │
│  /api/leads/status     ← Streams progress updates       │
│  /api/leads/export     ← Returns CSV / XLSX download    │
│  /api/auth/*           ← Supabase Auth handlers         │
└──────┬────────────────────────────┬─────────────────────┘
       │                            │
┌──────▼──────────┐     ┌──────────▼──────────────────────┐
│   SUPABASE DB   │     │         AI PIPELINE              │
│                 │     │  (runs inside API route)         │
│  users          │     │                                  │
│  search_history │     │  Step 1: Business Discovery      │
│  lead_results   │     │    └─ SerpAPI / Google Search    │
│                 │     │                                  │
└─────────────────┘     │  Step 2: Owner Identification    │
                        │    └─ Groq LLM agent             │
                        │    └─ Web scraping (Cheerio)     │
                        │                                  │
                        │  Step 3: Email Discovery         │
                        │    └─ Pattern generation         │
                        │    └─ Site crawl (mailto links)  │
                        │    └─ Hunter.io API (optional)   │
                        │                                  │
                        │  Step 4: Email Verification      │
                        │    └─ SMTP handshake (dns/nodemailer) │
                        │    └─ MX record check            │
                        │                                  │
                        │  Step 5: Compile + Store         │
                        │    └─ Supabase (lead_results)    │
                        └─────────────────────────────────┘
```

---

## 2. Database Schema (Supabase / PostgreSQL)

### `users`
Managed by Supabase Auth. No custom table needed.

---

### `search_history`

```sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  location TEXT NOT NULL,
  company_size TEXT,
  lead_count_requested INT DEFAULT 50,
  lead_count_found INT DEFAULT 0,
  email_priority TEXT DEFAULT 'owner_first',
  status TEXT DEFAULT 'pending',   -- pending | running | complete | failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

### `lead_results`

```sql
CREATE TABLE lead_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_history(id) ON DELETE CASCADE,
  business_name TEXT,
  owner_first_name TEXT,
  owner_last_name TEXT,
  email TEXT,
  email_type TEXT,        -- personal | direct-business | generic | not_found
  email_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  website TEXT,
  location TEXT,
  source TEXT,            -- e.g. "google_maps", "company_website", "hunter"
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. API Routes

### `POST /api/leads/search`

**Purpose:** Accepts search form data, creates a `search_history` record, and kicks off the AI pipeline asynchronously.

**Request Body:**
```json
{
  "niche": "HVAC businesses",
  "location": "Manchester, UK",
  "companySize": "1-50",
  "leadCount": 30,
  "emailPriority": "owner_first"
}
```

**Response:**
```json
{
  "searchId": "uuid-here",
  "status": "running"
}
```

The client then polls or uses SSE on `/api/leads/status?searchId=...` to get live progress.

---

### `GET /api/leads/status`

**Purpose:** Returns the current status and partial results of an ongoing search.

**Query:** `?searchId=uuid`

**Response:**
```json
{
  "status": "running",
  "step": "email_discovery",
  "leadsFound": 14,
  "leadsTarget": 30,
  "message": "Finding emails for Smith Heating Ltd..."
}
```

Uses Server-Sent Events (SSE) for real-time streaming updates to the progress UI.

---

### `GET /api/leads/export`

**Purpose:** Returns the completed lead list as CSV or XLSX.

**Query:** `?searchId=uuid&format=csv` or `?format=xlsx`

**Response:** File download with `Content-Disposition: attachment`.

---

## 4. AI Pipeline — Detailed Steps

### Step 1: Business Discovery

```
Input: niche, location, companySize
Method:
  1. Build Google search queries:
     - "{niche} in {location}"
     - "{niche} {location} contact"
     - site:yelp.com OR site:yell.com "{niche}" "{location}"
  2. Call SerpAPI with these queries
  3. Extract business names + websites from search results
  4. Optionally call Google Maps Places API for structured local results
Output: List of { businessName, website, address }
```

### Step 2: Owner Identification

```
Input: { businessName, website }
Method for each business:
  1. Scrape the website's /about, /team, /contact pages (Cheerio)
  2. Look for owner/founder/director name patterns in text
  3. Search Google: "{businessName} owner" or "{businessName} founder"
  4. Use Groq LLM to extract structured { firstName, lastName, title }
     from the scraped/searched text
  5. For UK businesses: query Companies House API (free) for director names
Output: { firstName, lastName } or null
```

### Step 3: Email Discovery

```
Input: { firstName, lastName, website domain }
Method (in priority order):
  1. Crawl website for mailto: links → extract any emails
  2. If Hunter.io API key is set:
     → Domain Search (gets all known emails for domain)
     → Email Finder (firstName + lastName + domain)
  3. Pattern generation if no API:
     Generate candidates:
       firstname@domain.com
       f.lastname@domain.com
       firstname.lastname@domain.com
       flastname@domain.com
  4. Web search: "{firstName} {lastName}" "{domain}" email
Output: List of email candidates with source labels
```

### Step 4: Email Verification

```
Input: email candidate
Method:
  1. Syntax check (regex)
  2. MX record lookup (DNS) — does the domain accept email?
  3. SMTP handshake (RCPT TO check) — does this mailbox exist?
     (Send EHLO → MAIL FROM → RCPT TO, check 250 response)
     Note: Some servers block this. If blocked, mark as "unverified"
Output: { email, verified: true/false, confidence: high/medium/low }
```

### Step 5: Compile + Store

```
Priority logic:
  IF owner email verified → use as primary
  ELSE IF direct business email (pattern matches owner) → use it
  ELSE IF generic business email (info@, contact@) → use, flag as generic
  ELSE → email = null, flag as not_found

Store to lead_results table.
Update search_history.status = "complete"
Update search_history.lead_count_found = N
```

---

## 5. Frontend Pages

```
/                  → Redirect to /dashboard
/auth/login        → Supabase Auth login page
/dashboard         → Main search form + past searches sidebar
/search/[id]       → Live progress view + results table
/search/[id]/export → Triggers CSV/XLSX download
```

---

## 6. Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GROQ_API_KEY=

# Search
SERP_API_KEY=           # SerpAPI for Google Search results

# Email Discovery (optional but recommended)
HUNTER_API_KEY=

# Optional
GOOGLE_MAPS_API_KEY=    # For structured local business data
COMPANIES_HOUSE_API_KEY= # UK only — free director lookup
```

---

## 7. Rate Limiting & Abuse Prevention

- Max 3 active searches per user at any time (enforced in API route)
- Pipeline timeout: 180 seconds. Return partial results if hit.
- SerpAPI: cache identical queries for 24 hours to avoid duplicate API spend
- Hunter.io: only called once per domain (cache domain results in Supabase)
- SMTP verification: rate-limit per domain (max 5 checks per domain per hour) to avoid being flagged

---

## 8. Error Handling

| Error | Handling |
|---|---|
| SerpAPI fails | Retry once, then fall back to direct Google scrape |
| Website unreachable | Skip to next step, continue pipeline |
| No owner found | Leave name blank, still attempt email discovery on domain |
| Hunter API limit reached | Skip Hunter, continue with pattern generation |
| SMTP check blocked | Mark email as "unverified", still include in results |
| Pipeline timeout | Save partial results, mark search as "partial" |

---

## 9. Security

- Supabase Row Level Security (RLS) on both tables — users can only read their own searches and leads
- API keys loaded only in server-side routes (never in `NEXT_PUBLIC_` vars except Supabase anon key)
- Auth middleware on all `/api/leads/*` routes — unauthenticated requests return 401

---

## 10. Deployment

- **Hosting:** Vercel (consistent with Colqad)
- **Database:** Supabase (hosted PostgreSQL)
- **Environment vars:** Set in Vercel project settings
- **Domain:** To be decided (e.g. `leadforge.app` or a subdomain)

---

*End of Architecture v1.0*
