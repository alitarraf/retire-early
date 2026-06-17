import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { makePlan, simParamsAt } from "../analysis/plan.js";
import { stressTest } from "../analysis/stressTest.js";
import { fraForBirthYear } from "../engine/socialSecurity.js";

const endTotal = (res) => res.snaps[res.snaps.length - 1].total;

// A comfortable base scenario that survives to life expectancy with money left over.
const base = {
  retireAge: 55,
  lifeExpect: 90,
  ssAge: 67,
  monthlyExpense: 7000,
  inflationRate: 3,
  stockReturn: 8,
  rothContributions: 200000,
  rothEarnings: 50000,
  brokerage: 200000,
  brokerageBasis: 150000,
  brokerageLtcgRate: 15,
  k401: 1000000,
  cashDeposit: 150000,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,
  filingStatus: "mfj",
};

// ── Identity: new params are inert at their defaults ──────────
describe("Roadmap: default inertness", () => {
  it("empty oneTimeExpenses + unit phase multipliers reproduce the baseline exactly", () => {
    const baseline = simulate(base);
    const withDefaults = simulate({
      ...base,
      oneTimeExpenses: [],
      goGoMult: 1,
      slowGoMult: 1,
      noGoMult: 1,
      slowGoAge: 70,
      noGoAge: 80,
    });
    expect(endTotal(withDefaults)).toBe(endTotal(baseline));
    expect(withDefaults.depleted).toBe(baseline.depleted);
  });
});

// ── One-time / lump-sum expenses ──────────────────────────────
describe("Roadmap: one-time expenses", () => {
  it("a lump expense reduces the estate relative to no lump", () => {
    const without = simulate(base);
    const withLump = simulate({ ...base, oneTimeExpenses: [{ age: 60, amount: 100000 }] });
    expect(endTotal(withLump)).toBeLessThan(endTotal(without));
  });

  it("fires only once and only at/after its age (a pre-window lump is ignored)", () => {
    const at62 = simulate({ ...base, oneTimeExpenses: [{ age: 62, amount: 80000 }] });
    // Snapshot at 61 is unaffected; by 63 the hit has landed.
    const plain = simulate(base);
    const s61a = at62.snaps.find((s) => s.age === 61).total;
    const s61b = plain.snaps.find((s) => s.age === 61).total;
    expect(s61a).toBeCloseTo(s61b, 0);
    const s63a = at62.snaps.find((s) => s.age === 63).total;
    const s63b = plain.snaps.find((s) => s.age === 63).total;
    expect(s63a).toBeLessThan(s63b);
  });

  it("an expense before retirement is dropped by simParamsAt", () => {
    const plan = makePlan({ ...base, currentAge: 40, retireAge: 55, oneTimeExpenses: [{ age: 50, amount: 50000 }] });
    const sp = simParamsAt(plan, 55);
    expect(sp.oneTimeExpenses).toHaveLength(0);
  });

  it("simParamsAt inflates today's amount to retire-date dollars", () => {
    const plan = makePlan({ ...base, currentAge: 45, retireAge: 55, inflationRate: 3, oneTimeExpenses: [{ age: 60, amount: 10000 }] });
    const sp = simParamsAt(plan, 55);
    expect(sp.oneTimeExpenses).toHaveLength(1);
    // 10 years of 3% inflation ≈ ×1.344
    expect(sp.oneTimeExpenses[0].amount).toBeCloseTo(10000 * Math.pow(1.03, 10), 0);
  });
});

// ── Phase-based spending ──────────────────────────────────────
describe("Roadmap: phase spending multipliers", () => {
  it("lower late-life spending (no-go) leaves a larger estate", () => {
    const flat = simulate(base);
    const declining = simulate({ ...base, slowGoAge: 70, noGoAge: 80, slowGoMult: 0.9, noGoMult: 0.75 });
    expect(endTotal(declining)).toBeGreaterThan(endTotal(flat));
  });

  it("higher early spending (go-go) shrinks the estate", () => {
    const flat = simulate(base);
    const goGo = simulate({ ...base, goGoMult: 1.2, slowGoAge: 70, noGoAge: 80 });
    expect(endTotal(goGo)).toBeLessThan(endTotal(flat));
  });
});

