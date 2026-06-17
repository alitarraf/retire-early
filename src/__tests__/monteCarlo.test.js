// M4 — Monte Carlo / sequence-of-returns risk tests (TDD gate)
// Two new capabilities:
//   1. simulate() accepts an optional `returnSeries` (per-year returns array)
//      so any caller can inject a specific return sequence.
//   2. monteCarlo() wraps simulate() in N stochastic runs and returns
//      { successRate, medianEndTotal, depletionAges }.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { monteCarlo } from "../engine/monteCarlo.js";

// Shared base for deterministic returnSeries tests.
const base = {
  retireAge: 60,
  lifeExpect: 90,
  ssAge: 70,
  monthlyExpense: 4000,
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_500_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,
  annualRothConversion: 0,
  filingStatus: "single",
};

// ── returnSeries in simulate() ───────────────────────────────
describe("simulate(): returnSeries param injects per-year returns", () => {
  it("flat 7% series produces the same result as constant stockReturn=7", () => {
    const years = base.lifeExpect - base.retireAge; // 30
    const flatSeries = Array(years).fill(7);
    const fromSeries = simulate({ ...base, returnSeries: flatSeries });
    const fromFlat = simulate({ ...base });
    // Should be essentially identical (floating-point rounding only).
    const diff = Math.abs(fromSeries.snaps.at(-1).total - fromFlat.snaps.at(-1).total);
    expect(diff).toBeLessThan(10); // < $10 rounding difference
  });

  it("front-loaded crash leaves significantly less wealth than flat returns", () => {
    const years = base.lifeExpect - base.retireAge;
    const crashSeq = [-30, -20, ...Array(years - 2).fill(7)];
    const afterCrash = simulate({ ...base, returnSeries: crashSeq });
    const steady = simulate({ ...base });
    // Sequence-of-returns risk: early loss is never fully recovered.
    expect(afterCrash.snaps.at(-1).total).toBeLessThan(steady.snaps.at(-1).total * 0.7);
  });

  it("crash in final years matters far less than crash in early years", () => {
    const years = base.lifeExpect - base.retireAge;
    const earlyBad = [-30, -20, ...Array(years - 2).fill(7)];
    const lateBad = [...Array(years - 2).fill(7), -30, -20];
    const earlyLoss = simulate({ ...base, returnSeries: earlyBad }).snaps.at(-1).total;
    const lateLoss = simulate({ ...base, returnSeries: lateBad }).snaps.at(-1).total;
    // A crash when the portfolio is mostly spent has much less impact.
    expect(lateLoss).toBeGreaterThan(earlyLoss);
  });
});

// ── monteCarlo() ─────────────────────────────────────────────
describe("monteCarlo(): result shape", () => {
  const result = monteCarlo({ ...base }, { n: 50, seed: 42 });

  it("returns successRate between 0 and 1", () => {
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
  });

  it("returns depletionAges array of length n", () => {
    expect(result.depletionAges).toHaveLength(50);
  });

  it("returns a positive medianEndTotal", () => {
    expect(result.medianEndTotal).toBeGreaterThan(0);
  });
});

describe("monteCarlo(): success rate responds to plan quality", () => {
  // Well-funded: $10M, $2k/month — barely any sequence can cause depletion.
  const wealthy = { ...base, k401: 10_000_000, monthlyExpense: 2000, ssBenefit: 3000 };
  // Destitute: $50k, $8k/month — depletes in < 1 year almost always.
  const destitute = { ...base, k401: 50_000, monthlyExpense: 8000, ssBenefit: 0 };

  it("well-funded plan achieves near-perfect success rate", () => {
    const { successRate } = monteCarlo(wealthy, { n: 100, seed: 1 });
    expect(successRate).toBeGreaterThan(0.90);
  });

  it("destitute plan fails nearly every run", () => {
    const { successRate } = monteCarlo(destitute, { n: 100, seed: 1 });
    expect(successRate).toBeLessThan(0.10);
  });
});

describe("monteCarlo(): determinism with seed", () => {
  it("same seed produces identical successRate across runs", () => {
    const opts = { n: 100, seed: 999 };
    const run1 = monteCarlo({ ...base }, opts);
    const run2 = monteCarlo({ ...base }, opts);
    expect(run1.successRate).toBe(run2.successRate);
    expect(run1.medianEndTotal).toBe(run2.medianEndTotal);
  });

  it("different seeds produce different results", () => {
    const r1 = monteCarlo({ ...base }, { n: 100, seed: 1 });
    const r2 = monteCarlo({ ...base }, { n: 100, seed: 2 });
    // medianEndTotal is a continuous value — essentially impossible to match across seeds.
    expect(r1.medianEndTotal).not.toBe(r2.medianEndTotal);
  });
});
