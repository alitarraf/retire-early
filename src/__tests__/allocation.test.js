// Asset allocation & risk glide path (Phase B).
// Unit-tests the pure allocation helpers + one integration through the plan
// pipeline confirming the opt-in gate is inert and that a moderate glide (with
// bonds) drags returns below the flat all-equity assumption.

import { describe, it, expect } from "vitest";
import {
  RISK_PROFILES,
  RISK_PROFILE_KEYS,
  GLIDE_START_AGE,
  GLIDE_END_AGE,
  equityShareAt,
  allocationAt,
  blendedReturn,
  blendedReturnAt,
  glideReturnSeries,
} from "../engine/allocation.js";
import { makePlan, projectTo, runAt, DEFAULTS } from "../analysis/plan.js";

const sum = (s) => s.equity + s.bond + s.cash;

describe("equityShareAt: glide", () => {
  it("clamps to startEquity at/below the start age and endEquity at/above the end age", () => {
    for (const k of RISK_PROFILE_KEYS) {
      expect(equityShareAt(GLIDE_START_AGE - 5, k)).toBeCloseTo(RISK_PROFILES[k].startEquity, 10);
      expect(equityShareAt(GLIDE_END_AGE + 5, k)).toBeCloseTo(RISK_PROFILES[k].endEquity, 10);
    }
  });

  it("decreases monotonically with age (de-risking)", () => {
    let prev = equityShareAt(GLIDE_START_AGE, "moderate");
    for (let age = GLIDE_START_AGE + 1; age <= GLIDE_END_AGE; age++) {
      const cur = equityShareAt(age, "moderate");
      expect(cur).toBeLessThanOrEqual(prev + 1e-12);
      prev = cur;
    }
  });

  it("aggressive holds more equity than moderate than conservative at every age", () => {
    for (let age = GLIDE_START_AGE; age <= GLIDE_END_AGE; age += 5) {
      expect(equityShareAt(age, "aggressive")).toBeGreaterThanOrEqual(equityShareAt(age, "moderate"));
      expect(equityShareAt(age, "moderate")).toBeGreaterThanOrEqual(equityShareAt(age, "conservative"));
    }
  });
});

describe("allocationAt: split", () => {
  it("returns fractions summing to 1 across the age range for every profile", () => {
    for (const k of RISK_PROFILE_KEYS) {
      for (let age = 25; age <= 90; age += 5) {
        const s = allocationAt({ riskProfile: k }, age);
        expect(sum(s)).toBeCloseTo(1, 10);
        expect(s.equity).toBeGreaterThanOrEqual(0);
        expect(s.bond).toBeGreaterThanOrEqual(0);
        expect(s.cash).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("custom/pinned mix ignores age and normalizes to sum 1", () => {
    const plan = { riskProfile: "custom", equityPct: 50, bondPct: 30, cashPct: 20 };
    const young = allocationAt(plan, 30);
    const old = allocationAt(plan, 80);
    expect(young).toEqual(old); // no glide
    expect(sum(young)).toBeCloseTo(1, 10);
    expect(young.equity).toBeCloseTo(0.5, 10);
  });

  it("pinAllocation forces a fixed mix even with a named profile", () => {
    const plan = { riskProfile: "aggressive", pinAllocation: true, equityPct: 40, bondPct: 40, cashPct: 20 };
    expect(allocationAt(plan, 30)).toEqual(allocationAt(plan, 70));
    expect(allocationAt(plan, 30).equity).toBeCloseTo(0.4, 10);
  });
});

describe("blendedReturn", () => {
  const returns = { stockReturn: 10, bondReturn: 4, cashDepositRate: 2 };

  it("weights each sleeve by its share", () => {
    expect(blendedReturn({ equity: 1, bond: 0, cash: 0 }, returns)).toBeCloseTo(10, 10);
    expect(blendedReturn({ equity: 0, bond: 1, cash: 0 }, returns)).toBeCloseTo(4, 10);
    expect(blendedReturn({ equity: 0.6, bond: 0.35, cash: 0.05 }, returns)).toBeCloseTo(
      0.6 * 10 + 0.35 * 4 + 0.05 * 2,
      10,
    );
  });

  it("blendedReturnAt is below the equity return whenever there are bonds/cash", () => {
    const plan = { riskProfile: "moderate", ...returns };
    expect(blendedReturnAt(plan, 70)).toBeLessThan(returns.stockReturn);
  });
});

describe("glideReturnSeries", () => {
  it("has the requested length and matches per-age blends", () => {
    const plan = { riskProfile: "moderate", stockReturn: 10, bondReturn: 4, cashDepositRate: 2 };
    const s = glideReturnSeries(plan, 60, 30);
    expect(s).toHaveLength(30);
    expect(s[0]).toBeCloseTo(blendedReturnAt(plan, 60), 10);
    expect(s[29]).toBeCloseTo(blendedReturnAt(plan, 89), 10);
  });
});

describe("integration through the plan pipeline", () => {
  it("allocationEnabled:false reproduces the flat-stockReturn portfolio exactly", () => {
    const raw = { ...DEFAULTS, currentAge: 45, retireAge: 60 };
    const off = projectTo(makePlan({ ...raw, allocationEnabled: false }), 15);
    const legacy = projectTo(makePlan(raw), 15); // default is false already
    expect(off.k401).toBe(legacy.k401);
    expect(off.rothContributions).toBe(legacy.rothContributions);
    expect(off.brokerage).toBe(legacy.brokerage);
  });

  it("a moderate glide accumulates less than the flat 10% equity assumption (bond drag)", () => {
    const raw = { ...DEFAULTS, currentAge: 45, retireAge: 60 };
    const flat = projectTo(makePlan({ ...raw, allocationEnabled: false }), 15);
    const glide = projectTo(makePlan({ ...raw, allocationEnabled: true, riskProfile: "moderate" }), 15);
    expect(glide.k401).toBeLessThan(flat.k401);
  });

  it("aggressive accumulates more than conservative", () => {
    const raw = { ...DEFAULTS, currentAge: 45, retireAge: 60, allocationEnabled: true };
    const aggr = projectTo(makePlan({ ...raw, riskProfile: "aggressive" }), 15);
    const cons = projectTo(makePlan({ ...raw, riskProfile: "conservative" }), 15);
    expect(aggr.k401).toBeGreaterThan(cons.k401);
  });

  it("drawdown respects the glide: a surviving aggressive portfolio ends richer than conservative, all else equal", () => {
    // Fat portfolio + low spend so neither depletes — then the equity-heavier
    // aggressive glide compounds to a larger ending balance.
    const raw = {
      ...DEFAULTS, currentAge: 60, retireAge: 60, lifeExpect: 90,
      alreadyRetired: true, allocationEnabled: true,
      monthlyExpense: 2000, existingBrokerage: 1_000_000, existingBrokerageBasis: 1_000_000,
    };
    const endTotal = (res) => res.snaps[res.snaps.length - 1].total;
    const aggr = runAt(makePlan({ ...raw, riskProfile: "aggressive" }), 60);
    const cons = runAt(makePlan({ ...raw, riskProfile: "conservative" }), 60);
    expect(endTotal(aggr)).toBeGreaterThan(endTotal(cons));
  });
});
