// M4 — Monte Carlo / sequence-of-returns risk tests (TDD gate)
// Two new capabilities:
//   1. simulate() accepts an optional `returnSeries` (per-year returns array)
//      so any caller can inject a specific return sequence.
//   2. monteCarlo() wraps simulate() in N stochastic runs and returns
//      { successRate, medianEndTotal, depletionAges }.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { monteCarlo, percentile, buildHistogram, pctDepletedBefore, percentileBands } from "../engine/monteCarlo.js";

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

// ── Percentile / distribution helpers ────────────────────────
describe("percentile()", () => {
  const sorted = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]; // length 10, ascending

  it("p5 picks the worst tail, p95 the best", () => {
    expect(percentile(sorted, 0.05)).toBe(0);
    expect(percentile(sorted, 0.95)).toBe(90);
  });

  it("p50 is the middle of the array", () => {
    expect(percentile(sorted, 0.5)).toBe(50);
  });

  it("returns 0 for an empty array", () => {
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("buildHistogram()", () => {
  it("buckets all values and the counts sum to the input length", () => {
    const vals = [0, 5, 50, 95, 100, 100, 100];
    const h = buildHistogram(vals, 10);
    expect(h).toHaveLength(10);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(vals.length);
  });

  it("piles zero / depleted outcomes into the first bin", () => {
    const h = buildHistogram([0, 0, 0, 1000], 4);
    expect(h[0].count).toBe(3);
  });

  it("returns an empty array for no values", () => {
    expect(buildHistogram([], 12)).toEqual([]);
  });
});

describe("pctDepletedBefore()", () => {
  it("counts only runs that deplete strictly before the age", () => {
    const ages = [70, 80, null, 90, null]; // 5 runs, 3 deplete
    expect(pctDepletedBefore(ages, 85)).toBeCloseTo(2 / 5); // 70 and 80 qualify
    expect(pctDepletedBefore(ages, 100)).toBeCloseTo(3 / 5); // all depletions qualify
  });

  it("never counts survivors (null)", () => {
    expect(pctDepletedBefore([null, null], 90)).toBe(0);
  });
});

// ── Enriched monteCarlo() outputs ────────────────────────────
describe("monteCarlo(): percentile + distribution outputs", () => {
  const result = monteCarlo({ ...base }, { n: 200, seed: 7 });

  it("orders the wealth percentiles p10 ≤ median ≤ p90", () => {
    expect(result.p10EndTotal).toBeLessThanOrEqual(result.medianEndTotal);
    expect(result.medianEndTotal).toBeLessThanOrEqual(result.p90EndTotal);
  });

  it("p50EndTotal equals the median estate (same value)", () => {
    expect(result.p50EndTotal).toBe(result.medianEndTotal);
  });

  it("depletionRate is the complement of successRate", () => {
    expect(result.depletionRate).toBeCloseTo(1 - result.successRate);
  });

  it("returns a histogram whose counts total n", () => {
    expect(result.histogram.length).toBeGreaterThan(0);
    expect(result.histogram.reduce((s, b) => s + b.count, 0)).toBe(200);
  });

  it("keeps backward-compatible fields", () => {
    expect(result).toHaveProperty("successRate");
    expect(result).toHaveProperty("medianEndTotal");
    expect(result.depletionAges).toHaveLength(200);
  });

  it("returns per-year bands spanning the retirement horizon, ordered p10 ≤ p50 ≤ p90", () => {
    const span = base.lifeExpect - base.retireAge;
    expect(result.bands.length).toBe(span);
    // Snapshots are end-of-year, so the first band lands at retireAge+1 and the last at lifeExpect.
    expect(result.bands[0].age).toBe(base.retireAge + 1);
    expect(result.bands.at(-1).age).toBe(base.lifeExpect);
    for (const b of result.bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
  });
});

describe("percentileBands()", () => {
  it("computes per-index percentiles across trajectories", () => {
    // 5 runs × 2 years. Year 0 all 100; year 1 spread 0..400.
    const trajectories = [
      [100, 0],
      [100, 100],
      [100, 200],
      [100, 300],
      [100, 400],
    ];
    const bands = percentileBands(trajectories, [60, 61]);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ age: 60, p10: 100, p50: 100, p90: 100 });
    expect(bands[1].p10).toBeLessThanOrEqual(bands[1].p50);
    expect(bands[1].p50).toBeLessThanOrEqual(bands[1].p90);
  });

  it("returns [] for empty input", () => {
    expect(percentileBands([], [])).toEqual([]);
    expect(percentileBands([[1, 2]], [])).toEqual([]);
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
