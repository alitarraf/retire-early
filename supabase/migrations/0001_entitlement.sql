-- Ask Pro entitlement (PRD §10.2). The app's first persistent backend state.
-- Run this in the Supabase SQL Editor (or `supabase db push`).
--
-- Two tables, both SERVER-AUTHORITATIVE: only the Netlify functions touch them,
-- using the Supabase *secret* key (which bypasses RLS). The client only ever
-- holds the *publishable* key, so RLS must DENY it all access — see the explicit
-- ENABLE ROW LEVEL SECURITY below (a table with no policies is still fully
-- readable through PostgREST until RLS is actually enabled — the #1 footgun).

-- ── subscriptions: one row per signed-in user; webhook is the source of truth ──
create table if not exists public.subscriptions (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  email               text,
  stripe_customer_id  text unique,
  status              text not null default 'free',   -- 'free' | 'active' | 'past_due' | 'canceled'
  current_period_end  timestamptz,
  updated_at          timestamptz not null default now()
);

-- ── usage: rolling-24h prompt counter, keyed on deviceId (anon) or user_id ──
create table if not exists public.usage (
  key           text primary key,                     -- deviceId (anon) or auth user id
  tier          text not null default 'anon',         -- 'anon' | 'free'
  count         integer not null default 0,
  window_start  timestamptz not null default now()
);

-- Helpful for the webhook's customer-id → user mapping.
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

-- ── RLS: enable, add NO policies → publishable/anon/authenticated get nothing.
-- The secret key (service role) bypasses RLS, so the functions still have full
-- access. This is what keeps entitlement server-authoritative (§10.3).
alter table public.subscriptions enable row level security;
alter table public.usage         enable row level security;
