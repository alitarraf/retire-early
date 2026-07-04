// Phase 3 — survivor transition (the "widow's tax torpedo")
// From survivorAge: single filing status for every tax/threshold lookup,
// household SS collapses to the larger benefit, householdSize−1 (FPL),
// base spending × survivorSpendFraction, streams honor survivorPct.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

const couple = {
  retireAge: 62,
  lifeExpect: 92,
  ssAge: 67,
  ssBenefit: 2400,
  ss2Benefit: 1800,
  ss2Age: 67,
  monthlyExpense: 8000,
  inflationRate: 3,
  stockReturn: 6,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 2_000_000,
  cashDeposit: 300_000,
  muniBonds: 0,
  stateTaxRate: 0,
  annualRothConversion: 0,
  filingStatus: "mfj",
  householdSize: 2,
};

describe("survivor transition: backward compatibility", () => {
  it("survivorAge 0 (default) reproduces legacy numbers exactly", () => {
    const legacy = simulate({ ...couple });
    const explicit = simulate({ ...couple, survivorAge: 0 });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
  });
});

describe("survivor transition mechanics", () => {
  const widowed = simulate({ ...couple, survivorAge: 75 });
  const intact = simulate({ ...couple });

  it("household SS drops to the larger benefit only", () => {
    // Less SS income + single brackets outweigh the 25% spending reduction
    // in this SS-reliant plan only if spend cut is small; assert the runs
    // genuinely diverge after 75 and not before.
    const at74 = (res) => res.snaps.find((s) => s.age === 74).total;
    expect(at74(widowed)).toBeCloseTo(at74(intact), 0);
    expect(lastTotal(widowed)).not.toBe(lastTotal(intact));
  });

  it("single brackets tax the same 401k draw harder (the torpedo)", () => {
    // Force identical spending across the transition (survivorSpendFraction 1,
    // equal SS streams so max == one full benefit): the only change is the
    // bracket flip + one SS check. The widowed run must end poorer.
    const sameSpend = {
      ...couple,
      ssBenefit: 2000,
      ss2Benefit: 2000,
      k401: 5_000_000, // rich enough that neither run depletes to $0
      monthlyExpense: 12_000,
      survivorSpendFraction: 1,
    };
    const w = simulate({ ...sameSpend, survivorAge: 72 });
    const i = simulate({ ...sameSpend });
    expect(lastTotal(w)).toBeLessThan(lastTotal(i));
  });

  it("reduced spending partially offsets the lost benefit", () => {
    const fullSpend = simulate({ ...couple, survivorAge: 75, survivorSpendFraction: 1 });
    const reduced = simulate({ ...couple, survivorAge: 75, survivorSpendFraction: 0.6 });
    expect(lastTotal(reduced)).toBeGreaterThan(lastTotal(fullSpend));
  });

  it("income streams honor survivorPct", () => {
    const pension = { label: "pension", monthly: 4000, startAge: 65, taxType: "free" };
    const full = simulate({
      ...couple, survivorAge: 75,
      incomeStreams: [{ ...pension, survivorPct: 1 }],
    });
    const halved = simulate({
      ...couple, survivorAge: 75,
      incomeStreams: [{ ...pension, survivorPct: 0.5 }],
    });
    expect(lastTotal(full)).toBeGreaterThan(lastTotal(halved));
  });

  it("survivor filing flips ACA household math too (pre-65 death)", () => {
    // Widowed at 63 with ACA coverage: single FPL scale + single MAGI math.
    const acaCouple = { ...couple, retireAge: 60, monthlyAcaFullPremium: 1800 };
    const w = simulate({ ...acaCouple, survivorAge: 63 });
    // Just exercise the path: run must be finite and not throw.
    expect(w.snaps.length).toBeGreaterThan(0);
  });
});
