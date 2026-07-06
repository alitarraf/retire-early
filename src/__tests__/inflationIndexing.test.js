// Phase 1A — tax-code inflation indexing (bracket-creep fix)
// Brackets, standard deduction, and FPL are IRS/HHS inflation-adjusted every
// year; the engine previously froze them at TAX_YEAR nominal values while
// spending and SS inflated, systematically overstating late-year taxes.
// `taxIndexYears` (simulate) / `indexFactor` (tax.js) opt into indexing;
// null / factor 1 must reproduce legacy numbers exactly.

import { describe, it, expect } from "vitest";
import { federalTax, effectiveFedRate, marginalFedRate, taxableSsAmount } from "../engine/tax.js";
import { simulate } from "../engine/simulate.js";
import { SS_PROVISIONAL_THRESHOLDS } from "../constants/brackets.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

describe("tax.js indexFactor", () => {
  it("factor 1 (and omitted) reproduces legacy results exactly", () => {
    for (const income of [0, 20_000, 85_000, 250_000, 1_000_000]) {
      for (const fs of ["single", "mfj", "hoh"]) {
        expect(federalTax(income, fs, 1)).toBe(federalTax(income, fs));
        expect(effectiveFedRate(income, fs, 1)).toBe(effectiveFedRate(income, fs));
        expect(marginalFedRate(income, fs, 1)).toBe(marginalFedRate(income, fs));
      }
    }
  });

  it("constant-real income pays constant-real tax under indexing (no bracket creep)", () => {
    const idx = Math.pow(1.03, 30); // 30 years of 3% inflation
    const nominal = federalTax(100_000 * idx, "mfj", idx);
    const real = federalTax(100_000, "mfj") * idx;
    expect(nominal).toBeCloseTo(real, 6);
  });

  it("without indexing, the same inflated income creeps into higher brackets", () => {
    const idx = Math.pow(1.03, 30);
    const frozen = federalTax(100_000 * idx, "mfj"); // legacy: brackets stay nominal
    const indexed = federalTax(100_000 * idx, "mfj", idx);
    expect(frozen).toBeGreaterThan(indexed);
  });

  it("marginal rate is stable in real terms under indexing", () => {
    const idx = Math.pow(1.03, 25);
    expect(marginalFedRate(90_000 * idx, "mfj", idx)).toBe(marginalFedRate(90_000, "mfj"));
  });

  it("SS provisional thresholds stay frozen (IRC §86 — not indexed by law)", () => {
    // taxableSsAmount takes no index factor; thresholds are the enacted nominals.
    expect(SS_PROVISIONAL_THRESHOLDS.mfj).toEqual([32000, 44000]);
    const t = taxableSsAmount(30_000, 40_000, "mfj");
    expect(t).toBeGreaterThan(0); // provisional income far above T2 → taxable
  });
});

describe("simulate() taxIndexYears", () => {
  const base = {
    retireAge: 60,
    lifeExpect: 90,
    ssAge: 67,
    ssBenefit: 2500,
    monthlyExpense: 7000,
    inflationRate: 3,
    stockReturn: 7,
    rothContributions: 0,
    rothEarnings: 0,
    brokerage: 0,
    brokerageBasis: 0,
    brokerageLtcgRate: 15,
    k401: 2_500_000,
    cashDeposit: 0,
    muniBonds: 0,
    stateTaxRate: 0,
    annualRothConversion: 0,
    filingStatus: "mfj",
  };

  it("omitting taxIndexYears reproduces legacy results exactly", () => {
    const legacy = simulate({ ...base });
    const explicit = simulate({ ...base, taxIndexYears: null });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
    expect(explicit.depleted).toBe(legacy.depleted);
  });

  it("a 401k-drawing plan ends wealthier with indexing than without (less tax paid)", () => {
    const frozen = simulate({ ...base });
    const indexed = simulate({ ...base, taxIndexYears: 20 }); // retiring 20 yrs after TAX_YEAR
    expect(lastTotal(indexed)).toBeGreaterThan(lastTotal(frozen));
  });

  it("indexing compounds through retirement: later index start means lower lifetime tax", () => {
    const at0 = simulate({ ...base, taxIndexYears: 0 });
    const at20 = simulate({ ...base, taxIndexYears: 20 });
    expect(lastTotal(at20)).toBeGreaterThan(lastTotal(at0));
  });

  it("indexing never makes a surviving plan deplete", () => {
    const frozen = simulate({ ...base });
    const indexed = simulate({ ...base, taxIndexYears: 10 });
    expect(frozen.depleted).toBeNull();
    expect(indexed.depleted).toBeNull();
  });
});
