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
   `supabase/schema.sql` from this repo, and run it — this creates the `postings`,
   `profiles`, and `reports` tables, a Postgres trigger that rejects any signup whose email
   doesn't end in `.edu` (covers both magic-link and Google sign-in), and the
   attribution/moderation columns on `postings`
3. Go to **Project Settings > API** and copy:
   - **Project URL** → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` (same value, two vars)
   - **service_role key** (not the anon key) → `SUPABASE_SERVICE_ROLE_KEY`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The service role key is only ever used server-side (for the shared `postings` table),
never sent to the browser. The anon key powers auth and each user's own `profiles` row,
protected by row-level security — that one's meant to be public, same as any Supabase
frontend app.

4. Enable email (magic link) sign-in: **Authentication > Providers > Email** should already
   be on by default.
5. Enable Google sign-in: **Authentication > Providers > Google**, toggle it on, and paste
   in a Google OAuth Client ID + Secret. Create those at
   https://console.cloud.google.com/apis/credentials (OAuth client type "Web application"),
   with the authorized redirect URI shown in the Supabase Google provider panel (it's your
   Supabase project's `.../auth/v1/callback` URL). Note that Google sign-in only *narrows*
   who can complete OAuth — the actual `.edu` check happens in the database trigger from
   step 2, so a non-`.edu` Google account will authenticate with Google but then fail to
   create a REQ account.

## 3. Create a free Upstash Redis database (rate limiting)

1. Go to https://console.upstash.com and create a new Redis database (free tier, no card)
2. Copy the **REST URL** and **REST Token** from the database details page →
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`

This rate-limits `/api/extract`, `/api/projects` (10 requests/hour/user — both call Groq),
and posting creation (30/hour/user). If you skip this step, rate limiting is silently
skipped rather than breaking local dev — but set it up before any real traffic.

## 4. Moderation (report + admin removal)

Every posting is tied to the account that added it, and any signed-in user can report a
posting from the Search tab. Reports don't auto-remove anything — you review them at
`/admin` and choose to remove (or restore) a posting.

Set `ADMIN_EMAILS` in `.env.local` to a comma-separated list of `.edu` addresses that
should have access to `/admin` (e.g. your own). Leave it blank to disable admin access
entirely.

## 5. Local setup

```bash
cp .env.example .env.local
# fill in .env.local: GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ADMIN_EMAILS

npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign in with a `.edu`
email (magic link) or a `.edu` Google account to reach the dashboard.

## 6. Deploy to Vercel (free)

```bash
npm i -g vercel   # if you don't have it
vercel
```

Or push this folder to a GitHub repo and import it at https://vercel.com/new.

Either way, once the project exists on Vercel, go to **Project Settings > Environment
Variables** and add all eight variables from `.env.local`:
- `GROQ_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_EMAILS`

Redeploy after adding them (Vercel will prompt you, or run `vercel --prod`). Also add your
production URL's `/auth/callback` (e.g. `https://your-app.vercel.app/auth/callback`) to
the Google OAuth client's authorized redirect URIs, and to Supabase's **Authentication >
URL Configuration > Redirect URLs** allow-list — otherwise Google sign-in will fail in
production even though it works locally.

## How it's organized

```
app/
  page.tsx                     the whole UI: Add Posting / Search / Dream Company tabs
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
middleware.ts                    redirects unauthenticated requests to /login, gates /admin
supabase/
  schema.sql                    run this once in the Supabase SQL editor
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
