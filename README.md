# REQ — requirement intelligence, crowdsourced

Paste internship/job postings, extract real screenable requirements, search what companies
actually ask for, and track the skill gap to your dream company — with AI-generated project
ideas that close it.

Stack: Next.js 14 (App Router) + Tailwind, Groq (free LLM API) for extraction, Supabase
(free Postgres) for the shared postings database.

## 1. Get a free Groq API key

1. Go to https://console.groq.com/keys
2. Sign up (no credit card needed) and create an API key
3. Copy it — you'll paste it into `.env.local` below

Groq's free tier is generous and fast; this app uses `llama-3.3-70b-versatile`, which is
plenty capable for extraction and short project suggestions.

## 2. Create a free Supabase project

1. Go to https://supabase.com and create a new project (free tier)
2. Once it's ready, open **SQL Editor** in the sidebar, paste the contents of
   `supabase/schema.sql` from this repo, and run it — this creates the `postings` table
3. Go to **Project Settings > API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not the anon key) → `SUPABASE_SERVICE_ROLE_KEY`

The service role key is only ever used server-side in this app's API routes, never sent to
the browser — that's what keeps the database writable without exposing it to random
visitors.

## 3. Local setup

```bash
cp .env.example .env.local
# paste your GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY into .env.local

npm install
npm run dev
```

Open http://localhost:3000 — you should see the REQ dashboard.

## 4. Deploy to Vercel (free)

```bash
npm i -g vercel   # if you don't have it
vercel
```

Or push this folder to a GitHub repo and import it at https://vercel.com/new.

Either way, once the project exists on Vercel, go to **Project Settings > Environment
Variables** and add the same three variables from `.env.local`:
- `GROQ_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after adding them (Vercel will prompt you, or run `vercel --prod`).

## How it's organized

```
app/
  page.tsx              the whole UI: Add Posting / Search / Dream Company tabs
  api/extract/route.ts  calls Groq to pull {company, role, skills} from pasted text
  api/projects/route.ts calls Groq to suggest projects that close a skill gap
  api/postings/route.ts reads/writes the shared postings table in Supabase
lib/
  groq.ts                Groq API wrapper (server-side only)
  supabase.ts             Supabase client (server-side only, service role key)
supabase/
  schema.sql              run this once in the Supabase SQL editor
```

## Known v1 tradeoffs (worth knowing, not bugs)

- **No auth yet.** "Your skills" and "dream company" live in the browser's `localStorage`,
  so they're per-device, not per-account. Anyone can add postings to the shared database
  with no login. Fine for an MVP; add Supabase Auth later if you want real accounts.
- **Company matching is substring-based.** Searching "Google" won't automatically merge
  with a posting saved as "Alphabet/Google LLC". A cleanup pass or a canonical-company
  table would fix this later.
- **No rate limiting** on the Groq-calling routes. If this gets real traffic, add basic
  rate limiting (e.g. Vercel's built-in or Upstash) before it goes viral, or the free Groq
  tier could get hit hard by one bad actor.
