// M5 — Guyton-Klinger guardrails tests (TDD gate)
// Upper guardrail: if withdrawal rate > guardrailUpper, cut spending 10%.
// Lower guardrail: if withdrawal rate < guardrailLower, raise spending 10%.
// Both checked at year-end and applied to the next year's spending base.
// Withdrawal rate = (current monthly spend × 12) / current portfolio total.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);

// Moderately tight plan that will be stressed by bad early returns.
// SS kicks in at retirement so we know the need level from day 1.
const tight = {
  retireAge: 65,
  lifeExpect: 90,
  ssAge: 65,         // immediate SS — simplifies WR calculation
  monthlyExpense: 5500,
  inflationRate: 3,
  stockReturn: 5,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 800_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,  // → net need ≈ $3.5k/mo from portfolio; initial WR ≈ 5.3%
  annualRothConversion: 0,
  filingStatus: "single",
};

// Bad early sequence: two crash years followed by modest recovery.
const badSeq = (n) => [-25, -15, ...Array(n - 2).fill(5)];

// Low-withdrawal scenario for the prosperity (lower-guardrail) test.
// High SS + modest expense → WR is very low from retirement.
const lowWR = {
  ...tight,
  ssAge: 65,
  ssBenefit: 4000,  // covers almost all spending; portfolio WR < 2% from day 1
  monthlyExpense: 4500,
  k401: 1_500_000,
};

describe("Guardrails: backwards compatible (guardrailUpper/Lower default to 0)", () => {
  it("no change in behaviour when neither guardrail is set", () => {
    const baseRes = simulate({ ...tight });
    const explicitOff = simulate({ ...tight, guardrailUpper: 0, guardrailLower: 0 });
    expect(baseRes.snaps.at(-1).total).toBeCloseTo(explicitOff.snaps.at(-1).total, 0);
  });
});

describe("Guardrails: upper guardrail cuts spending when WR is too high", () => {
  const years = tight.lifeExpect - tight.retireAge;
  const noGuard = simulate({ ...tight, returnSeries: badSeq(years) });
  const withGuard = simulate({ ...tight, returnSeries: badSeq(years), guardrailUpper: 0.07 });

  it("upper guardrail preserves more wealth during a crash (less was spent)", () => {
    // The guardrail triggered spending cuts → portfolio better preserved
    expect(withGuard.snaps.at(-1).total).toBeGreaterThan(noGuard.snaps.at(-1).total);
  });

  it("guardrail fires after the first crash year (WR exceeds 7%)", () => {
    // After year 1 crash, WR should exceed 7% → spending was cut
    // Evidence: wealth diverges by age 67 (year 2 start reflects year 1 cut)
    expect(snapAt(withGuard, 67).total).toBeGreaterThan(snapAt(noGuard, 67).total);
  });
});

describe("Guardrails: lower guardrail raises spending when WR is very low", () => {
  const years = lowWR.lifeExpect - lowWR.retireAge;
  const noGuard = simulate({ ...lowWR });
  const withGuard = simulate({ ...lowWR, guardrailLower: 0.02 });

  it("lower guardrail results in more consumption: less wealth at end", () => {
    // WR starts very low (large portfolio, low need after SS) → guardrail raises spending
    // More spending means less end total
    expect(withGuard.snaps.at(-1).total).toBeLessThan(noGuard.snaps.at(-1).total);
  });

  it("lower guardrail does not cause depletion on a well-funded plan", () => {
    // Spending raised but plan should still survive to life expectancy
    expect(withGuard.depleted).toBeNull();
  });
});

describe("Guardrails: bounds far from actual WR produce no adjustment", () => {
  it("extremely wide bounds never fire: result is identical to no-guardrail baseline", () => {
    // Bounds set far outside the plan's actual WR range → no adjustment at any year
    const res = simulate({ ...tight, guardrailUpper: 0.25, guardrailLower: 0.005 });
    const base = simulate({ ...tight });
    const diff = Math.abs(res.snaps.at(-1).total - base.snaps.at(-1).total);
    expect(diff).toBeLessThan(10); // floating-point only, essentially identical
  });
});
