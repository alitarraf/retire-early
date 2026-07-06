// Dynamic multi-year Roth conversion optimizer + engine bracket-fill mode.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { makePlan } from "../analysis/plan.js";
import { dynamicOptimizer } from "../analysis/dynamicOptimizer.js";
import { STD_DEDUCTION } from "../constants/brackets.js";

// Bridge scenario: retire 55, large 401k, ample cash to pay conversion tax, low spending so the
// bridge years have little ordinary income → bracket-fill has room to work.
const engineBase = {
  retireAge: 55,
  lifeExpect: 90,
  ssAge: 67,
  monthlyExpense: 4000,
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 150000,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_500_000,
  cashDeposit: 300000, // funds the conversion tax
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,
  filingStatus: "single",
};

// ── Engine: bracket-fill conversion mode ──────────────────────
describe("simulate: bracket-fill conversion mode", () => {
  it("conversionCeiling=0 keeps the fixed-amount behavior (identity)", () => {
    const fixed = simulate({ ...engineBase, annualRothConversion: 20000 });
    const explicitOff = simulate({ ...engineBase, annualRothConversion: 20000, conversionCeiling: 0, conversionEndAge: 59.5 });
    expect(explicitOff.snaps.at(-1).total).toBe(fixed.snaps.at(-1).total);
  });

  it("fills the first bridge year to ≈ ceiling + standard deduction (no other income)", () => {
    const ceiling = 50400; // top of the single 12% band
    const res = simulate({ ...engineBase, conversionCeiling: ceiling });
    expect(res.conversions.length).toBeGreaterThan(0);
    // First bridge year has no SS and no 401k draw → drawBase ≈ 0 → conv ≈ ceiling + std deduction.
    expect(res.conversions[0].amount).toBeCloseTo(ceiling + STD_DEDUCTION.single, -2);
  });

  it("conversionEndAge extends conversions past 59½ (RMD-prep years)", () => {
    const bridgeOnly = simulate({ ...engineBase, conversionCeiling: 50400, conversionEndAge: 59.5 });
    const throughAge70 = simulate({ ...engineBase, conversionCeiling: 50400, conversionEndAge: 70 });
    const maxAge = (res) => Math.max(...res.conversions.map((c) => c.age));
    expect(maxAge(throughAge70)).toBeGreaterThan(maxAge(bridgeOnly));
  });

  it("affordability cap: with no liquid funds, conversions are scaled toward zero (no free tax)", () => {
    // No cash, no brokerage → the conversion tax cannot be funded → conversions must be ~0.
    const broke = simulate({ ...engineBase, cashDeposit: 0, brokerage: 0, conversionCeiling: 211100 /* 22% top */ });
    const converted = broke.conversions.reduce((s, c) => s + c.amount, 0);
    expect(converted).toBeLessThan(1000); // effectively nothing convertible
  });
});

// ── Optimizer ─────────────────────────────────────────────────
// NOTE: makePlan takes UI-shaped inputs (k401Today, rothTotal, …), not simulate field names.
const mkPlan = (over = {}) =>
  makePlan({
    currentAge: 50,
    retireAge: 55,
    lifeExpect: 90,
    ssAge: 67,
    monthlyExpense: 4000,
    inflationRate: 3,
    stockReturn: 7,
    k401Today: 1_500_000,
    k401AnnualContrib: 0,
    employerMatchPct: 0,
    salary: 0,
    rothTotal: 150000,
    rothAnnualContrib: 0,
    rothYearsContrib: 0,
    cashDeposit: 300000,
    muniBonds: 0,
    existingBrokerage: 0,
    existingBrokerageBasis: 0,
    hsaBalance: 0,
    hsaAnnualContrib: 0,
    ssBenefit: 2000,
    filingStatus: "single",
    stateKey: "No state tax",
    stateTaxEnabled: false,
    ...over,
  });

describe("dynamicOptimizer", () => {
  it("recommends a bracket-fill that improves the estate in a realistic scenario", () => {
    const opt = dynamicOptimizer(mkPlan());
    expect(opt.type).toBe("fill");
    expect(opt.gain).toBeGreaterThan(0);
    expect(opt.estateWith).toBeGreaterThan(opt.estateBase);
    expect(opt.schedule.length).toBeGreaterThan(0);
    expect(opt.ceiling).toBeGreaterThan(0);
  });

  it("reports a future RMD reduction (conversions shrink the 401k before RMDs)", () => {
    const opt = dynamicOptimizer(mkPlan());
    expect(opt.rmdReduction).toBeGreaterThan(0);
  });

  it("ARTIFACT GUARD: with no funds to pay conversion tax, does not claim a huge gain", () => {
    // Large 401k but zero cash/brokerage → conversions are unaffordable. The old cd-capped engine
    // would let bracket-fill convert tax-free and report a fake gain; the affordability cap prevents it.
    const opt = dynamicOptimizer(mkPlan({ cashDeposit: 0, rothTotal: 600000 }));
    expect(opt.estateBase).toBeGreaterThan(0);
    // Any claimed gain must be modest — never an order-of-magnitude fiction.
    expect(opt.gain).toBeLessThan(opt.estateBase * 0.25);
  });

  it("respects the optimization window end age", () => {
    const opt = dynamicOptimizer(mkPlan(), { windowEnd: 65 });
    expect(opt.endAge).toBe(65);
    if (opt.schedule.length) {
      expect(Math.max(...opt.schedule.map((c) => c.age))).toBeLessThan(65);
    }
  });
});

// Phase 2 — the optimizer inherits the new engine features through runAt.
describe("dynamicOptimizer under income-tested Medicare", () => {
  it("returns a coherent recommendation with autoMedicare on (IRMAA priced in)", () => {
    const plan = makePlan({ autoMedicare: true, k401Today: 800_000, retireAge: 60 });
    const rec = dynamicOptimizer(plan);
    // Whatever it recommends must not lose estate vs doing nothing.
    expect(rec.estateWith).toBeGreaterThanOrEqual(rec.estateBase - 1);
  });
});
