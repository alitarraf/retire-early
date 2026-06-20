// ─────────────────────────────────────────────────────────────
//  Entitlement gate (PRD §10.3) — the I/O layer over the pure core.
//  Resolves identity, reads/writes the Supabase usage + subscriptions
//  tables (secret key, bypasses RLS), and returns an allow/deny verdict
//  the proxy acts on. The Supabase client is injectable so this is unit-
//  testable with a fake (no live DB in CI).
//
//  Identity:
//   • Signed-in  → Supabase access token (Authorization: Bearer …),
//     verified server-side; keyed on user.id. Active subscriber = no meter.
//   • Anonymous  → an httpOnly device-id cookie (issued if absent). It is a
//     random UUID, deliberately UNSIGNED: anon metering is a soft nudge a
//     determined user can reset via incognito (§10.3), so there's nothing
//     to forge that matters and no AUTH_SECRET to manage.
// ─────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import { getServiceClient, isSupabaseConfigured } from "./supabase.js";
import { decide, isActiveSubscription, isNewUserTurn } from "./entitlement.js";

export const DEVICE_COOKIE = "ask_did";

function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function deviceCookie(id) {
  const yearish = 60 * 60 * 24 * 400;
  return `${DEVICE_COOKIE}=${id}; Path=/; Max-Age=${yearish}; HttpOnly; SameSite=Lax; Secure`;
}

async function getUser(sb, req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function meterKey(sb, key, tier) {
  const { data: row } = await sb.from("usage").select("*").eq("key", key).maybeSingle();
  const d = decide({ row, tier, now: Date.now() });
  if (!d.allowed) {
    return {
      allow: false,
      status: tier === "free" ? 402 : 401,
      body: { error: tier === "free" ? "quota_exhausted" : "signup_required", tier, limit: d.limit },
    };
  }
  // Allowed. The caller invokes commit() only after the upstream turn starts
  // successfully, so a network/credits failure doesn't burn quota (§10.1).
  return {
    allow: true,
    tier,
    remaining: d.remaining,
    commit: async () => {
      const { count, window_start } = d.nextRow;
      await sb.from("usage").upsert({ key, tier, count, window_start }, { onConflict: "key" });
    },
  };
}

/**
 * Decide whether to allow this /api/chat request.
 * @returns one of:
 *   { allow: true }                                  pass straight through
 *   { allow: true, tier, remaining, commit, setCookie? }  metered turn — call commit() on success
 *   { allow: false, status, body, setCookie? }       blocked (401 signup / 402 paywall)
 */
export async function checkEntitlement(req, messages, sb = isSupabaseConfigured() ? getServiceClient() : null) {
  // Unmetered where Supabase isn't configured (CI, dev without keys).
  if (!sb) return { allow: true };
  // Only meter NEW user turns; tool-result continuations pass through (§10.1).
  if (!isNewUserTurn(messages)) return { allow: true };

  const user = await getUser(sb, req);

  if (user) {
    const { data: sub } = await sb.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (isActiveSubscription(sub)) return { allow: true }; // Ask Pro — no metering
    return meterKey(sb, user.id, "free"); // signed-in-free → 5/day
  }

  // Anonymous → device cookie (issue if absent) → 3/day.
  const cookies = parseCookies(req.headers.get("cookie"));
  let did = cookies[DEVICE_COOKIE];
  let setCookie = null;
  if (!did) {
    did = randomUUID();
    setCookie = deviceCookie(did);
  }
  const res = await meterKey(sb, did, "anon");
  if (setCookie) res.setCookie = setCookie;
  return res;
}
