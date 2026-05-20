# LeadForge

LeadForge is a Next.js 14 + Supabase app for AI-assisted B2B lead discovery, owner enrichment, email discovery, verification, and export.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Run SQL schema in Supabase SQL editor:

- `/home/runner/work/Leadgain/Leadgain/supabase/schema.sql`

4. Start development server:

```bash
npm run dev
```

## Routes

- `/auth/login`
- `/dashboard`
- `/search/[id]`
- `/api/leads/search`
- `/api/leads/status`
- `/api/leads/export`
