// /api/stripe-portal (PRD §10.4) — open the Stripe Billing Portal so a
// subscriber can manage / cancel / update payment. Signed-in users with a
// Stripe customer only.

import { json, readOrigin, originAllowed } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { getStripe } from "./_lib/stripe.js";
import { getUserFromRequest } from "./_lib/auth.js";

export const config = { path: "/api/stripe-portal" };

export default async function handler(req) {
  const origin = readOrigin(req);
  if (!originAllowed(origin)) return json(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  const sb = getServiceClient();
  const stripe = getStripe();
  if (!sb || !stripe) return json(500, { error: "server_misconfigured" }, origin);

  const user = await getUserFromRequest(sb, req);
  if (!user) return json(401, { error: "auth_required" }, origin);

  const { data: row } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!row?.stripe_customer_id) return json(400, { error: "no_customer" }, origin);

  const appUrl = process.env.APP_URL || origin || "http://localhost:8888";
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: appUrl,
    });
    return json(200, { url: session.url }, origin);
  } catch (e) {
    return json(502, { error: "stripe_error", detail: String(e?.message || e) }, origin);
  }
}
