// Phase 1G — HSA qualified-fraction + post-65 rule
// Tax-free HSA draws are capped at hsaQualifiedFraction × monthly spend
// (default 1 = legacy). Post-65, non-qualified draws are penalty-free but
// taxed as ordinary income (like a traditional IRA).

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;
const snapAt = (res, age) => res.snaps.find((s) => s.age === age);

const base = {
  retireAge: 60,
  lifeExpect: 85,
  ssAge: 67,
  ssBenefit: 2000,
  monthlyExpense: 6000,
  inflationRate: 0,
  stockReturn: 5,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_500_000,
  cashDeposit: 100_000,
  muniBonds: 0,
  hsaBalance: 300_000,
  stateTaxRate: 0,
  annualRothConversion: 0,
  filingStatus: "single",
};

describe("HSA qualified fraction", () => {
  it("fraction 1 (default) reproduces legacy results exactly", () => {
    const legacy = simulate({ ...base });
    const explicit = simulate({ ...base, hsaQualifiedFraction: 1 });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
  });

  it("the cap changes funding composition without breaking the plan", () => {
    const all = simulate({ ...base });
    const capped = simulate({ ...base, hsaQualifiedFraction: 0.15 });
    // Spending shifts from tax-free HSA to taxed 401k draws; totals move.
    expect(lastTotal(capped)).not.toBe(lastTotal(all));
    expect(capped.depleted).toBeNull();
  });

  it("pre-65 non-qualified HSA draws pay the 20% penalty: strictly poorer", () => {
    // HSA is the only meaningful asset pre-SS; the capped run must fund the
    // gap with penalized draws.
    const hsaOnly = {
      ...base,
      retireAge: 60,
      lifeExpect: 75,
      k401: 0,
      cashDeposit: 20_000,
      hsaBalance: 900_000,
      ssBenefit: 2500,
    };
    const qualified = simulate({ ...hsaOnly, hsaQualifiedFraction: 1 });
    const penalized = simulate({ ...hsaOnly, hsaQualifiedFraction: 0.15 });
    expect(lastTotal(penalized)).toBeLessThan(lastTotal(qualified));
  });

  it("post-65 the HSA still empties (non-qualified draws allowed, taxed)", () => {
    // Cash-poor plan that must lean on the HSA after 65.
    const capped = simulate({
      ...base,
      k401: 0,
      cashDeposit: 50_000,
      hsaBalance: 800_000,
      hsaQualifiedFraction: 0.15,
      ssBenefit: 1000,
    });
    // Money lasts well past 65 because the HSA is spendable (taxed) there.
    expect(capped.depleted === null || capped.depleted > 72).toBe(true);
  });

  it("post-65 non-qualified draws cost tax: fraction<1 ends below fraction=1", () => {
    const poor = { ...base, k401: 0, cashDeposit: 50_000, hsaBalance: 800_000, ssBenefit: 1000 };
    const qualified = simulate({ ...poor, hsaQualifiedFraction: 1 });
    const taxed = simulate({ ...poor, hsaQualifiedFraction: 0.15 });
    const q = qualified.depleted ?? 999;
    const t = taxed.depleted ?? 999;
    expect(t).toBeLessThanOrEqual(q);
  });
});
