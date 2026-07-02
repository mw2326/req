# REQ — requirement intelligence, crowdsourced

Paste internship/job postings, extract real screenable requirements, search what companies
actually ask for, and track the skill gap to your dream company — with AI-generated project
ideas that close it.

**Live at [tryreq.com](https://tryreq.com)** — `.edu` email required (magic link or Google).

Stack: Next.js 14 (App Router) + Tailwind, Groq (free LLM API) for extraction, Supabase
(Postgres + Auth) for the shared postings database and `.edu`-gated accounts, Upstash Redis
for rate limiting, deployed on Vercel.

## Local development

```bash
cp .env.example .env.local
# fill in .env.local — see below for what each var is for
npm install
npm run dev
```

Open http://localhost:3000 — signed-out visitors land on the public landing page; the app
itself lives at `/dashboard` and requires a `.edu` sign-in.

Env vars (see `.env.example` for the full list with comments):
- `GROQ_API_KEY` — LLM extraction/project-idea generation
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — shared `postings` table (server-side only)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — auth + per-user `profiles`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — rate limiting (optional locally;
  silently skipped if unset)
- `ADMIN_EMAILS` — comma-separated `.edu` addresses allowed at `/admin`

Schema changes live in `supabase/schema.sql` — run the whole file in the Supabase SQL
editor any time it changes; every statement is idempotent (`if not exists` / `or replace`),
safe to re-run.

## How it's organized

```
app/
  page.tsx                     public landing page (marketing copy, Sign In)
  dashboard/page.tsx            the app itself: Add Posting / Search / Dream Company tabs
  login/page.tsx                .edu-gated sign-in (magic link + Google)
  admin/page.tsx                 moderation view: reported postings, remove/restore
  auth/callback/route.ts        exchanges the auth code for a session
  api/extract/route.ts         calls Groq to pull {company, role, skills} from pasted text
  api/projects/route.ts        calls Groq to suggest projects that close a skill gap
  api/postings/route.ts        reads/writes the shared postings table in Supabase
  api/postings/[id]/report/route.ts  logs a report against a posting
  api/admin/postings/route.ts   admin-only: list postings with report counts
  api/admin/postings/[id]/route.ts  admin-only: set a posting's status
  api/profile/route.ts         reads/writes the signed-in user's skills + dream company
lib/
  groq.ts                       Groq API wrapper (server-side only)
  supabase.ts                   service-role Supabase client, for the shared postings table
  supabase-browser.ts           anon-key Supabase client, for client components (login, etc)
  supabase-server.ts            anon-key Supabase client + cookies, for route handlers
  rate-limit.ts                  Upstash-backed rate limiter for the Groq/postings routes
  admin.ts                       checks a user's email against ADMIN_EMAILS
middleware.ts                    gates /dashboard and /admin behind auth; / and /login stay public
supabase/
  schema.sql                    source of truth for the DB schema — run it after any change
```

## Known v1 tradeoffs (worth knowing, not bugs)

- **Company matching is substring-based.** Searching "Google" won't automatically merge
  with a posting saved as "Alphabet/Google LLC". A cleanup pass or a canonical-company
  table would fix this later.
- **The `.edu` check only runs at account creation.** The Postgres trigger blocks new
  signups with a non-`.edu` email, but doesn't re-verify existing accounts on every login
  (not an issue in practice, since no non-`.edu` account can ever be created).
- **Rate limits are per-user, not adaptive.** Fixed 10/hour on the Groq routes and 30/hour
  on posting creation — fine for an MVP, but a legitimate power user could hit the ceiling
  during heavy use. Worth watching once there's real traffic.
- **Moderation is manual, not automated.** Reports just flag a posting for review at
  `/admin` — there's no automatic content filtering on submission. Fine while volume is low
  and there's a human reviewing; worth revisiting if reports start piling up faster than
  they can be reviewed.
