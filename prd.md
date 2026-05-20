# Product Requirements Document
## LeadForge — AI-Powered B2B Lead Generation App

**Version:** 1.0  
**Author:** Jelvin  
**Status:** Draft  
**Stack:** Next.js · Supabase · Tailwind CSS · Node.js API Routes

---

## 1. Overview

LeadForge is a private web application that automates the discovery of verified B2B leads. The user inputs a niche (e.g. "HVAC businesses"), a target location, a company size range, and a desired lead count. The app then uses an AI agent to scour the web — finding business names, owner names, and verified direct email addresses — and outputs a downloadable CSV/Excel file.

The primary user is the owner (Jelvin), operating his AI automation agency. The app may be opened to other users in the future.

---

## 2. Problem Statement

Current AI agents used for lead generation produce generic, low-quality results — mostly `info@` or `contact@` emails that go unread. Manual prospecting is too slow. Existing tools (Apollo, Hunter) either cost too much at scale or don't support the scraping + AI enrichment pipeline needed for niche B2B outreach.

LeadForge solves this by running a multi-step AI pipeline: **discover → enrich → verify → export.**

---

## 3. Goals

- Generate up to 50 verified leads per search session
- Find the business owner's first name, last name, and direct email wherever possible
- Fall back to a verified business email if no personal email is found
- Export results as a clean CSV or XLSX file
- Keep all API keys server-side (never exposed to the client)
- Work reliably for local/regional niches (e.g. "HVAC businesses in Manchester")

---

## 4. Non-Goals (v1.0)

- CRM integration (not in scope yet)
- Email sending / outreach sequencing (out of scope)
- Real-time LinkedIn scraping (too brittle for v1)
- Paid data provider subscription (app uses open-web methods + free API tiers)

---

## 5. Users

| User | Description |
|---|---|
| Primary | Jelvin — agency owner running lead gen for client outreach |
| Secondary | Any trusted user granted access to the app |

Authentication: Supabase Auth (same as Colqad). Email/password login. No public sign-up by default.

---

## 6. Core Features

### 6.1 Search Form (Input)

The user fills out a single-screen search form with the following fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| Niche / Keyword | Text input | ✅ | e.g. "HVAC businesses", "plumbers", "roofing contractors" |
| Location | Text input | ✅ | City, region, or country. e.g. "Manchester, UK" |
| Company Size | Dropdown | ❌ | Options: Any, 1–10, 11–50, 51–200, 200+ employees |
| Number of Leads | Slider / Number | ✅ | Min 5, Max 50 |
| Email Priority | Toggle | ❌ | "Owner email first" (default ON) vs "Business email only" |

### 6.2 AI Lead Generation Pipeline

Once the form is submitted, the app triggers a server-side AI agent pipeline:

**Step 1 — Business Discovery**  
The AI searches the open web for businesses matching the niche + location. Sources: Google Search results, Google Maps listings, Yelp, industry directories (e.g. Checkatrade for UK trades), and company websites.

**Step 2 — Owner Identification**  
For each business found, the AI attempts to identify the owner's name using: the company's About/Team page, LinkedIn (public profiles), press mentions, local news, and business registry data (e.g. Companies House for UK).

**Step 3 — Email Discovery**  
For each identified person + domain, the app runs email discovery using:
- Pattern matching (e.g. `firstname@domain.com`, `f.lastname@domain.com`)
- Public email crawling (scraping the company site for any `mailto:` links)
- Hunter.io API (domain search + email finder, if API key is configured)
- Web search for `"owner name" + "email" + "company"`

**Step 4 — Email Verification**  
Each discovered email is verified using SMTP handshake + MX record check before being included in the export. Unverifiable emails are flagged but still included with a "unverified" status column.

**Step 5 — Result Compilation**  
All verified leads are compiled into a structured dataset and made available for download.

### 6.3 Results Table (Output Preview)

Before downloading, the user sees a results table with columns:

| Column | Description |
|---|---|
| # | Row number |
| Business Name | Full business name |
| Owner First Name | Discovered or blank |
| Owner Last Name | Discovered or blank |
| Email | Best email found (direct > business > generic) |
| Email Type | `personal`, `direct-business`, `generic` |
| Email Status | `verified`, `unverified` |
| Phone | If found |
| Website | Company URL |
| Location | City / region |
| Source | Where the lead was found |

### 6.4 Export

- Download as **CSV** (default)
- Download as **XLSX** (Excel)
- File named: `leads_[niche]_[location]_[date].csv`

### 6.5 Search History

Each search is saved to Supabase with: search params, timestamp, lead count found, and a link to re-download the results. Visible in a simple "Past Searches" sidebar or page.

---

## 7. Email Priority Logic

```
IF owner personal email found AND verified → use it
ELSE IF direct business email found (e.g. john@smithhvac.com) → use it  
ELSE IF business email found (e.g. info@smithhvac.com) → use it, flag as generic
ELSE → leave email blank, flag as "not found"
```

---

## 8. UI/UX Requirements

- Clean, professional dark-mode dashboard (consistent with Colqad's palette: black + beige)
- Real-time progress indicator while the AI pipeline runs (step-by-step status)
- Mobile-responsive layout
- Error handling: if a search returns 0 leads, show a clear message with suggestions

---

## 9. Technical Constraints

- All external API keys stored as Supabase environment variables or Vercel env vars — never exposed to the client
- Rate limiting on the search endpoint (max 3 concurrent searches per user)
- AI pipeline timeout: 3 minutes max per search. If timeout is hit, return whatever has been found so far
- No storing of scraped email data beyond the user's own search results

---

## 10. Integrations (v1.0)

| Integration | Purpose | Required? |
|---|---|---|
| Google Search API (SerpAPI or similar) | Business discovery | ✅ |
| Hunter.io API | Email discovery + verification | Optional (enhances quality) |
| Groq / OpenAI | AI reasoning agent for owner discovery | ✅ |
| Supabase | Auth + search history storage | ✅ |
| SheetJS | XLSX export | ✅ |

---

## 11. Success Metrics

- ≥ 70% of leads have a verified email address
- ≤ 10% bounce rate on exported emails when used for outreach
- Search completes in under 3 minutes for 50 leads
- Zero API key exposure incidents

---

## 12. Out of Scope (Future Versions)

- Apollo.io API integration (paid, adds depth)
- LinkedIn scraping (rate-limited and ToS-sensitive)
- Outreach sequencing built into the app
- Team/multi-user access management
- Webhook export to CRM

---

*End of PRD v1.0*
