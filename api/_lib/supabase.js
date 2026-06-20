// ─────────────────────────────────────────────────────────────
//  Server-side Supabase client (PRD §10.2). Uses the SECRET key,
//  which bypasses row-level security — so this module must only ever
//  run inside the Netlify functions, never in the client bundle.
//
//  Lazy + side-effect-free: createClient is called on first use and
//  returns null when the env isn't configured, so the proxy degrades
//  to "unmetered" (allow) rather than crashing where Supabase isn't
//  set up (CI, a deploy without the keys).
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

let _client; // undefined = not yet resolved; null = not configured

export function getServiceClient() {
  if (_client !== undefined) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  _client =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          // We only use REST + auth, never realtime — but supabase-js constructs
          // its Realtime client eagerly, which throws on Node < 22 (no native
          // WebSocket). Hand it `ws` so init doesn't fail in the function runtime.
          realtime: { transport: ws },
        })
      : null;
  return _client;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

// Test seam: reset the memoized client between tests.
export function _resetServiceClient() {
  _client = undefined;
}
