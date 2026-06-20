// ─────────────────────────────────────────────────────────────
//  Client Supabase (PRD §10.2) — PUBLISHABLE key only, used purely for
//  magic-link auth (signInWithOtp / session). Entitlement data is never
//  read here; RLS denies the publishable key, and the server (secret
//  key) is the only authority.
//
//  Lazy via dynamic import: the ~220KB supabase-js library is split into
//  its own chunk and only fetched the first time getSupabase() is awaited
//  (on mount where auth is configured). Unconfigured/CI builds (no
//  VITE_SUPABASE_*) never load it, keeping the base bundle lean. Returns
//  null when not configured, so the chat degrades to "no auth".
// ─────────────────────────────────────────────────────────────

function env(name) {
  try {
    return import.meta.env?.[name];
  } catch {
    return undefined;
  }
}

export function isAuthConfigured() {
  return Boolean(env("VITE_SUPABASE_URL") && env("VITE_SUPABASE_PUBLISHABLE_KEY"));
}

let _client; // undefined = unresolved; null = not configured; else the client
export async function getSupabase() {
  if (_client !== undefined) return _client;
  if (!isAuthConfigured()) {
    _client = null;
    return null;
  }
  const { createClient } = await import("@supabase/supabase-js");
  _client = createClient(env("VITE_SUPABASE_URL"), env("VITE_SUPABASE_PUBLISHABLE_KEY"));
  return _client;
}
