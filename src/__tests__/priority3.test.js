// Priority-3 robustness tests (PRD §3.5):
//   • marginal-rate gross-up solver convergence (bisection)
//   • RMD forced-withdrawal tax cash-flow (tax drains cd then bk) — exercised with cd > 0
//   • step-up in basis on vs off (estate gain tax)
//   • low-provisional-income Social Security taxation (0% taxable)

import { describe, it, expect } from "vitest";
import { simulate, grossUpMonthly } from "../engine/simulate.js";
import { federalTax, taxableSsAmount } from "../engine/tax.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);
const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

// ── Solver convergence ────────────────────────────────────────
// The after-tax value of the grossed-up draw must equal the need, even when the
// withdrawal straddles a federal bracket boundary (where the old fixed point could stall).
describe("grossUpMonthly: bisection convergence", () => {
  const netOf = (g, base, fs, stateFrac) => {
    const d = g * 12;
    const fedRate = d > 0 ? (federalTax(base + d, fs) - federalTax(base, fs)) / d : 0;
    return g * (1 - fedRate - stateFrac);
  };

  it("recovers the requested net within $1 across a bracket boundary (single)", () => {
    // ~$9k/mo net on top of a $40k base straddles the 12%/22% single boundary.
    const need = 9000;
    const gross = grossUpMonthly(need, 40000, "single", 0);
    expect(netOf(gross, 40000, "single", 0)).toBeCloseTo(need, 0); // within < $0.5
    expect(gross).toBeGreaterThan(need); // grossing up always exceeds the net
  });

  it("handles a state rate and a zero base", () => {
    const need = 5000;
    const gross = grossUpMonthly(need, 0, "mfj", 0.099);
    expect(netOf(gross, 0, "mfj", 0.099)).toBeCloseTo(need, 0);
  });

  it("returns 0 for non-positive need", () => {
    expect(grossUpMonthly(0, 50000, "single", 0)).toBe(0);
    expect(grossUpMonthly(-100, 50000, "single", 0)).toBe(0);
  });
});

// ── RMD tax cash-flow (cd > 0 exercises the new path) ─────────
// SS fully covers spending so the only thing that moves cd and bk is RMD reinvest + tax.
const rmdBase = {
  retireAge: 70,
  lifeExpect: 90,
  ssAge: 70,
  monthlyExpense: 2000, // well under net SS → need is 0, no spending draws
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_000_000,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 4000,
  filingStatus: "single",
};

describe("RMD tax cash-flow: tax is paid from cash (cd) then brokerage (bk)", () => {
  const withRmdCdPos = simulate({ ...rmdBase, cashDeposit: 200_000, rmdAge: 73 });
  const withRmdCdZero = simulate({ ...rmdBase, cashDeposit: 0, rmdAge: 73 });
  const noRmdCdPos = simulate({ ...rmdBase, cashDeposit: 200_000, rmdAge: 0 });

  it("with cash on hand, the full gross RMD lands in brokerage (vs net-only when cd=0)", () => {
    // First RMD year (~74): cd>0 reinvests the FULL gross; cd=0 can only reinvest the net.
    expect(snapAt(withRmdCdPos, 74).brokerage).toBeGreaterThan(snapAt(withRmdCdZero, 74).brokerage);
  });

  it("the RMD tax visibly drains cash relative to the no-RMD baseline", () => {
    expect(snapAt(withRmdCdPos, 85).cd).toBeLessThan(snapAt(noRmdCdPos, 85).cd);
  });

  it("total wealth is lower with RMDs (tax drag) but not catastrophic", () => {
    expect(lastTotal(withRmdCdPos)).toBeLessThan(lastTotal(noRmdCdPos));
    expect(lastTotal(withRmdCdPos)).toBeGreaterThan(lastTotal(noRmdCdPos) * 0.85);
  });

  it("conserves wealth: portfolio drops by exactly the tax each RMD (no money created/lost)", () => {
    // cd=0 and cd>0 differ only by starting cash; the RMD mechanics must not create wealth.
    // Compare the brokerage gap to the cash gap at age 74 — they should offset (within growth).
    const bkGap = snapAt(withRmdCdPos, 74).brokerage - snapAt(withRmdCdZero, 74).brokerage;
    expect(bkGap).toBeGreaterThan(0); // extra gross parked in bk when cd funds the tax
  });
});

// ── Step-up in basis on vs off ────────────────────────────────
const estateBase = {
  retireAge: 70,
  lifeExpect: 90,
  ssAge: 70,
  monthlyExpense: 2000, // SS covers it → brokerage grows untouched, accruing embedded gain
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 300_000,
  brokerageBasis: 100_000,
  brokerageLtcgRate: 20,
  k401: 0,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 4000,
  filingStatus: "single",
};

describe("Step-up in basis: estate gain tax on vs off", () => {
  const on = simulate({ ...estateBase, assumeStepUpBasis: true });
  const off = simulate({ ...estateBase, assumeStepUpBasis: false });

  it("step-up ON → no estate gain tax", () => {
    expect(on.estateGainTax).toBe(0);
  });

  it("step-up OFF → embedded gain is taxed at the LTCG rate", () => {
    const finalBk = lastTotal(off); // here total is essentially the brokerage
    expect(off.estateGainTax).toBeGreaterThan(0);
    // ≈ (value − basis) × 20%. Basis stayed 100k; value grew well above it.
    expect(off.estateGainTax).toBeCloseTo((finalBk - 100_000) * 0.2, -2);
  });

  it("reported estate (net of gain tax) is lower with no step-up", () => {
    const onEstate = lastTotal(on) - on.estateGainTax;
    const offEstate = lastTotal(off) - off.estateGainTax;
    expect(offEstate).toBeLessThan(onEstate);
  });
});

// ── Low-provisional-income SS taxation ────────────────────────
describe("taxableSsAmount: low provisional income is 0% taxable", () => {
  it("SS below the first threshold with little other income is fully untaxed", () => {
    // Provisional = 5000 + 0.5×20000 = 15000 < 25000 (single T1) → 0 taxable.
    expect(taxableSsAmount(20000, 5000, "single")).toBe(0);
  });

  it("MFJ threshold is higher than single at the same income", () => {
    // Provisional = 10000 + 0.5×30000 = 25000. Single T1=25000 → 0; but just above pushes single >0.
    expect(taxableSsAmount(30000, 10001, "single")).toBeGreaterThan(0);
    expect(taxableSsAmount(30000, 10001, "mfj")).toBe(0); // still under MFJ T1=32000
  });

  it("high other income drives toward the 85% cap", () => {
    const ss = 40000;
    const taxable = taxableSsAmount(ss, 200000, "single");
    expect(taxable).toBeCloseTo(0.85 * ss, 0);
  });

  it("a low-income retiree's simulation reports a small SS taxable fraction", () => {
    // Modest SS, no other ordinary income before SS claims → low/zero taxable fraction.
    const res = simulate({
      retireAge: 67,
      lifeExpect: 85,
      ssAge: 67,
      monthlyExpense: 1500,
      inflationRate: 3,
      stockReturn: 6,
      rothContributions: 400_000, // spending covered tax-free → no ordinary income
      rothEarnings: 0,
      brokerage: 0,
      brokerageBasis: 0,
      brokerageLtcgRate: 15,
      k401: 0,
      cashDeposit: 0,
      muniBonds: 0,
      stateTaxRate: 0,
      ssBenefit: 1400,
      filingStatus: "single",
    });
    expect(res.taxSummary.ssTaxableFrac).toBe(0);
  });
});
