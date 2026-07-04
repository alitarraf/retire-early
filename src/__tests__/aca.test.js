// M2 — ACA cliff / MAGI management tests (TDD gate)
// 2026: 400% FPL cliff is back. Household 1 cliff ≈ $62,600; household 2 ≈ $84,600.
// Roth draws don't count toward MAGI; traditional 401k draws do.
// Trailing MAGI model: prior-year MAGI determines current-year premium status.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);
const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

// Base: retire at 60, single filer, draws entirely from 401k (high MAGI).
// Monthly expense $6k, SS = 0, so annual 401k gross draw ≈ $65k
// (above $62,600 single cliff; below $84,600 couple cliff).
const high401kBase = {
  retireAge: 60,
  lifeExpect: 85,
  ssAge: 70,
  monthlyExpense: 5000, // ~$65k annual gross 401k draw → above single cliff
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 2_000_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 0,
  annualRothConversion: 0,
  filingStatus: "single",
};

// Same expense profile funded entirely by Roth — Roth draws produce no MAGI.
const highRothBase = {
  ...high401kBase,
  k401: 0,
  rothContributions: 2_000_000,
};

describe("ACA: backwards compatible (monthlyAcaFullPremium not set)", () => {
  it("existing simulations are unaffected when ACA inputs are absent", () => {
    const res = simulate({ ...high401kBase });
    expect(res.depleted).toBeNull();
  });
});

describe("ACA: trailing MAGI model — prior-year MAGI drives premium status", () => {
  const noAca = simulate({ ...high401kBase });
  const withAca = simulate({ ...high401kBase, monthlyAcaFullPremium: 2000, householdSize: 1 });

  it("year 1 is premium-free (priorYearMagi initialized to 0)", () => {
    // snapshot at age 61 = end of retirement year 1; cliff not yet evaluated
    expect(snapAt(withAca, 61).total).toBeCloseTo(snapAt(noAca, 61).total, -3);
  });

  it("from year 2 onward, high MAGI triggers the cliff and wealth diverges", () => {
    // By age 63 (24 months of premium at $2k/mo = $48k drawn), gap is clear
    expect(snapAt(withAca, 63).total).toBeLessThan(snapAt(noAca, 63).total);
  });

  it("total wealth at age 65 is meaningfully lower (premiums paid over years 2–5)", () => {
    // ~48 months × $2k = $96k in premiums, plus lost compounding on reduced 401k
    const diff = snapAt(noAca, 65).total - snapAt(withAca, 65).total;
    expect(diff).toBeGreaterThan(60_000);
    expect(diff).toBeLessThan(300_000);
  });

  it("plan still reaches life expectancy (ACA cost doesn't wipe out a well-funded plan)", () => {
    expect(withAca.depleted).toBeNull();
  });
});

describe("ACA: Roth draws do not count toward MAGI", () => {
  it("Roth-funded plan pays no ACA premium: identical end wealth to no-ACA case", () => {
    const noAca = simulate({ ...highRothBase });
    const withAca = simulate({ ...highRothBase, monthlyAcaFullPremium: 2000, householdSize: 1 });
    // MAGI = 0 from Roth draws → cliff never triggered → no premium ever paid
    expect(Math.abs(lastTotal(withAca) - lastTotal(noAca))).toBeLessThan(100);
  });
});

describe("ACA: household size shifts the FPL cliff", () => {
  // Household 1 cliff ≈ $62,600; household 2 cliff ≈ $84,600.
  // At ~$65k annual MAGI (from high401kBase), single crosses the cliff but couple doesn't.

  it("single filer is above the cliff; couple household is below it at the same income", () => {
    const single = simulate({ ...high401kBase, householdSize: 1, monthlyAcaFullPremium: 2000 });
    const couple = simulate({ ...high401kBase, householdSize: 2, monthlyAcaFullPremium: 2000 });
    // Single pays premium years 2–5; couple pays nothing → single poorer by 65
    expect(snapAt(single, 65).total).toBeLessThan(snapAt(couple, 65).total);
  });
});

