# LeadForge — Build Prompt
## For Google AI Studio / Coding Agent

---

## What You Are Building

Build a full-stack web application called **LeadForge** — a B2B lead generation tool that uses an AI agent pipeline to discover business leads, identify owners, find direct email addresses, verify them, and export the results as a CSV or Excel file.

This is a private tool for an AI automation agency owner. It must be production-grade, secure, and reliable.

---

## Tech Stack

- **Frontend + Backend:** Next.js 14 (App Router)
- **Database + Auth:** Supabase (PostgreSQL + Supabase Auth) — do NOT use Clerk or any other auth provider
- **Styling:** Tailwind CSS
- **AI / LLM:** Groq API (`llama-3.3-70b-versatile` model)
- **Search:** SerpAPI (Google Search results)
- **Email Discovery:** Hunter.io API (optional, falls back to pattern generation if not set)
- **Email Verification:** DNS MX record check + SMTP handshake
- **Export:** SheetJS (XLSX) + native CSV string generation
- **Deployment:** Vercel-compatible (all secrets in environment variables)

---

## Database Schema

Create these two tables in Supabase. Enable Row Level Security (RLS) on both so users can only access their own data.

```sql
-- Table 1: Search history
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  location TEXT NOT NULL,
  company_size TEXT,
  lead_count_requested INT DEFAULT 50,
  lead_count_found INT DEFAULT 0,
  email_priority TEXT DEFAULT 'owner_first',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS: users can only see their own rows
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own searches" ON search_history
  FOR ALL USING (auth.uid() = user_id);

-- Table 2: Individual lead results
CREATE TABLE lead_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_history(id) ON DELETE CASCADE,
  business_name TEXT,
  owner_first_name TEXT,
  owner_last_name TEXT,
  email TEXT,
  email_type TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone TEXT,
  website TEXT,
  location TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own leads" ON lead_results
  FOR ALL USING (
    search_id IN (
      SELECT id FROM search_history WHERE user_id = auth.uid()
    )
  );
```

---

## Environment Variables

