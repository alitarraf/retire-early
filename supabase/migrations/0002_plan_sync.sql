-- Account-scoped plan sync. Ties a user's plan inputs to their account so
-- signing in restores the plan across devices. Same doctrine as
-- 0001_entitlement.sql: SERVER-AUTHORITATIVE — only the Netlify functions touch
-- this, using the Supabase *secret* key (which bypasses RLS). The client only
-- holds the *publishable* key, so RLS must DENY it all access.
--
-- Run this in the Supabase SQL Editor (or `supabase db push`).

-- ── plans: one row per signed-in user, holding their plan inputs as JSON ──
create table if not exists public.plans (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null,                       -- the App's `inputs` object
  updated_at  timestamptz not null default now()
);

-- ── RLS: enable, add NO policies → publishable/anon/authenticated get nothing.
-- The secret key (service role, BYPASSRLS) is the only authority — same #1
-- footgun guard as 0001 (a table with RLS off is world-readable via PostgREST).
alter table public.plans enable row level security;

-- Explicit grant for the server role (sb_secret_ → service_role). Supabase
-- usually auto-grants, but a table created in the SQL editor can miss it,
-- surfacing as "permission denied for table" (42501). anon/authenticated get
-- nothing, so the publishable (client) key stays locked out.
grant all privileges on table public.plans to service_role;
