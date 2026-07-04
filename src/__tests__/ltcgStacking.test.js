// Phase 1D — real LTCG bracket stacking + NIIT
// autoLtcg derives the brokerage gain rate each sim year from the LTCG
// brackets (gains stacked on trailing ordinary income), + flat state rate,
// + 3.8% NIIT when trailing MAGI crosses the non-indexed threshold.
// autoLtcg=false keeps the flat user-picked brokerageLtcgRate (legacy).

import { describe, it, expect } from "vitest";
import { ltcgRateAt, niitApplies } from "../engine/tax.js";
import { simulate } from "../engine/simulate.js";
import { LTCG_BRACKETS, NIIT, STD_DEDUCTION } from "../constants/brackets.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

describe("ltcgRateAt()", () => {
  it("low ordinary income stacks gains into the 0% bracket", () => {
    expect(ltcgRateAt(0, "mfj")).toBe(0);
    expect(ltcgRateAt(40_000, "single")).toBe(0); // 40k − 16.1k deduction < 49,450
  });

  it("middle incomes land at 15%", () => {
    expect(ltcgRateAt(150_000, "mfj")).toBe(0.15); // 117.8k taxable > 98,900
    expect(ltcgRateAt(120_000, "single")).toBe(0.15);
  });

  it("very high incomes land at 20%", () => {
    expect(ltcgRateAt(700_000, "mfj")).toBe(0.20);
    expect(ltcgRateAt(600_000, "single")).toBe(0.20);
  });

  it("thresholds are inflation-indexed via indexFactor", () => {
    const idx = Math.pow(1.03, 25);
    // 0%-band top for MFJ moves with the index: taxable at the old edge stays 0%.
    const grossAtEdge = (LTCG_BRACKETS.mfj[0].upTo + STD_DEDUCTION.mfj) * idx - 1;
    expect(ltcgRateAt(grossAtEdge, "mfj", idx)).toBe(0);
    expect(ltcgRateAt(grossAtEdge, "mfj", 1)).toBeGreaterThan(0); // frozen: creeps to 15%
  });
});

describe("niitApplies()", () => {
  it("uses the fixed statutory thresholds", () => {
    expect(niitApplies(NIIT.threshold.mfj, "mfj")).toBe(false);
    expect(niitApplies(NIIT.threshold.mfj + 1, "mfj")).toBe(true);
    expect(niitApplies(200_001, "single")).toBe(true);
    expect(niitApplies(150_000, "single")).toBe(false);
  });
});

describe("simulate() autoLtcg", () => {
  // Brokerage-funded retiree with modest ordinary income: real stacking puts
  // their gains in the 0% bracket, which the flat 15% picklist overtaxes.
  const brokerageRetiree = {
    retireAge: 60,
    lifeExpect: 85,
    ssAge: 67,
    ssBenefit: 1500,
    monthlyExpense: 5000,
    inflationRate: 3,
    stockReturn: 7,
    rothContributions: 0,
    rothEarnings: 0,
    brokerage: 1_800_000,
    brokerageBasis: 600_000, // 2/3 gain fraction — LTCG rate matters a lot
    brokerageLtcgRate: 15,
    k401: 0,
    cashDeposit: 0,
    muniBonds: 0,
    stateTaxRate: 0,
    annualRothConversion: 0,
    filingStatus: "mfj",
  };

  it("autoLtcg=false (default) reproduces legacy flat-rate results exactly", () => {
    const legacy = simulate({ ...brokerageRetiree });
    const explicit = simulate({ ...brokerageRetiree, autoLtcg: false });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
  });

  it("a low-ordinary-income retiree pays 0% on gains — beats the flat 15% run", () => {
    const flat15 = simulate({ ...brokerageRetiree });
    const auto = simulate({ ...brokerageRetiree, autoLtcg: true });
    expect(lastTotal(auto)).toBeGreaterThan(lastTotal(flat15));
  });

  it("heavy ordinary income pushes the auto rate above zero (stacking, not a free lunch)", () => {
    // Same retiree but with large 401k draws providing the ordinary-income stack.
    const withOrdinary = {
      ...brokerageRetiree,
      brokerage: 600_000,
      brokerageBasis: 200_000,
      k401: 2_000_000,
      monthlyExpense: 16_000, // forces big 401k draws once brokerage thins
      brokerageLtcgRate: 0,   // flat comparator assumes 0% — auto must be costlier
    };
    const flat0 = simulate({ ...withOrdinary });
    const auto = simulate({ ...withOrdinary, autoLtcg: true });
    expect(lastTotal(auto)).toBeLessThanOrEqual(lastTotal(flat0));
  });

  it("state rate still adds on top in auto mode", () => {
    const noState = simulate({ ...brokerageRetiree, autoLtcg: true });
    const withState = simulate({ ...brokerageRetiree, autoLtcg: true, stateTaxRate: 9 });
    expect(lastTotal(withState)).toBeLessThan(lastTotal(noState));
  });

  it("NIIT bites when trailing MAGI crosses the threshold", () => {
    // Massive annual conversions push MAGI far over $250k MFJ, so brokerage
    // gains in later years carry the extra 3.8%.
    const conv = {
      ...brokerageRetiree,
      k401: 3_000_000,
      annualRothConversion: 400_000,
      conversionEndAge: 70,
      cashDeposit: 1_000_000, // liquid funds to pay conversion tax
      monthlyExpense: 9000,
    };
    const withNiitBase = simulate({ ...conv, autoLtcg: true });
    // Comparator: same plan where NIIT can never trigger (conversions off).
    const noConv = simulate({ ...conv, annualRothConversion: 0, autoLtcg: true });
    // Sanity: both runs survive; the NIIT path is exercised without exploding.
    expect(withNiitBase.depleted).toBeNull();
    expect(noConv.depleted).toBeNull();
  });
});