The app needs these environment variables. Never expose the secret keys to the client side.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
SERP_API_KEY=
HUNTER_API_KEY=
GOOGLE_MAPS_API_KEY=
```

---

## Pages to Build

### `/auth/login`
Simple login page using Supabase Auth (email + password). No public sign-up — admin creates accounts manually in Supabase dashboard. Redirect to `/dashboard` after login.

### `/dashboard`
Main page. Two sections:
1. **Search Form** (center) — the main input area
2. **Past Searches** (sidebar or below) — list of previous search sessions with status badges and re-download buttons

### `/search/[id]`
Live progress page. Shows:
- Step indicator: Discovery → Owner ID → Email Discovery → Verification → Complete
- Current step message (e.g. "Finding emails for Smith Heating Ltd...")
- Lead count found so far vs target
- Results table that populates in real-time as leads come in
- Download buttons (CSV + XLSX) — enabled once at least 1 lead is found

---

## Search Form Fields

Build the form with these exact fields:

| Field | Component | Notes |
|---|---|---|
| Niche / Keyword | `<input type="text">` | Placeholder: "e.g. HVAC businesses, plumbers, roofing contractors" |
| Location | `<input type="text">` | Placeholder: "e.g. Manchester UK, Texas USA" |
| Company Size | `<select>` | Options: Any, 1–10 employees, 11–50 employees, 51–200 employees, 200+ |
| Number of Leads | `<input type="range">` + number display | Min: 5, Max: 50, Default: 30 |
| Email Priority | Toggle switch | "Owner email first" (on by default) or "Business email only" |

On submit: POST to `/api/leads/search`, then redirect to `/search/[returnedSearchId]`.

---

## API Routes to Build

### `POST /api/leads/search`

1. Authenticate the request (check Supabase session). Return 401 if not logged in.
2. Validate the input fields.
3. Create a new row in `search_history` with `status: 'pending'`.
4. Start the AI pipeline (see pipeline below) — run it as a background async process.
5. Return `{ searchId, status: 'running' }` immediately to the client.

### `GET /api/leads/status?searchId=...`

1. Authenticate the request.
2. Fetch the `search_history` row for that searchId.
3. Fetch the current `lead_results` count for that searchId.
4. Return: `{ status, step, leadsFound, leadsTarget, latestMessage }`

The frontend polls this every 3 seconds while status is "running".

### `GET /api/leads/export?searchId=...&format=csv`

1. Authenticate the request.
2. Fetch all `lead_results` for the searchId.
3. If `format=xlsx`: use SheetJS to generate an Excel file, return with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
4. If `format=csv`: build a CSV string, return with `Content-Type: text/csv`
5. Set `Content-Disposition: attachment; filename="leads_[niche]_[date].csv"`

---

## AI Pipeline (Server-Side, inside POST /api/leads/search)

This is the core of the app. Run all steps server-side. Log progress by updating a `status_message` field in `search_history` as each step progresses.

### Step 1 — Business Discovery

Use SerpAPI to search Google. Build 2–3 queries from the niche + location:
- `"{niche}" in "{location}"`
- `"{niche}" "{location}" contact`
- `site:yelp.com OR site:yell.com "{niche}" "{location}"`

Parse the results. Extract:
- Business name
- Website URL
- Address / location

Deduplicate by domain. Aim for 2x the requested lead count at this stage (so if user wants 30 leads, get 60 businesses, since not all will yield emails).

If `GOOGLE_MAPS_API_KEY` is set, also call the Google Maps Places API with `type=business` and the niche as the text query. Merge results with the SerpAPI results.

### Step 2 — Owner Identification

For each business, do the following in parallel (Promise.all with concurrency limit of 5):

1. Fetch the business website. Look for `/about`, `/about-us`, `/team`, `/contact` pages using Cheerio.
2. Extract all text from those pages. Pass it to Groq (`llama-3.3-70b-versatile`) with this system prompt:

```
You are a data extraction assistant. Given the text content of a company's website, 
extract the name of the business owner, founder, or director.
Return ONLY a JSON object: { "firstName": "...", "lastName": "...", "title": "..." }
If no owner is found, return: { "firstName": null, "lastName": null, "title": null }
Do not include any explanation or markdown.
```

3. If Groq returns null names, run a Google search via SerpAPI: `"{businessName}" owner name`
   Pass the top 3 search result snippets to Groq with the same prompt.

4. For UK businesses (if location contains "UK" or "United Kingdom"):
   Call Companies House API (free): `https://api.company-information.service.gov.uk/search/companies?q={businessName}`
   Extract director names from the company officers endpoint.

Store `{ firstName, lastName }` for each business (may be null).

### Step 3 — Email Discovery

For each business `{ firstName, lastName, domain }`, run in this priority order:

**3a. Crawl website for emails:**
Fetch the homepage and /contact page. Use a regex to find all `mailto:` links and email patterns in the HTML: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`

Classify each found email:
- If it matches `firstname` or `lastname` → `direct-business`
- If it's `info@`, `contact@`, `hello@`, `admin@`, `support@` → `generic`

**3b. Hunter.io API (if HUNTER_API_KEY is set):**
Call the Domain Search endpoint: `https://api.hunter.io/v2/domain-search?domain={domain}&api_key={key}`
This returns all known emails for the domain. Filter for any that match the owner's name.

Also call Email Finder: `https://api.hunter.io/v2/email-finder?domain={domain}&first_name={firstName}&last_name={lastName}&api_key={key}`

**3c. Pattern generation (fallback):**
If no email found yet and owner name is known, generate these candidates:
```
firstname@domain.com
f.lastname@domain.com
firstname.lastname@domain.com
flastname@domain.com
firstnamelastname@domain.com
```

**3d. Web search fallback:**
Search Google: `"{firstName} {lastName}" "{domain}" email`
Extract any email addresses from the results using regex.

### Step 4 — Email Verification

For each email candidate:

1. **Syntax check:** validate with regex
2. **MX record check:** use Node's `dns.resolveMx()` — if no MX records, discard
3. **SMTP handshake:**
   ```
   Connect to MX server on port 25
   Send: EHLO leadforge.app
   Send: MAIL FROM:<verify@leadforge.app>
   Send: RCPT TO:<{emailToVerify}>
   If 250 response → verified = true
   If 550 response → email does not exist, discard
   If 421/timeout → mark as unverified, still include
   ```
   Use a 5-second timeout. If the server blocks SMTP checks (many do), mark as `unverified` and move on. Do not discard unverified emails — still include them in results.

