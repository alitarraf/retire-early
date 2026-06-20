// /api/stripe-checkout (PRD §10.4) — create a Checkout Session for Ask Pro.
// Signed-in users only. Finds or creates the Stripe customer, stores the
// user↔customer mapping, and returns the hosted Checkout URL. Never sets
// payment_method_types (dynamic payment methods).

import { json, readOrigin, originAllowed } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { getStripe } from "./_lib/stripe.js";
import { getUserFromRequest } from "./_lib/auth.js";

export const config = { path: "/api/stripe-checkout" };

export default async function handler(req) {
  const origin = readOrigin(req);
  if (!originAllowed(origin)) return json(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  const sb = getServiceClient();
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!sb || !stripe || !priceId) return json(500, { error: "server_misconfigured" }, origin);

  const user = await getUserFromRequest(sb, req);
  if (!user) return json(401, { error: "auth_required" }, origin);

  const { data: row } = await sb.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  let customerId = row?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = customer.id;
    await sb
      .from("subscriptions")
      .upsert(
        { user_id: user.id, email: user.email, stripe_customer_id: customerId, status: row?.status ?? "free" },
        { onConflict: "user_id" },
      );
  }

  const appUrl = process.env.APP_URL || origin || "http://localhost:8888";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?ask_checkout=success`,
      cancel_url: `${appUrl}/?ask_checkout=cancel`,
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id } },
    });
    return json(200, { url: session.url }, origin);
  } catch (e) {
    return json(502, { error: "stripe_error", detail: String(e?.message || e) }, origin);
  }
}
