// /api/stripe-webhook (PRD §10.4) — the single source of truth for entitlement.
// Verifies the Stripe signature against the RAW body, then applies the update
// idempotently. No origin check (server-to-server); the signature is the auth.

import { json } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { getStripe, mapEventToUpdate } from "./_lib/stripe.js";
import { applyEntitlementUpdate } from "./_lib/gate.js";

export const config = { path: "/api/stripe-webhook" };

export default async function handler(req) {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const stripe = getStripe();
  const sb = getServiceClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !sb || !secret) return json(500, { error: "server_misconfigured" });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text(); // RAW body — required for signature verification

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (e) {
    return json(400, { error: "bad_signature", detail: String(e?.message || e) });
  }

  try {
    const upd = mapEventToUpdate(event);
    if (upd) await applyEntitlementUpdate(sb, upd);
  } catch (e) {
    // Don't 500 on a handled-but-failed write; log and ack so Stripe doesn't
    // hammer retries. A later subscription.* event re-syncs the truth.
    console.error(JSON.stringify({ evt: "stripe_webhook_error", type: event?.type, detail: String(e?.message || e) }));
  }

  return json(200, { received: true });
}
