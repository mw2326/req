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

-- Company/skill normalization: fuzzy-matches new postings against everything
-- already seen, so "Google" and "Google Inc." collapse into one canonical
-- name instead of the substring matching in the postings GET route treating
-- them as unrelated. Going-forward only — existing postings rows are never
-- rewritten, only the reference tables below grow over time.
create extension if not exists pg_trgm;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists companies_trgm_idx on companies using gin (canonical_name gin_trgm_ops);
alter table companies enable row level security;
-- No policies: only the service-role client (via resolve_company/resolve_skill,
-- called from the postings POST route) touches these tables, same pattern as
-- postings/reports. Without this, Supabase's auto-generated API would let any
-- anon/authenticated client read and write this table directly.

create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists skills_trgm_idx on skills using gin (canonical_name gin_trgm_ops);
alter table skills enable row level security;

-- Seed both from whatever's already in postings, so new postings get matched
-- against history from day one. Only reads existing postings to populate
-- these new reference tables — does not modify any postings row.
insert into companies (canonical_name)
  select distinct company from postings on conflict (canonical_name) do nothing;
insert into skills (canonical_name)
  select distinct unnest(skills) from postings on conflict (canonical_name) do nothing;

-- Returns an existing canonical name if one is similar enough, otherwise
-- registers `input` as a new canonical name and returns it unchanged.
create or replace function resolve_company(input text)
returns text as $$
declare
  existing text;
begin
  select canonical_name into existing from companies
    where similarity(canonical_name, input) > 0.35
    order by similarity(canonical_name, input) desc limit 1;
  if existing is not null then return existing; end if;
  insert into companies (canonical_name) values (input) on conflict (canonical_name) do nothing;
  return input;
end;
$$ language plpgsql;

create or replace function resolve_skill(input text)
returns text as $$
declare
  existing text;
begin
  -- Skip fuzzy matching for very short skills (e.g. "Go", "R", "C") where
  -- trigram similarity is unreliable and prone to false positives.
  if length(input) <= 2 then
    insert into skills (canonical_name) values (input) on conflict (canonical_name) do nothing;
    return input;
  end if;
  select canonical_name into existing from skills
    where similarity(canonical_name, input) > 0.45
    order by similarity(canonical_name, input) desc limit 1;
  if existing is not null then return existing; end if;
  insert into skills (canonical_name) values (input) on conflict (canonical_name) do nothing;
  return input;
end;
$$ language plpgsql;

-- Admin-only fixes for normalization mistakes: fuzzy matching isn't perfect,
-- so this lets an admin correct an under-merge (two spellings that should be
-- one) or over-merge (two different things that got collapsed) by renaming
-- or merging a canonical entry. Handles rename and merge identically — the
-- postings update is the same whether new_name is brand-new or already
-- exists.
create or replace function admin_merge_company(old_name text, new_name text)
returns void as $$
begin
  update postings set company = new_name where company = old_name;
  insert into companies (canonical_name) values (new_name) on conflict (canonical_name) do nothing;
  if old_name <> new_name then
    delete from companies where canonical_name = old_name;
  end if;
end;
$$ language plpgsql;

create or replace function admin_merge_skill(old_name text, new_name text)
returns void as $$
begin
  update postings set skills = array_replace(skills, old_name, new_name) where old_name = any(skills);
  insert into skills (canonical_name) values (new_name) on conflict (canonical_name) do nothing;
  if old_name <> new_name then
    delete from skills where canonical_name = old_name;
  end if;
end;
$$ language plpgsql;
