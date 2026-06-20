// Entitlement gate (PRD §10.3, §10.7) — allow/deny over a fake Supabase.
import { describe, it, expect } from "vitest";
import { checkEntitlement, peekEntitlement, DEVICE_COOKIE } from "../../api/_lib/gate.js";

const iso = (ms) => new Date(ms).toISOString();

// Minimal case-insensitive header bag + request.
function req({ cookie, authorization } = {}) {
  const map = {};
  if (cookie) map.cookie = cookie;
  if (authorization) map.authorization = authorization;
  return { headers: { get: (k) => map[k.toLowerCase()] ?? null } };
}

const NEW_TURN = [{ role: "user", content: "Can I retire at 57?" }];
const CONTINUATION = [
  { role: "user", content: "hi" },
  { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "run_scenario", input: {} }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] },
];

// Fake Supabase: chainable .from().select().eq().maybeSingle()/upsert() + auth.getUser.
function fakeSb({ usage = {}, subscriptions = {}, users = {} } = {}) {
  const store = { usage: { ...usage }, subscriptions: { ...subscriptions } };
  const upserts = [];
  return {
    _store: store,
    _upserts: upserts,
    auth: {
      getUser: async (token) =>
        users[token]
          ? { data: { user: users[token] }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
    },
    from(table) {
      return {
        select() {
          return this;
        },
        eq(_col, val) {
          this._val = val;
          return this;
        },
        async maybeSingle() {
          return { data: store[table][this._val] ?? null, error: null };
        },
        async upsert(obj) {
          const keyCol = table === "usage" ? "key" : "user_id";
          store[table][obj[keyCol]] = { ...store[table][obj[keyCol]], ...obj };
          upserts.push({ table, obj });
          return { data: obj, error: null };
        },
      };
    },
  };
}

describe("checkEntitlement", () => {
  it("passes straight through when Supabase isn't configured (dev/CI)", async () => {
    expect(await checkEntitlement(req(), NEW_TURN, null)).toEqual({ allow: true });
  });

  it("does NOT meter a tool-result continuation", async () => {
    const sb = fakeSb({ usage: { dev: { tier: "anon", count: 3, window_start: iso(Date.now()) } } });
    const res = await checkEntitlement(req({ cookie: `${DEVICE_COOKIE}=dev` }), CONTINUATION, sb);
    expect(res.allow).toBe(true);
    expect(res.commit).toBeUndefined();
  });

  it("anonymous first turn: allows, issues a device cookie, counts down", async () => {
    const sb = fakeSb();
    const res = await checkEntitlement(req(), NEW_TURN, sb);
    expect(res.allow).toBe(true);
    expect(res.tier).toBe("anon");
    expect(res.remaining).toBe(2);
    expect(res.setCookie).toMatch(new RegExp(`^${DEVICE_COOKIE}=`));
    expect(res.setCookie).toMatch(/HttpOnly/);
    // Not yet persisted — commit happens only after a successful upstream turn.
    expect(sb._upserts).toHaveLength(0);
    await res.commit();
    expect(sb._upserts).toHaveLength(1);
    expect(sb._store.usage[/* the new device id */ Object.keys(sb._store.usage)[0]].count).toBe(1);
  });

  it("anonymous 4th turn in the window → 401 signup_required", async () => {
    const sb = fakeSb({ usage: { dev: { tier: "anon", count: 3, window_start: iso(Date.now()) } } });
    const res = await checkEntitlement(req({ cookie: `${DEVICE_COOKIE}=dev` }), NEW_TURN, sb);
    expect(res.allow).toBe(false);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "signup_required", tier: "anon" });
  });

  it("signed-in-free 6th turn → 402 quota_exhausted", async () => {
    const user = { id: "u1", email: "a@b.com" };
    const sb = fakeSb({
      users: { tok: user },
      usage: { u1: { tier: "free", count: 5, window_start: iso(Date.now()) } },
    });
    const res = await checkEntitlement(req({ authorization: "Bearer tok" }), NEW_TURN, sb);
    expect(res.allow).toBe(false);
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ error: "quota_exhausted", tier: "free" });
  });

  it("signed-in-free under the limit is keyed on user.id, not a cookie", async () => {
    const user = { id: "u1" };
    const sb = fakeSb({ users: { tok: user } });
    const res = await checkEntitlement(req({ authorization: "Bearer tok" }), NEW_TURN, sb);
    expect(res.allow).toBe(true);
    expect(res.tier).toBe("free");
    await res.commit();
    expect(sb._store.usage.u1.count).toBe(1);
  });

  it("active subscriber bypasses metering entirely", async () => {
    const user = { id: "pro1" };
    const sb = fakeSb({
      users: { tok: user },
      subscriptions: { pro1: { status: "active", current_period_end: iso(Date.now() + 1e6) } },
      usage: { pro1: { tier: "free", count: 5, window_start: iso(Date.now()) } },
    });
    const res = await checkEntitlement(req({ authorization: "Bearer tok" }), NEW_TURN, sb);
    expect(res).toEqual({ allow: true });
  });

  it("a lapsed subscriber falls back to free metering", async () => {
    const user = { id: "ex1" };
    const sb = fakeSb({
      users: { tok: user },
      subscriptions: { ex1: { status: "active", current_period_end: iso(Date.now() - 1e6) } },
    });
    const res = await checkEntitlement(req({ authorization: "Bearer tok" }), NEW_TURN, sb);
    expect(res.allow).toBe(true);
    expect(res.tier).toBe("free");
  });
});

describe("peekEntitlement (read-only, never meters)", () => {
  it("unconfigured → not configured", async () => {
    expect(await peekEntitlement(req(), null)).toMatchObject({ configured: false, tier: "anon" });
  });

  it("anonymous with usage → remaining counts down, nothing written", async () => {
    const sb = fakeSb({ usage: { dev: { tier: "anon", count: 1, window_start: iso(Date.now()) } } });
    const out = await peekEntitlement(req({ cookie: `${DEVICE_COOKIE}=dev` }), sb);
    expect(out).toMatchObject({ configured: true, tier: "anon", remaining: 2, limit: 3 });
    expect(sb._upserts).toHaveLength(0);
  });

  it("anonymous with no cookie → full allowance", async () => {
    const sb = fakeSb();
    expect(await peekEntitlement(req(), sb)).toMatchObject({ tier: "anon", remaining: 3 });
  });

  it("active subscriber → pro, unlimited", async () => {
    const sb = fakeSb({
      users: { tok: { id: "p1", email: "a@b.com" } },
      subscriptions: { p1: { status: "active", current_period_end: iso(Date.now() + 1e6) } },
    });
    expect(await peekEntitlement(req({ authorization: "Bearer tok" }), sb)).toMatchObject({
      tier: "pro",
      active: true,
      remaining: null,
      email: "a@b.com",
    });
  });

  it("signed-in-free → 5/day remaining on user.id", async () => {
    const sb = fakeSb({
      users: { tok: { id: "u1" } },
      usage: { u1: { tier: "free", count: 2, window_start: iso(Date.now()) } },
    });
    expect(await peekEntitlement(req({ authorization: "Bearer tok" }), sb)).toMatchObject({ tier: "free", remaining: 3, limit: 5 });
  });
});
