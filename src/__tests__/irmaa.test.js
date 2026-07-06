// Phase 1F — income-tested Medicare: base Part B + IRMAA (2-yr MAGI lookback)
// autoMedicare replaces the flat monthlyIrmaaSurcharge with the real model:
// base Part B per person + tier surcharge from MAGI two years prior (CMS 2026
// figures, indexed by plan inflation). The manual flat path is unchanged.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { MEDICARE, irmaaMonthlySurcharge } from "../constants/brackets.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

describe("irmaaMonthlySurcharge()", () => {
  it("no surcharge below the first threshold", () => {
    expect(irmaaMonthlySurcharge(100_000, "single")).toBe(0);
    expect(irmaaMonthlySurcharge(218_000, "mfj")).toBe(0);
  });

  it("tier cliffs: $1 over a boundary jumps the full tier", () => {
    expect(irmaaMonthlySurcharge(109_001, "single")).toBeCloseTo(81.20 + 14.50, 2);
    expect(irmaaMonthlySurcharge(274_001, "mfj")).toBeCloseTo(202.90 + 37.50, 2);
  });

  it("top tier applies above the last threshold", () => {
    expect(irmaaMonthlySurcharge(600_000, "single")).toBeCloseTo(487.00 + 91.00, 2);
    expect(irmaaMonthlySurcharge(1_000_000, "mfj")).toBeCloseTo(487.00 + 91.00, 2);
  });

  it("thresholds and surcharges index together", () => {
    const idx = 1.5;
    // 150k MAGI: tier 2 unindexed, but below the indexed tier-1 threshold.
    expect(irmaaMonthlySurcharge(150_000, "single")).toBeCloseTo(202.90 + 37.50, 2);
    expect(irmaaMonthlySurcharge(150_000, "single", idx)).toBe(0);
    // Surcharge dollars scale by the index.
    expect(irmaaMonthlySurcharge(109_001 * idx + 1, "single", idx))
      .toBeCloseTo((81.20 + 14.50) * idx, 1);
  });

  it("hoh falls back to the single scale", () => {
    expect(irmaaMonthlySurcharge(120_000, "hoh")).toBe(irmaaMonthlySurcharge(120_000, "single"));
  });
});

describe("simulate() autoMedicare", () => {
  const base = {
    retireAge: 63,
    lifeExpect: 85,
    ssAge: 67,
    ssBenefit: 2000,
    monthlyExpense: 6000,
    inflationRate: 0, // legible arithmetic
    stockReturn: 5,
    rothContributions: 0,
    rothEarnings: 0,
    brokerage: 0,
    brokerageBasis: 0,
    brokerageLtcgRate: 15,
    k401: 2_000_000,
    cashDeposit: 500_000,
    muniBonds: 0,
    stateTaxRate: 0,
    annualRothConversion: 0,
    filingStatus: "single",
  };

  it("off by default: legacy results unchanged", () => {
    const legacy = simulate({ ...base });
    const explicit = simulate({ ...base, autoMedicare: false });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
  });

  it("adds base Part B from 65 (low income: no IRMAA tier)", () => {
    const off = simulate({ ...base });
    const on = simulate({ ...base, autoMedicare: true });
    // 20 years × 12 × $202.90 ≈ $48.7k of premiums plus lost growth.
    expect(lastTotal(on)).toBeLessThan(lastTotal(off));
    const diff = lastTotal(off) - lastTotal(on);
    expect(diff).toBeGreaterThan(40_000);
    expect(diff).toBeLessThan(150_000);
  });

  it("a large Roth conversion at 63 raises Medicare costs at 65 (2-yr lookback)", () => {
    const quiet = simulate({ ...base, autoMedicare: true });
    const conv = simulate({
      ...base,
      autoMedicare: true,
      annualRothConversion: 150_000, // MAGI 150k at 63 → IRMAA tier at 65
      conversionEndAge: 64,          // one conversion year only
    });
    // The conversion run pays IRMAA at 65; isolate by comparing each run to
    // its own no-medicare twin so the conversion's tax cost cancels out.
    const quietOff = simulate({ ...base });
    const convOff = simulate({
      ...base,
      annualRothConversion: 150_000,
      conversionEndAge: 64,
    });
    const quietMedicareCost = lastTotal(quietOff) - lastTotal(quiet);
    const convMedicareCost = lastTotal(convOff) - lastTotal(conv);
    expect(convMedicareCost).toBeGreaterThan(quietMedicareCost + 1_000);
  });

  it("MFJ pays for two people", () => {
    const single = simulate({ ...base, autoMedicare: true });
    const singleOff = simulate({ ...base });
    const mfj = simulate({ ...base, autoMedicare: true, filingStatus: "mfj" });
    const mfjOff = simulate({ ...base, filingStatus: "mfj" });
    const singleCost = lastTotal(singleOff) - lastTotal(single);
    const mfjCost = lastTotal(mfjOff) - lastTotal(mfj);
    expect(mfjCost).toBeGreaterThan(singleCost * 1.5);
  });

  it("pre-retirement salary drives IRMAA in the first two years at 65+", () => {
    // Retire AT 65 with a high final salary: years 1-2 use preRetirementMagi.
    const rich = simulate({ ...base, retireAge: 65, autoMedicare: true, preRetirementMagi: 300_000 });
    const modest = simulate({ ...base, retireAge: 65, autoMedicare: true, preRetirementMagi: 80_000 });
    // 300k MAGI single → tier 4 ≈ $530/mo × 24 months ≈ $12.7k more.
    const diff = lastTotal(modest) - lastTotal(rich);
    expect(diff).toBeGreaterThan(8_000);
  });

  it("manual flat surcharge path is unchanged when autoMedicare is off", () => {
    const flat = simulate({ ...base, monthlyIrmaaSurcharge: 300 });
    const off = simulate({ ...base });
    expect(lastTotal(flat)).toBeLessThan(lastTotal(off));
  });
});
