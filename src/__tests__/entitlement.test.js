// Entitlement core (PRD §10.7) — pure metering rules, no DB.
import { describe, it, expect } from "vitest";
import {
  WINDOW_MS,
  LIMITS,
  tierLimit,
  isActiveSubscription,
  rolloverWindow,
  decide,
  isNewUserTurn,
} from "../../api/_lib/entitlement.js";

const iso = (ms) => new Date(ms).toISOString();
const NOW = Date.UTC(2026, 5, 19, 12, 0, 0);

describe("tierLimit", () => {
  it("anon=3, free=5, anything else unlimited", () => {
    expect(tierLimit("anon")).toBe(3);
    expect(tierLimit("free")).toBe(5);
    expect(tierLimit("pro")).toBe(Infinity);
    expect(tierLimit(undefined)).toBe(Infinity);
    expect(LIMITS).toEqual({ anon: 3, free: 5 });
  });
});

describe("isActiveSubscription", () => {
  it("active with a future period end → true", () => {
    expect(isActiveSubscription({ status: "active", current_period_end: iso(NOW + 1000) }, NOW)).toBe(true);
  });
  it("active but period ended → false (lapsed reverts to free)", () => {
    expect(isActiveSubscription({ status: "active", current_period_end: iso(NOW - 1000) }, NOW)).toBe(false);
  });
  it("non-active status → false", () => {
    expect(isActiveSubscription({ status: "canceled", current_period_end: iso(NOW + 1000) }, NOW)).toBe(false);
    expect(isActiveSubscription({ status: "past_due" }, NOW)).toBe(false);
  });
  it("null/empty → false", () => {
    expect(isActiveSubscription(null, NOW)).toBe(false);
  });
});

describe("rolloverWindow", () => {
  it("resets count when the window is older than 24h", () => {
    const row = { count: 5, window_start: iso(NOW - WINDOW_MS - 1) };
    const out = rolloverWindow(row, NOW);
    expect(out.count).toBe(0);
    expect(new Date(out.window_start).getTime()).toBe(NOW);
  });
  it("keeps the row inside the window (clock advanced mid-window doesn't reset)", () => {
    const row = { count: 2, window_start: iso(NOW - 1000) };
    expect(rolloverWindow(row, NOW)).toBe(row);
  });
  it("a turn at hour 25 starts a fresh window", () => {
    const row = { count: 3, window_start: iso(NOW) };
    const out = rolloverWindow(row, NOW + 25 * 60 * 60 * 1000);
    expect(out.count).toBe(0);
  });
  it("null row → a fresh zeroed window", () => {
    expect(rolloverWindow(null, NOW)).toEqual({ count: 0, window_start: iso(NOW) });
  });
});

describe("decide", () => {
  it("anonymous: allows the first 3, blocks the 4th", () => {
    let row = null;
    for (let i = 0; i < 3; i++) {
      const d = decide({ row, tier: "anon", now: NOW });
      expect(d.allowed).toBe(true);
      row = d.nextRow; // persisted on success
    }
    const fourth = decide({ row, tier: "anon", now: NOW });
    expect(fourth.allowed).toBe(false);
    expect(fourth.nextRow.count).toBe(3); // blocked turn does not increment
    expect(fourth.remaining).toBe(0);
  });

  it("signed-in-free: allows 5, blocks the 6th", () => {
    let row = null;
    for (let i = 0; i < 5; i++) {
      const d = decide({ row, tier: "free", now: NOW });
      expect(d.allowed).toBe(true);
      row = d.nextRow;
    }
    expect(decide({ row, tier: "free", now: NOW }).allowed).toBe(false);
  });

  it("remaining counts down correctly", () => {
    expect(decide({ row: null, tier: "anon", now: NOW }).remaining).toBe(2); // 3 - 1
    expect(decide({ row: { count: 1, window_start: iso(NOW) }, tier: "free", now: NOW }).remaining).toBe(3); // 5 - 2
  });

  it("a fresh window after 24h allows again", () => {
    const exhausted = { count: 3, tier: "anon", window_start: iso(NOW - WINDOW_MS - 1) };
    const d = decide({ row: exhausted, tier: "anon", now: NOW });
    expect(d.allowed).toBe(true);
    expect(d.nextRow.count).toBe(1);
  });

  it("unlimited tiers never block", () => {
    const d = decide({ row: { count: 999, window_start: iso(NOW) }, tier: "pro", now: NOW });
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(Infinity);
  });
});

describe("isNewUserTurn", () => {
  it("plain user text is a new turn", () => {
    expect(isNewUserTurn([{ role: "user", content: "Can I retire at 57?" }])).toBe(true);
  });
  it("a tool_result continuation is NOT a new turn", () => {
    const messages = [
      { role: "user", content: "Can I retire at 57?" },
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "run_scenario", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] },
    ];
    expect(isNewUserTurn(messages)).toBe(false);
  });
  it("empty/missing messages default to a new turn", () => {
    expect(isNewUserTurn([])).toBe(true);
    expect(isNewUserTurn(undefined)).toBe(true);
  });
});
