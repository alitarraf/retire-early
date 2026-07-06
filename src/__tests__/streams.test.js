// Phase 3 — income streams, expense streams, windfalls
// incomeStreams: pension/annuity/part-time income, taxed as ordinary income
// (feeds drawBase, MAGI — so it raises SS taxability, ACA premiums, IRMAA).
// expenseStreams: recurring costs that END (mortgage). Negative one-time
// amounts are windfalls banked into cash. Empty defaults = legacy exactly.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { makePlan, simParamsAt } from "../analysis/plan.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

const base = {
  retireAge: 60,
  lifeExpect: 90,
  ssAge: 67,
  ssBenefit: 2200,
  monthlyExpense: 7000,
  inflationRate: 3,
  stockReturn: 6,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_200_000,
  cashDeposit: 200_000,
  muniBonds: 0,
  stateTaxRate: 0,
  annualRothConversion: 0,
  filingStatus: "mfj",
};

describe("streams: backward compatibility", () => {
  it("empty arrays reproduce legacy numbers exactly", () => {
    const legacy = simulate({ ...base });
    const explicit = simulate({ ...base, incomeStreams: [], expenseStreams: [] });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
  });
});

describe("income streams", () => {
  const pension = { label: "pension", monthly: 3000, startAge: 65, taxType: "ordinary" };

  it("a pension extends the money (less portfolio draw)", () => {
    const without = simulate({ ...base, monthlyExpense: 12_000 });
    const withPension = simulate({ ...base, monthlyExpense: 12_000, incomeStreams: [pension] });
    const w = without.depleted ?? 999;
    const p = withPension.depleted ?? 999;
    expect(p).toBeGreaterThan(w);
  });

  it("ordinary streams are taxed: a tax-free stream of equal size is worth more", () => {
    const ordinary = simulate({ ...base, incomeStreams: [pension] });
    const free = simulate({ ...base, incomeStreams: [{ ...pension, taxType: "free" }] });
    expect(lastTotal(free)).toBeGreaterThan(lastTotal(ordinary));
  });

  it("pension income raises the tax on 401k draws (stacks below them)", () => {
    // Identical NET cash needs; the pension run's 401k draws start higher in
    // the brackets. Compare against a tax-free stream (same cash, no stacking).
    const highSpend = { ...base, monthlyExpense: 14_000, k401: 3_000_000 };
    const ordinary = simulate({ ...highSpend, incomeStreams: [pension] });
    const free = simulate({ ...highSpend, incomeStreams: [{ ...pension, taxType: "free" }] });
    // Free stream: no tax on the stream AND cheaper 401k draws → strictly richer.
    expect(lastTotal(free)).toBeGreaterThan(lastTotal(ordinary));
  });

  it("streams end at endAge", () => {
    const forever = simulate({ ...base, incomeStreams: [pension] });
    const decade = simulate({ ...base, incomeStreams: [{ ...pension, endAge: 75 }] });
    expect(lastTotal(forever)).toBeGreaterThan(lastTotal(decade));
  });

  it("excess stream income banks into cash instead of vanishing", () => {
    // Pension larger than spending: wealth must GROW relative to no pension.
    const modest = { ...base, monthlyExpense: 3000 };
    const withBig = simulate({ ...modest, incomeStreams: [{ label: "fat pension", monthly: 6000, startAge: 60, taxType: "free" }] });
    const without = simulate({ ...modest });
    expect(lastTotal(withBig)).toBeGreaterThan(lastTotal(without) + 100_000);
  });

  it("pension raises IRMAA under autoMedicare (MAGI lookback sees it)", () => {
    const p = { ...base, autoMedicare: true, monthlyExpense: 5000 };
    const bigPension = { label: "exec pension", monthly: 20_000, startAge: 63, taxType: "ordinary" };
    const withP = simulate({ ...p, incomeStreams: [bigPension] });
    const withFree = simulate({ ...p, incomeStreams: [{ ...bigPension, taxType: "free" }] });
    // Ordinary pension MAGI (~240k) trips IRMAA tiers at 65+; the tax-free twin doesn't.
    // Isolate the Medicare effect by differencing each against its no-medicare twin.
    const withPOff = simulate({ ...p, autoMedicare: false, incomeStreams: [bigPension] });
    const withFreeOff = simulate({ ...p, autoMedicare: false, incomeStreams: [{ ...bigPension, taxType: "free" }] });
    const ordMedicareCost = lastTotal(withPOff) - lastTotal(withP);
    const freeMedicareCost = lastTotal(withFreeOff) - lastTotal(withFree);
    expect(ordMedicareCost).toBeGreaterThan(freeMedicareCost + 5_000);
  });
});

describe("expense streams", () => {
  const rich = { ...base, k401: 3_500_000 }; // survives all variants below

  it("a mortgage that ends beats the same cost baked into base spend forever", () => {
    const mortgage = { label: "mortgage", monthly: 2500, endAge: 72, inflate: false };
    const asStream = simulate({ ...rich, expenseStreams: [mortgage] });
    const baked = simulate({ ...rich, monthlyExpense: rich.monthlyExpense + 2500 });
    expect(lastTotal(asStream)).toBeGreaterThan(lastTotal(baked));
  });

  it("non-inflating streams cost less than inflating ones", () => {
    const flat = simulate({ ...rich, expenseStreams: [{ monthly: 2000, endAge: 85, inflate: false }] });
    const inflating = simulate({ ...rich, expenseStreams: [{ monthly: 2000, endAge: 85, inflate: true }] });
    expect(lastTotal(flat)).toBeGreaterThan(lastTotal(inflating));
  });
});

describe("windfalls (negative one-time amounts)", () => {
  it("a windfall banks into cash and raises end wealth", () => {
    const without = simulate({ ...base });
    const withWindfall = simulate({ ...base, oneTimeExpenses: [{ age: 70, amount: -300_000 }] });
    expect(lastTotal(withWindfall)).toBeGreaterThan(lastTotal(without) + 250_000);
  });

  it("simParamsAt passes negative amounts through (today's-$ inflation applied)", () => {
    const plan = makePlan({ oneTimeExpenses: [{ age: 70, amount: -100_000 }] });
    const params = simParamsAt(plan, plan.retireAge);
    expect(params.oneTimeExpenses.length).toBe(1);
    expect(params.oneTimeExpenses[0].amount).toBeLessThan(-100_000); // inflated magnitude
  });
});

describe("streams through the analysis pipeline", () => {
  it("simParamsAt scales cola streams to retire-date $ but passes nominal ones through", () => {
    const plan = makePlan({
      incomeStreams: [
        { label: "real", monthly: 1000, startAge: 65, cola: true },
        { label: "nominal", monthly: 1000, startAge: 65 },
      ],
    });
    const params = simParamsAt(plan, plan.retireAge);
    const real = params.incomeStreams.find((s) => s.label === "real");
    const nominal = params.incomeStreams.find((s) => s.label === "nominal");
    expect(real.monthly).toBeGreaterThan(1000);
    expect(nominal.monthly).toBe(1000);
  });
});
