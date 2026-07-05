# REQ — requirement intelligence, crowdsourced

Paste internship/job postings, extract real screenable requirements, search what companies
actually ask for, and track the skill gap to your dream company — with AI-generated project
ideas that close it.

**Live at [tryreq.com](https://tryreq.com)** — `.edu` email required (magic link or Google).

Stack: Next.js 14 (App Router) + Tailwind, Groq (free LLM API) for extraction, Supabase
(Postgres + Auth) for the shared postings database and `.edu`-gated accounts, Upstash Redis
for rate limiting, deployed on Vercel.

## Tech stack

- **Next.js 14 (App Router) + TypeScript** — full-stack framework; client components for
  the interactive pages, server-only Route Handlers for every API call that touches a
  secret (Groq key, Supabase service role key)
- **Tailwind CSS** — hand-styled dark UI, no component library
- **Supabase**
  - **Postgres** — the shared `postings` table plus `profiles` and `reports`
  - **Auth** — `.edu`-gated sign-in via magic link and Google OAuth, enforced by a
    Postgres trigger on `auth.users` so it applies regardless of provider
  - **Row Level Security** — scopes each user's `profiles` row to themselves
  - `@supabase/ssr` — cookie-based session handling across middleware, Server Components,
    and Route Handlers
- **Groq** (`llama-3.3-70b-versatile`) — extracts `{company, role, skills}` from pasted job
  postings, extracts skills from an uploaded resume PDF, and generates project ideas that
  close a skill gap
- **`pg_trgm` (Postgres)** — fuzzy-matches newly added companies/skills against everything
  already in the database, so "Google" and "Google Inc." collapse into one canonical name
  instead of being treated as unrelated
- **`pdf-parse`** — extracts text from an uploaded resume PDF server-side, before handing
  it to Groq for skill extraction
- **Upstash Redis + `@upstash/ratelimit`** — per-user sliding-window rate limiting on the
  Groq-calling routes and posting creation
- **Vercel** — hosting, deploys on push to `main`, edge middleware for the auth/admin gate

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
  api/resume/route.ts           parses an uploaded resume PDF, returns extracted skills
lib/
  groq.ts                       Groq API wrapper (server-side only)
  supabase.ts                   service-role Supabase client, for the shared postings table
  supabase-browser.ts           anon-key Supabase client, for client components (login, etc)
  supabase-server.ts            anon-key Supabase client + cookies, for route handlers
  rate-limit.ts                  Upstash-backed rate limiter for the Groq/postings routes
  admin.ts                       checks a user's email against ADMIN_EMAILS
  normalize.ts                   fuzzy-matches a company/skill against existing DB values
middleware.ts                    gates /dashboard and /admin behind auth; / and /login stay public
supabase/
  schema.sql                    source of truth for the DB schema — run it after any change
```

## Known v1 tradeoffs (worth knowing, not bugs)

- **Company/skill normalization is fuzzy-matched, going forward only.** New postings are
  matched against a growing `companies`/`skills` reference table via Postgres trigram
  similarity, so close variants collapse into one canonical name — but existing `postings`
  rows are never rewritten, and skills of 2 characters or fewer (e.g. "Go", "R") skip fuzzy
  matching entirely since trigram similarity on strings that short is unreliable.
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
