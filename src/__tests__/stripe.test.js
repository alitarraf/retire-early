// Stripe mappers + webhook entitlement write (PRD §10.4, §10.7).
import { describe, it, expect } from "vitest";
import { mapStripeStatus, periodEndIso, mapEventToUpdate } from "../../api/_lib/stripe.js";
import { applyEntitlementUpdate } from "../../api/_lib/gate.js";

describe("mapStripeStatus", () => {
  it("collapses Stripe statuses to entitlement statuses", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("active");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeStatus("paused")).toBe("canceled");
  });
});

describe("periodEndIso", () => {
  const unix = 1_780_000_000;
  it("reads the subscription field", () => {
    expect(periodEndIso({ current_period_end: unix })).toBe(new Date(unix * 1000).toISOString());
  });
  it("falls back to the item field (API moved it)", () => {
    expect(periodEndIso({ items: { data: [{ current_period_end: unix }] } })).toBe(
      new Date(unix * 1000).toISOString(),
    );
  });
  it("null when absent", () => {
    expect(periodEndIso({})).toBeNull();
  });
});

describe("mapEventToUpdate", () => {
  it("checkout.session.completed → mapping", () => {
    const upd = mapEventToUpdate({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "u1", customer: "cus_1", customer_details: { email: "a@b.com" } } },
    });
    expect(upd).toEqual({ kind: "checkout", userId: "u1", customerId: "cus_1", email: "a@b.com" });
  });

  it("customer.subscription.updated → status + period from the object", () => {
    const unix = 1_780_000_000;
    const upd = mapEventToUpdate({
      type: "customer.subscription.updated",
      data: { object: { metadata: { user_id: "u1" }, customer: "cus_1", status: "active", current_period_end: unix } },
    });
    expect(upd).toMatchObject({ kind: "subscription", userId: "u1", customerId: "cus_1", status: "active" });
    expect(upd.current_period_end).toBe(new Date(unix * 1000).toISOString());
  });

  it("customer.subscription.deleted → canceled", () => {
    const upd = mapEventToUpdate({
      type: "customer.subscription.deleted",
      data: { object: { metadata: { user_id: "u1" }, customer: "cus_1", status: "canceled" } },
    });
    expect(upd.status).toBe("canceled");
  });

  it("unhandled event → null", () => {
    expect(mapEventToUpdate({ type: "invoice.created", data: { object: {} } })).toBeNull();
  });
});

// Fake subscriptions table: upsert by user_id, update by stripe_customer_id.
// Strips undefined like supabase-js (JSON) so it doesn't clobber columns.
function fakeSb() {
  const subs = {};
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  return {
    _subs: subs,
    from() {
      return {
        _patch: null,
        update(patch) {
          this._patch = clean(patch);
          return this;
        },
        eq(_col, val) {
          if (this._patch) {
            for (const k of Object.keys(subs)) {
              if (subs[k].stripe_customer_id === val) subs[k] = { ...subs[k], ...this._patch };
            }
            this._patch = null;
          }
          return this;
        },
        async upsert(obj) {
          const c = clean(obj);
          subs[c.user_id] = { ...subs[c.user_id], ...c };
          return { data: c, error: null };
        },
      };
    },
  };
}

describe("applyEntitlementUpdate", () => {
  it("checkout writes the user↔customer mapping and marks active", async () => {
    const sb = fakeSb();
    await applyEntitlementUpdate(sb, { kind: "checkout", userId: "u1", customerId: "cus_1", email: "a@b.com" });
    expect(sb._subs.u1).toMatchObject({ user_id: "u1", stripe_customer_id: "cus_1", status: "active", email: "a@b.com" });
  });

  it("subscription update sets status + period (idempotent on replay)", async () => {
    const sb = fakeSb();
    const upd = { kind: "subscription", userId: "u1", customerId: "cus_1", status: "active", current_period_end: "2026-07-01T00:00:00.000Z" };
    await applyEntitlementUpdate(sb, upd);
    await applyEntitlementUpdate(sb, upd); // replay
    expect(sb._subs.u1).toMatchObject({ status: "active", current_period_end: "2026-07-01T00:00:00.000Z" });
  });

  it("a later cancel overrides an earlier active (subscription object is truth)", async () => {
    const sb = fakeSb();
    await applyEntitlementUpdate(sb, { kind: "checkout", userId: "u1", customerId: "cus_1" });
    await applyEntitlementUpdate(sb, { kind: "subscription", userId: "u1", customerId: "cus_1", status: "canceled", current_period_end: null });
    expect(sb._subs.u1.status).toBe("canceled");
  });

  it("subscription event without user_id falls back to updating by customer id", async () => {
    const sb = fakeSb();
    sb._subs.u1 = { user_id: "u1", stripe_customer_id: "cus_1", status: "active" };
    await applyEntitlementUpdate(sb, { kind: "subscription", userId: null, customerId: "cus_1", status: "past_due", current_period_end: null });
    expect(sb._subs.u1.status).toBe("past_due");
  });
});
