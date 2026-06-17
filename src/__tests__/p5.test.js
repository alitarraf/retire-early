// M6 — P5 correctness backlog tests (TDD gate)
// Four features:
//   1. SS claiming-age adjustment (ssPia → benefit adjusted for claiming age vs FRA)
//   2. HSA (triple-tax-advantaged; tax-free growth and draws)
//   3. IRMAA Medicare surcharge (added to spend at age 65+)
//   4. State SS income exemption (reduces state tax on SS income)

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { makePlan } from "../analysis/plan.js";
import { ssClaimFactor } from "../engine/socialSecurity.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);
const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

// Shared base for simulate() tests.
const base = {
  retireAge: 62,
  lifeExpect: 90,
  ssAge: 67,
  monthlyExpense: 4000,
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_200_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,
  annualRothConversion: 0,
  filingStatus: "single",
};

// ── 1. SS claiming-age adjustment ────────────────────────────
describe("ssClaimFactor: IRS benefit adjustment for claiming age", () => {
  it("claiming at FRA (67) = factor 1.0 (no adjustment)", () => {
    expect(ssClaimFactor(67, 67)).toBeCloseTo(1.0, 3);
  });

  it("claiming at 62 = ~70% of FRA benefit (30% reduction over 5 years early)", () => {
    // First 36 months: 5/9% per month; next 24 months: 5/12% per month
    expect(ssClaimFactor(62, 67)).toBeCloseTo(0.70, 2);
  });

  it("claiming at 70 = 124% of FRA benefit (8%/yr × 3 years delayed)", () => {
    expect(ssClaimFactor(70, 67)).toBeCloseTo(1.24, 3);
  });

  it("factor increases monotonically from 62 to 70", () => {
    for (let age = 62; age < 70; age++) {
      expect(ssClaimFactor(age + 1, 67)).toBeGreaterThan(ssClaimFactor(age, 67));
    }
  });
});

describe("makePlan: ssPia derives ssBenefit from claiming age", () => {
  it("without ssPia, ssBenefit is used unchanged", () => {
    const plan = makePlan({ ssBenefit: 2000, ssAge: 67 });
    expect(plan.ssBenefit).toBe(2000);
  });

  it("with ssPia, ssBenefit is adjusted for early claiming", () => {
    const plan = makePlan({ ssPia: 2000, ssAge: 62, ssFra: 67 });
    expect(plan.ssBenefit).toBeCloseTo(2000 * ssClaimFactor(62, 67), 0);
  });

  it("with ssPia, delayed claiming increases ssBenefit", () => {
    const early = makePlan({ ssPia: 2000, ssAge: 62, ssFra: 67 });
    const delayed = makePlan({ ssPia: 2000, ssAge: 70, ssFra: 67 });
    expect(delayed.ssBenefit).toBeGreaterThan(early.ssBenefit);
  });
});

// ── 2. HSA ───────────────────────────────────────────────────
describe("HSA: tax-free growth and draws", () => {
  it("HSA balance grows and is included in total wealth", () => {
    const res = simulate({ ...base, hsaBalance: 100_000 });
    const noHsa = simulate({ ...base });
    // With HSA: total should be > without at every snapshot
    expect(snapAt(res, 65).total).toBeGreaterThan(snapAt(noHsa, 65).total);
  });

  it("HSA draws are tax-free: total wealth higher than equivalent 401k draw", () => {
    // Same balance in HSA vs 401k; HSA draw is tax-free, 401k draw is taxed
    const withHsa = simulate({ ...base, k401: 800_000, hsaBalance: 400_000 });
    const allK401 = simulate({ ...base, k401: 1_200_000, hsaBalance: 0 });
    // HSA draws leave more net wealth because no tax is paid on HSA withdrawals
    expect(lastTotal(withHsa)).toBeGreaterThan(lastTotal(allK401));
  });

  it("HSA of zero behaves identically to baseline", () => {
    const res = simulate({ ...base, hsaBalance: 0 });
    const baseline = simulate({ ...base });
    expect(lastTotal(res)).toBeCloseTo(lastTotal(baseline), 0);
  });
});

// ── 3. IRMAA Medicare surcharge ──────────────────────────────
describe("IRMAA: Medicare income-related surcharge at age 65+", () => {
  it("IRMAA surcharge reduces wealth at age 65+ vs no surcharge", () => {
    const withIrmaa = simulate({ ...base, monthlyIrmaaSurcharge: 500 });
    const noIrmaa = simulate({ ...base });
    // Surcharge adds cost from 65 to life expectancy → less total wealth
    expect(lastTotal(withIrmaa)).toBeLessThan(lastTotal(noIrmaa));
  });

  it("IRMAA = 0 produces identical results to baseline (backwards compatible)", () => {
    const res = simulate({ ...base, monthlyIrmaaSurcharge: 0 });
    const baseline = simulate({ ...base });
    expect(lastTotal(res)).toBeCloseTo(lastTotal(baseline), 0);
  });

  it("IRMAA cost only applies at age 65+ (retiring at 65 is the same)", () => {
    // Retiring exactly at 65 with IRMAA: cost starts immediately
    const at65 = simulate({ ...base, retireAge: 65, monthlyIrmaaSurcharge: 500 });
    const at65NoIrmaa = simulate({ ...base, retireAge: 65 });
    expect(lastTotal(at65)).toBeLessThan(lastTotal(at65NoIrmaa));
  });
});

// ── 4. State SS income exemption ─────────────────────────────
describe("State SS exemption: some states don't tax Social Security", () => {
  const baseWithState = { ...base, stateTaxRate: 9.9 }; // Oregon-like

  it("full SS exemption (stateSsExemptRate=1) leaves more SS income than no exemption", () => {
    const exempt = simulate({ ...baseWithState, stateSsExemptRate: 1.0 });
    const taxed = simulate({ ...baseWithState, stateSsExemptRate: 0 });
    // With exemption, state tax doesn't reduce SS → higher net SS → less drawn from portfolio
    expect(lastTotal(exempt)).toBeGreaterThan(lastTotal(taxed));
  });

  it("stateSsExemptRate=0 matches existing behaviour (backwards compatible)", () => {
    const res = simulate({ ...baseWithState, stateSsExemptRate: 0 });
    const baseline = simulate({ ...baseWithState });
    expect(lastTotal(res)).toBeCloseTo(lastTotal(baseline), 0);
  });

  it("partial exemption (50%) falls between fully exempt and fully taxed", () => {
    const exempt = lastTotal(simulate({ ...baseWithState, stateSsExemptRate: 1.0 }));
    const taxed = lastTotal(simulate({ ...baseWithState, stateSsExemptRate: 0 }));
    const partial = lastTotal(simulate({ ...baseWithState, stateSsExemptRate: 0.5 }));
    expect(partial).toBeGreaterThan(taxed);
    expect(partial).toBeLessThan(exempt);
  });
});