### Step 5 — Select Best Email & Store

Apply priority logic per lead:
```
IF owner personal email verified → emailType = "personal"
ELSE IF direct-business email found → emailType = "direct-business"  
ELSE IF generic business email found → emailType = "generic"
ELSE → email = null, emailType = "not_found"
```

Insert a row into `lead_results` for each lead found.

Update `search_history`:
- `lead_count_found = N`
- `status = 'complete'`
- `completed_at = NOW()`

Stop the pipeline once `lead_count_found` reaches `lead_count_requested`.

---

## Results Table Columns

The results table on `/search/[id]` should show these columns:

| Column | Field |
|---|---|
| # | Row index |
| Business | `business_name` |
| Owner | `owner_first_name + " " + owner_last_name` (or "—" if null) |
| Email | `email` (or "Not found" if null) |
| Type | Badge: `personal` (green) / `direct-business` (blue) / `generic` (yellow) / `not_found` (red) |
| Verified | Checkmark if `email_verified = true`, warning icon if false |
| Phone | `phone` or "—" |
| Website | Clickable link |
| Location | `location` |

---

## Export File Columns (CSV/XLSX)

The downloaded file must have these exact columns in this order:

```
Business Name, Owner First Name, Owner Last Name, Email, Email Type, Email Verified, Phone, Website, Location, Source
```

---

## UI Design Requirements

- Color palette: Black background (`#0A0A0A`), beige/warm white text (`#F5F0E8`), accent color `#C8A97E` (warm gold)
- Font: Use a clean, modern sans-serif (e.g. Geist, DM Sans, or similar)
- The progress page should have a step-by-step indicator that highlights the current step
- The results table should load rows progressively as they are found (poll every 3 seconds, append new rows)
- Smooth loading states on all async actions
- Show a toast notification when the search completes

---

## Error Handling Requirements

- If SerpAPI returns no results: show "No businesses found for this search. Try broadening your niche or location."
- If pipeline hits 180-second timeout: save partial results, mark search as `partial`, and show the results with a "Search timed out — showing partial results" banner
- If Hunter API quota is exceeded: silently fall back to pattern generation (do not show an error to the user)
- If SMTP check is blocked: mark email as unverified, continue — do not fail the pipeline
- All API calls must have try/catch with proper error logging

---

## Security Requirements

- All routes under `/api/leads/*` must check for a valid Supabase session. Return 401 for unauthenticated requests.
- Use `SUPABASE_SERVICE_ROLE_KEY` only on the server side for admin operations. Never expose it to the client.
- `HUNTER_API_KEY`, `SERP_API_KEY`, `GROQ_API_KEY` must only be referenced in server-side code (API routes). Never import them in client components.
- RLS policies on both Supabase tables must be enforced.

---

## File Structure

```
/app
  /auth
    /login
      page.tsx
  /dashboard
    page.tsx
  /search
    /[id]
      page.tsx
/api
  /leads
    /search
      route.ts
    /status
      route.ts
    /export
      route.ts
/components
  SearchForm.tsx
  ResultsTable.tsx
  ProgressIndicator.tsx
  LeadRow.tsx
  ExportButtons.tsx
/lib
  supabase.ts
  pipeline/
    discover.ts      ← Step 1
    identify.ts      ← Step 2
    emailFind.ts     ← Step 3
    emailVerify.ts   ← Step 4
    compile.ts       ← Step 5
  utils/
    serpapi.ts
    hunter.ts
    groq.ts
    smtp.ts
```

---

## Important Notes

1. The pipeline runs entirely server-side. The client only polls for status updates.
2. Do NOT run the pipeline synchronously inside the POST response. Use `setTimeout` or a background async function to decouple it from the HTTP response.
3. Hunter.io should be used if `HUNTER_API_KEY` is set, but the app must work correctly without it.
4. Use `dns.promises.resolveMx` from Node's built-in `dns` module for MX checks. Use `net.createConnection` for SMTP handshake.
5. Limit concurrent business processing to 5 at a time using a concurrency limiter (e.g. `p-limit` package) to avoid rate limits.
6. The export endpoint must work even while the search is still running (export whatever has been found so far).
7. Supabase Auth is used — do NOT use Clerk, NextAuth, or any other auth library.

---

*End of Build Prompt*
