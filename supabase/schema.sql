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
