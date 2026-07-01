-- Run this in the Supabase SQL editor for your project (SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists postings (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  role text not null,
  skills text[] not null default '{}',
  raw_text text,
  created_at timestamptz not null default now()
);

create index if not exists postings_company_idx on postings using gin (to_tsvector('english', company));
create index if not exists postings_skills_idx on postings using gin (skills);

-- Row Level Security: locked down by default. Our API routes use the
-- service role key (server-side only), which bypasses RLS, so the table
-- stays private from direct client access while still being readable/
-- writable through your own API.
alter table postings enable row level security;

-- Restrict signups to .edu email addresses. Fires on every new row in
-- auth.users, which covers both magic-link and Google OAuth first-time
-- sign-in (both create a user row on first auth) — so this is the single
-- enforcement point regardless of provider. A non-.edu Google account never
-- gets created and the auth call fails with this message.
create or replace function public.enforce_edu_email()
returns trigger as $$
begin
  if new.email !~* '\.edu$' then
    raise exception 'Only .edu email addresses are allowed.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_edu_email_trigger on auth.users;
create trigger enforce_edu_email_trigger
  before insert on auth.users
  for each row execute function public.enforce_edu_email();

-- Per-account profile: replaces the old localStorage-only "your skills" /
-- "dream company" state now that there's real auth. RLS scopes each row to
-- its owner so the browser-facing (anon key) client can read/write its own
-- profile directly without going through the service-role key.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  my_skills text[] not null default '{}',
  dream_company text not null default '',
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "users manage own profile" on profiles;
create policy "users manage own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Attribution + moderation state on postings. user_id lets an admin trace a
-- posting back to the account that added it; status lets a posting be
-- hidden (soft-removed) without losing the row, so it's reversible.
alter table postings add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table postings add column if not exists status text not null default 'visible' check (status in ('visible', 'removed'));

-- One row per report. The unique constraint stops a single user from
-- spamming reports on the same posting to inflate its visibility to admins.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references postings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (posting_id, reporter_id)
);

alter table reports enable row level security;
-- No policies: reports/postings moderation always goes through server
-- routes using the service-role client, same pattern as postings itself.
