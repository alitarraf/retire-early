// ─────────────────────────────────────────────────────────────
//  Stripe helpers (PRD §10.4). Server-only — the secret key never
//  reaches the client. Subscriptions via Checkout Sessions + Billing
//  Portal + a signature-verified webhook (the single source of truth
//  for entitlement). Never set payment_method_types (dynamic methods).
//
//  The pure mappers (status + event → update) are unit-tested without
//  the SDK; getStripe() is the lazy client.
// ─────────────────────────────────────────────────────────────

import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-05-27.dahlia";

let _stripe;
export function getStripe() {
  if (_stripe !== undefined) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  _stripe = key ? new Stripe(key, { apiVersion: STRIPE_API_VERSION }) : null;
  return _stripe;
}

export function _resetStripe() {
  _stripe = undefined;
}

/** Stripe subscription.status → our coarse entitlement status. */
export function mapStripeStatus(s) {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default: // canceled, incomplete, incomplete_expired, paused, …
      return "canceled";
  }
}

/**
 * Billing-period end as ISO. Robust to the API change that moved
 * current_period_end from the subscription onto its items.
 */
export function periodEndIso(sub) {
  const unix = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/**
 * Extract the entitlement update from a webhook event. Returns null for events
 * we don't act on. For subscription.* we read the subscription object directly
 * (it always carries current truth, so out-of-order events stay consistent);
 * checkout.session.completed carries the user↔customer mapping.
 */
export function mapEventToUpdate(event) {
  const obj = event?.data?.object ?? {};
  switch (event?.type) {
    case "checkout.session.completed":
      return {
        kind: "checkout",
        userId: obj.client_reference_id || obj.metadata?.user_id || null,
        customerId: typeof obj.customer === "string" ? obj.customer : obj.customer?.id || null,
        email: obj.customer_details?.email || obj.customer_email || null,
      };
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return {
        kind: "subscription",
        userId: obj.metadata?.user_id || null,
        customerId: typeof obj.customer === "string" ? obj.customer : obj.customer?.id || null,
        status: event.type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(obj.status),
        current_period_end: periodEndIso(obj),
      };
    default:
      return null;
  }
}
