-- Run this once against a Supabase (Postgres) project.
-- Dashboard: SQL Editor -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists jobs (
  job_id text primary key,
  posted_date text,
  work_study text,
  department text,
  job_code text,
  position_name text,
  start_date text,
  hourly_wage text,
  location text,
  first_seen_at timestamptz not null default now()
);

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirm_token text not null,
  unsubscribe_token text not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists idx_subscribers_confirm_token on subscribers (confirm_token);
create index if not exists idx_subscribers_unsubscribe_token on subscribers (unsubscribe_token);

-- Row Level Security stays on with no policies: every read/write in this
-- project goes through the server-side service_role key (scraper script and
-- /api functions), which bypasses RLS. The browser never talks to Supabase
-- directly, so no public policies are needed.
alter table jobs enable row level security;
alter table subscribers enable row level security;