describe("ACA: premium stops at Medicare eligibility age 65", () => {
  it("retiring AT 65 incurs no ACA cost even with premium set and high MAGI scenario", () => {
    const at65Aca = simulate({ ...high401kBase, retireAge: 65, monthlyAcaFullPremium: 2000, householdSize: 1 });
    const at65NoAca = simulate({ ...high401kBase, retireAge: 65, monthlyAcaFullPremium: 0 });
    expect(lastTotal(at65Aca)).toBeCloseTo(lastTotal(at65NoAca), -3);
  });
});

// ── Phase 1E: sliding-scale premium (Rev. Proc. 2025-25) ─────────────────
// Below 400% FPL the household pays min(benchmark, applicablePct × MAGI);
// the binary free-or-full cliff is gone below 400%, retained at/above it.

import { acaApplicablePct, ACA } from "../constants/brackets.js";

describe("acaApplicablePct(): 2026 applicable-percentage table", () => {
  it("flat 2.10% below 133% FPL", () => {
    expect(acaApplicablePct(0.5)).toBeCloseTo(0.021, 6);
    expect(acaApplicablePct(1.32)).toBeCloseTo(0.021, 6);
  });

  it("interpolates linearly inside bands", () => {
    // midpoint of 150–200% band: (0.0419 + 0.0660) / 2
    expect(acaApplicablePct(1.75)).toBeCloseTo((0.0419 + 0.066) / 2, 4);
    // midpoint of 250–300% band
    expect(acaApplicablePct(2.75)).toBeCloseTo((0.0844 + 0.0996) / 2, 4);
  });

  it("flat 9.96% across 300–400% FPL", () => {
    expect(acaApplicablePct(3.0)).toBeCloseTo(0.0996, 6);
    expect(acaApplicablePct(3.99)).toBeCloseTo(0.0996, 6);
  });

  it("cliff at 400% FPL: no credit", () => {
    expect(acaApplicablePct(4.0)).toBeNull();
    expect(acaApplicablePct(7.5)).toBeNull();
  });

  it("is monotone non-decreasing below the cliff", () => {
    let prev = 0;
    for (let r = 0.1; r < 4.0; r += 0.05) {
      const p = acaApplicablePct(r);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = p;
    }
  });
});

describe("ACA sliding scale in simulate()", () => {
  it("below-cliff income pays a partial premium: between free and full", () => {
    // Couple household (~$84.6k cliff); ~$65k MAGI sits near 300% FPL → ~9.96%.
    const free = simulate({ ...high401kBase, householdSize: 2 });
    const partial = simulate({ ...high401kBase, householdSize: 2, monthlyAcaFullPremium: 2000 });
    const fullCliff = simulate({ ...high401kBase, householdSize: 1, monthlyAcaFullPremium: 2000 });
    // Pays something (wealth below the no-premium run)…
    expect(snapAt(partial, 65).total).toBeLessThan(snapAt(free, 65).total);
    // …but less than the above-cliff household paying the full benchmark.
    expect(snapAt(partial, 65).total).toBeGreaterThan(snapAt(fullCliff, 65).total);
  });

  it("contribution is capped at the full benchmark premium", () => {
    // Tiny benchmark premium: pct × MAGI would exceed it, so the cap binds and
    // the below-cliff household pays exactly the full (tiny) premium — same as
    // an above-cliff household with the same benchmark.
    const below = simulate({ ...high401kBase, householdSize: 2, monthlyAcaFullPremium: 100 });
    const above = simulate({ ...high401kBase, householdSize: 1, monthlyAcaFullPremium: 100 });
    expect(Math.abs(snapAt(below, 65).total - snapAt(above, 65).total)).toBeLessThan(5_000);
  });
});
