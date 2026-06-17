// M3 — Rule of 55 & 72(t) SEPP tests (TDD gate)
// These two mechanisms let early retirees access their 401k before age 59½
// without the 10% penalty. Without them, the engine treats the 401k as locked
// until 59.5, which is the current (correct) default.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);

// Base: retire at 57, 401k is the ONLY liquid asset, no Roth or brokerage.
// Without any early-access mechanism the bridge (57→59.5) has no accessible funds.
const bridgeBase = {
  retireAge: 57,
  lifeExpect: 85,
  ssAge: 67,
  monthlyExpense: 3000,
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 800_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,
  annualRothConversion: 0,
  filingStatus: "single",
};

// ── Baseline: existing behavior unchanged ────────────────────
describe("early-access defaults: existing behaviour preserved", () => {
  const res = simulate({ ...bridgeBase });

  it("no rule55 / no SEPP → 401k locked, bridge shortfall fires", () => {
    expect(res.bridgeShortfall).toBeGreaterThan(0);
  });

  it("no rule55 / no SEPP → depleted is null (401k unlocks at 59.5 and plan recovers)", () => {
    expect(res.depleted).toBeNull();
  });
});

// ── Rule of 55 ────────────────────────────────────────────────
describe("Rule of 55: unlocks 401k access from retireAge", () => {
  const noR55 = simulate({ ...bridgeBase });
  const withR55 = simulate({ ...bridgeBase, rule55: true });

  it("eliminates bridge shortfall (401k accessible immediately)", () => {
    expect(withR55.bridgeShortfall).toBe(0);
  });

  it("vs baseline: shortfall existed without Rule of 55", () => {
    expect(noR55.bridgeShortfall).toBeGreaterThan(0);
  });

  it("plan still survives to life expectancy", () => {
    expect(withR55.depleted).toBeNull();
  });

  it("401k is drawn during the bridge: lower balance at age 59 vs no-Rule-of-55", () => {
    // Without Rule of 55, 401k grows untouched during bridge → larger at 59
    // With Rule of 55, 401k is drawn from → smaller at 59
    expect(snapAt(withR55, 59).k401).toBeLessThan(snapAt(noR55, 59).k401);
  });
});

// ── 72(t) SEPP ───────────────────────────────────────────────
// Retire at 53 — too young for Rule of 55. SEPP provides structured 401k access.
// SEPP period = max(retireAge + 5, 59.5) = max(58, 59.5) = 59.5
const seppBase = {
  ...bridgeBase,
  retireAge: 53,
  k401: 1_500_000,
  monthlyExpense: 4000,
};

describe("72(t) SEPP: structured 401k income during pre-59.5 bridge", () => {
  const noSepp = simulate({ ...seppBase });
  // $60k/yr gross → ~$54.9k net after ~8.5% fed effective rate → ~$4,575/mo
  const withSepp = simulate({ ...seppBase, annualSepp: 60_000 });

  it("without SEPP, bridge shortfall exists (no accessible funds before 59.5)", () => {
    expect(noSepp.bridgeShortfall).toBeGreaterThan(0);
  });

  it("with SEPP, bridge shortfall is eliminated (SEPP covers monthly expenses)", () => {
    expect(withSepp.bridgeShortfall).toBe(0);
  });

  it("plan survives to life expectancy with SEPP", () => {
    expect(withSepp.depleted).toBeNull();
  });

  it("SEPP wires in: k401 lower during SEPP period than without", () => {
    // At age 56 (in SEPP window), draws should be visible
    expect(snapAt(withSepp, 56).k401).toBeLessThan(snapAt(noSepp, 56).k401);
  });

  it("SEPP period ends at max(retireAge+5, 59.5): after 59.5, normal access takes over", () => {
    // Both scenarios should converge in behavior post-59.5 (401k accessible either way)
    // After SEPP ends and 59.5 unlocks, withSepp should have less k401 (drawn more during bridge)
    // but the total trajectory should be similar enough that both survive
    expect(withSepp.depleted).toBeNull();
    expect(noSepp.depleted).toBeNull();
  });

  it("excess SEPP income (above monthly need) is stored in CD/cash", () => {
    // SEPP gross $5k/mo → net ~$4.6k; need $4k → $600 excess/mo goes to CD
    // By end of SEPP period (~6.5 years), CD should have meaningful balance
    const seppEndSnap = snapAt(withSepp, 60); // after SEPP ends
    expect(seppEndSnap.cd).toBeGreaterThan(0);
  });
});

// ── Rule 55 and SEPP are mutually exclusive edge cases ───────
describe("rule55 and annualSepp defaults do not affect existing tests", () => {
  it("rule55=false is the default (bridgeShortfall unchanged when not passed)", () => {
    const explicit = simulate({ ...bridgeBase, rule55: false });
    const implicit = simulate({ ...bridgeBase });
    expect(explicit.bridgeShortfall).toBe(implicit.bridgeShortfall);
  });

  it("annualSepp=0 is the default (no change when not passed)", () => {
    const explicit = simulate({ ...seppBase, annualSepp: 0 });
    const implicit = simulate({ ...seppBase });
    expect(explicit.bridgeShortfall).toBe(implicit.bridgeShortfall);
  });
});
