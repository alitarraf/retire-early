// M1 — Required Minimum Distributions (SECURE 2.0)
// Tests written before implementation (TDD gate).
// Spot-check the divisor table against IRS Pub 590-B before relying on it.

import { describe, it, expect } from "vitest";
import { rmdFactor } from "../engine/rmd.js";
import { simulate } from "../engine/simulate.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);

// ── rmdFactor unit tests ──────────────────────────────────────
describe("rmdFactor: IRS Uniform Lifetime Table", () => {
  it("returns 26.5 at age 73 (first RMD year, SECURE 2.0)", () => {
    expect(rmdFactor(73)).toBe(26.5);
  });

  it("returns 20.2 at age 80", () => {
    expect(rmdFactor(80)).toBe(20.2);
  });

  it("returns 12.2 at age 90", () => {
    expect(rmdFactor(90)).toBe(12.2);
  });

  it("returns Infinity (no RMD) below age 73", () => {
    expect(rmdFactor(72)).toBe(Infinity);
    expect(rmdFactor(60)).toBe(Infinity);
  });

  it("decreases monotonically age 73–100 (older = larger forced-out %)", () => {
    for (let age = 73; age < 100; age++) {
      expect(rmdFactor(age)).toBeGreaterThan(rmdFactor(age + 1));
    }
  });
});

// ── RMD integration in simulate() ────────────────────────────
// Scenario: retire at 70, SS=$4k/mo covers all $3k/mo spending,
// large 401k that would otherwise grow untouched. This isolates
// forced-RMD behavior from organic spending pressure on the 401k.
const base = {
  retireAge: 70,
  lifeExpect: 90,
  ssAge: 70,
  monthlyExpense: 3000,
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_000_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 4000, // > expense at all ages (both inflate at same rate)
  annualRothConversion: 0,
  filingStatus: "single",
};

describe("RMD integration: rmdAge=0 disables RMDs (backwards-compatible default)", () => {
  const res = simulate({ ...base }); // rmdAge defaults to 0

  it("401k grows freely past 73 with no rmdAge set", () => {
    const at73 = snapAt(res, 73);
    const at74 = snapAt(res, 74);
    expect(at74.k401).toBeGreaterThan(at73.k401);
  });

  it("brokerage stays at zero (SS covers all spending, no forced draw)", () => {
    expect(snapAt(res, 75).brokerage).toBe(0);
  });
});

describe("RMD integration: rmdAge=73 forces mandatory 401k draw", () => {
  const noRmd = simulate({ ...base, rmdAge: 0 });
  const withRmd = simulate({ ...base, rmdAge: 73 });

  it("k401 is identical before RMD age (age 72)", () => {
    // Both cases should track the same before 73
    expect(snapAt(withRmd, 72).k401).toBeCloseTo(snapAt(noRmd, 72).k401, 0);
  });

  it("k401 is lower after RMD fires (age 74)", () => {
    expect(snapAt(withRmd, 74).k401).toBeLessThan(snapAt(noRmd, 74).k401);
  });

  it("excess RMD flows to brokerage (SS covers spending, so full RMD is excess)", () => {
    expect(snapAt(withRmd, 74).brokerage).toBeGreaterThan(0);
    expect(snapAt(noRmd, 74).brokerage).toBe(0);
  });

  it("forced RMD amount is in the right order of magnitude (~$1M/26.5 ≈ $46k first year)", () => {
    // After 3 years at 7%, k ≈ $1.23M → first RMD ≈ $46k
    // After tax (~7% eff for single filer on ~$46k), brokerage gets ~$43k
    const bkAt74 = snapAt(withRmd, 74).brokerage;
    expect(bkAt74).toBeGreaterThan(30_000);
    expect(bkAt74).toBeLessThan(70_000);
  });

  it("plan still survives to life expectancy (RMD redistributes, not destroys)", () => {
    expect(withRmd.depleted).toBeNull();
  });

  it("total wealth with RMD is slightly less than without (tax drag on forced income)", () => {
    const totalNoRmd = noRmd.snaps[noRmd.snaps.length - 1].total;
    const totalWithRmd = withRmd.snaps[withRmd.snaps.length - 1].total;
    expect(totalWithRmd).toBeLessThan(totalNoRmd);        // some tax drag
    expect(totalWithRmd).toBeGreaterThan(totalNoRmd * 0.85); // but not catastrophic
  });
});

describe("RMD integration: rmdAge=75 delays start by 2 years vs rmdAge=73", () => {
  const rmd73 = simulate({ ...base, rmdAge: 73 });
  const rmd75 = simulate({ ...base, rmdAge: 75 });

  it("at age 74, rmdAge=75 has higher k401 (not yet forced)", () => {
    expect(snapAt(rmd75, 74).k401).toBeGreaterThan(snapAt(rmd73, 74).k401);
  });

  it("at age 76, rmdAge=75 has lower k401 than pre-RMD but rmdAge=73 is even lower", () => {
    // Both have fired by 76; 73 has had 3 years of forced draws vs 1 for 75
    expect(snapAt(rmd73, 76).k401).toBeLessThan(snapAt(rmd75, 76).k401);
  });

  it("at age 76, rmdAge=75 brokerage starts catching up", () => {
    expect(snapAt(rmd75, 76).brokerage).toBeGreaterThan(0);
  });
});