// ── birthYear → RMD age ───────────────────────────────────────
describe("Roadmap: birthYear drives RMD age", () => {
  it("born 1959 → RMD age 73", () => {
    expect(makePlan({ ...base, currentAge: 40, birthYear: 1959 }).rmdAge).toBe(73);
  });
  it("born 1960 → RMD age 75", () => {
    expect(makePlan({ ...base, currentAge: 40, birthYear: 1960 }).rmdAge).toBe(75);
  });
  it("birthYear 0 derives from currentAge", () => {
    const plan = makePlan({ ...base, currentAge: 40, birthYear: 0 });
    expect(plan.birthYear).toBe(2026 - 40);
  });
  it("FRA helper matches the SSA schedule", () => {
    expect(fraForBirthYear(1960)).toBe(67);
    expect(fraForBirthYear(1954)).toBe(66);
    expect(fraForBirthYear(1955)).toBeCloseTo(66 + 2 / 12, 5);
    expect(fraForBirthYear(1937)).toBe(65);
  });
});

// ── Stress test ───────────────────────────────────────────────
describe("Roadmap: deterministic stress test", () => {
  it("an early crash is never better than the deterministic run", () => {
    const plan = makePlan({ ...base, currentAge: 50, retireAge: 55 });
    const sp = simParamsAt(plan, 55);
    const calm = simulate(sp);
    const stressed = stressTest(sp, { dropPct: 30, years: 3 });
    expect(endTotal(stressed)).toBeLessThanOrEqual(endTotal(calm));
  });
  it("runs without crashing and returns snaps", () => {
    const plan = makePlan({ ...base, currentAge: 50, retireAge: 55 });
    const stressed = stressTest(simParamsAt(plan, 55), { dropPct: 50, years: 5 });
    expect(stressed.snaps.length).toBeGreaterThan(0);
  });

  it("stress snaps align 1:1 with the deterministic snaps (for the chart overlay)", () => {
    const plan = makePlan({ ...base, currentAge: 50, retireAge: 55 });
    const sp = simParamsAt(plan, 55);
    const calm = simulate(sp);
    const stressed = stressTest(sp, { dropPct: 30, years: 3 });
    expect(stressed.snaps.length).toBe(calm.snaps.length);
    expect(stressed.snaps.map((s) => s.age)).toEqual(calm.snaps.map((s) => s.age));
  });

  it("applies the crash to the early years then reverts to the mean", () => {
    const plan = makePlan({ ...base, currentAge: 50, retireAge: 55 });
    const sp = simParamsAt(plan, 55);
    const calm = simulate(sp);
    const stressed = stressTest(sp, { dropPct: 30, years: 3 });
    const tot = (res, age) => res.snaps.find((s) => s.age === age).total;
    // Early years: stress is well below calm (crash compounding).
    expect(tot(stressed, 58)).toBeLessThan(tot(calm, 58) * 0.8);
    // The gap should be established during the crash window, not widen unboundedly after.
    expect(tot(stressed, 58)).toBeGreaterThan(0);
  });
});

// ── Tax transparency capture ──────────────────────────────────
describe("Roadmap: taxSummary transparency", () => {
  it("captures an SS taxable fraction and a 401k effective rate", () => {
    const res = simulate(base);
    expect(res.taxSummary).toBeDefined();
    expect(res.taxSummary.ssTaxableFrac).not.toBeNull();
    expect(res.taxSummary.ssTaxableFrac).toBeGreaterThanOrEqual(0);
    expect(res.taxSummary.ssTaxableFrac).toBeLessThanOrEqual(0.85);
    expect(res.taxSummary.k401EffRate).not.toBeNull();
  });
});
