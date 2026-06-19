// @vitest-environment node
// "Retire by a target age" goal-seek. The defining invariant: the solver must
// honor the pre-59½ bridge (bridgeShortfall === 0), not just survival — money
// stranded in a locked 401k does not count toward an early retirement.
import { describe, it, expect } from "vitest";
import { DEFAULTS, makePlan, runAt, projectTo } from "../analysis/plan.js";
import { retireByAge } from "../analysis/retireByAge.js";

// Age 30, all wealth in a 401k locked until 59½, target 40 → the bridge is the
// binding constraint.
const youngAll401k = makePlan({
  ...DEFAULTS, currentAge: 30, retireAge: 50, monthlyExpense: 6000, lifeExpect: 90,
  k401Today: 200000, k401AnnualContrib: 23000, rothTotal: 0, rothAnnualContrib: 0,
  existingBrokerage: 0, existingBrokerageBasis: 0, cashDeposit: 0, muniBonds: 0,
  hsaBalance: 0, hsaAnnualContrib: 0, ssBenefit: 2000, hasSpouse: false,
});

describe("retireByAge goal-seek", () => {
  it("honors the bridge: solver answer makes BOTH depleted null AND bridgeShortfall 0", () => {
    // With no extra savings the plan looks 'survivable' but the bridge fails.
    const noExtra = runAt(youngAll401k, 40, {});
    expect(noExtra.depleted).toBeNull();
    expect(noExtra.bridgeShortfall).toBeGreaterThan(0); // stranded in locked 401k

    const r = retireByAge(youngAll401k, 40);
    expect(r.feasible).toBe(true);
    expect(r.extraMonthly).toBeGreaterThan(0);

    const atSol = runAt(youngAll401k, 40, { brokerageAnnual: r.extraAnnual });
    expect(atSol.depleted).toBeNull();
    expect(atSol.bridgeShortfall).toBe(0);
  });

  it("closes the loop: entering the displayed (ceil) recommendation makes the plan on-track", () => {
    const r = retireByAge(youngAll401k, 40);
    expect(r.feasible).toBe(true);
    // EarlyPanel displays Math.ceil(extraMonthly); entering that must clear the bar
    // (rounding DOWN could leave the user just short and recompute a tiny residual).
    const displayed = Math.ceil(r.extraMonthly);
    const after = retireByAge(makePlan({
      ...DEFAULTS, currentAge: 30, retireAge: 50, monthlyExpense: 6000, lifeExpect: 90,
      k401Today: 200000, k401AnnualContrib: 23000, rothTotal: 0, rothAnnualContrib: 0,
      existingBrokerage: 0, existingBrokerageBasis: 0, cashDeposit: 0, muniBonds: 0,
      hsaBalance: 0, hsaAnnualContrib: 0, ssBenefit: 2000, hasSpouse: false,
      brokerageMonthlyContrib: displayed,
    }), 40);
    expect(after.onTrack).toBe(true);
  });

  it("requires MORE savings than a naive survival-only oracle would", () => {
    const r = retireByAge(youngAll401k, 40);
    // Survival-only minimum (ignoring the bridge) — the wrong answer.
    let lo = 0, hi = 1_000_000, survOnly = null;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (runAt(youngAll401k, 40, { brokerageAnnual: m }).depleted === null) { survOnly = m; hi = m; }
      else lo = m;
    }
    expect(r.extraAnnual).toBeGreaterThan(survOnly);
  });

  it("returns runway:false when the target age is not in the future", () => {
    const r = retireByAge(youngAll401k, 30);
    expect(r.runway).toBe(false);
    expect(r.feasible).toBe(false);
  });

  it("reports onTrack with $0 extra when already affordable", () => {
    const rich = makePlan({
      ...DEFAULTS, currentAge: 30, retireAge: 45, monthlyExpense: 2000,
      existingBrokerage: 2_000_000, existingBrokerageBasis: 2_000_000, k401Today: 0, hasSpouse: false,
    });
    const r = retireByAge(rich, 45);
    expect(r.onTrack).toBe(true);
    expect(r.extraMonthly).toBe(0);
  });

  it("flags infeasible targets and still returns a finite spend trade-off", () => {
    const tooAggressive = makePlan({
      ...DEFAULTS, currentAge: 38, retireAge: 40, monthlyExpense: 40000,
      k401Today: 0, existingBrokerage: 0, hasSpouse: false,
    });
    const r = retireByAge(tooAggressive, 40);
    expect(r.feasible).toBe(false);
    expect(Number.isFinite(r.altSpendMonthlyToday)).toBe(true);
    expect(r.altSpendMonthlyToday).toBeGreaterThanOrEqual(0);
  });

  it("projectTo brokerageAnnual adds the contributed principal to value AND basis", () => {
    const plan = makePlan({ ...DEFAULTS, existingBrokerage: 100000, existingBrokerageBasis: 100000 });
    const base = projectTo(plan, 10, {});
    const bumped = projectTo(plan, 10, { brokerageAnnual: 10000 });
    expect(bumped.brokerage).toBeGreaterThan(base.brokerage);
    // Basis grows by exactly the principal contributed (10k × 10 yrs), no phantom gain.
    expect(bumped.brokerageBasis).toBe(base.brokerageBasis + 100000);
  });
});

describe("monthly contributions flow through projectTo", () => {
  it("regression-zero: contributions at 0 leave projectTo output unchanged", () => {
    const before = projectTo(makePlan({ ...DEFAULTS }), 15, {});
    const after = projectTo(
      makePlan({ ...DEFAULTS, brokerageMonthlyContrib: 0, cashMonthlyContrib: 0, muniMonthlyContrib: 0 }),
      15, {},
    );
    expect(after).toEqual(before);
  });

  it("brokerageMonthlyContrib raises brokerage value AND basis by the principal (×12×yrs)", () => {
    const plan = makePlan({ ...DEFAULTS, existingBrokerage: 100000, existingBrokerageBasis: 100000, brokerageMonthlyContrib: 500 });
    const baseP = makePlan({ ...DEFAULTS, existingBrokerage: 100000, existingBrokerageBasis: 100000 });
    const base = projectTo(baseP, 10, {});
    const withC = projectTo(plan, 10, {});
    expect(withC.brokerage).toBeGreaterThan(base.brokerage);
    expect(withC.brokerageBasis).toBe(base.brokerageBasis + 500 * 12 * 10); // $60k principal
  });

  it("cash and muni monthly contributions raise their balances", () => {
    const cash = projectTo(makePlan({ ...DEFAULTS, cashMonthlyContrib: 300 }), 10, {});
    const cashBase = projectTo(makePlan({ ...DEFAULTS }), 10, {});
    expect(cash.cashDeposit).toBeGreaterThan(cashBase.cashDeposit);

    const muni = projectTo(makePlan({ ...DEFAULTS, muniBonds: 50000, muniMonthlyContrib: 200 }), 10, {});
    const muniBase = projectTo(makePlan({ ...DEFAULTS, muniBonds: 50000 }), 10, {});
    expect(muni.muniBonds).toBeGreaterThan(muniBase.muniBonds);
  });

  it("user brokerage contribution and goal-seek override stack additively in basis", () => {
    const plan = makePlan({ ...DEFAULTS, existingBrokerageBasis: 0, brokerageMonthlyContrib: 500 });
    const p = projectTo(plan, 10, { brokerageAnnual: 4000 });
    // (500×12 + 4000) × 10 = (6000 + 4000) × 10 = 100000
    expect(p.brokerageBasis).toBe(100000);
  });

  it("retireByAge currentMonthlySavings includes the new monthly contributions", () => {
    const plan = makePlan({
      ...DEFAULTS, currentAge: 35, retireAge: 55,
      k401AnnualContrib: 12000, rothAnnualContrib: 0, hsaAnnualContrib: 0,
      brokerageMonthlyContrib: 500, cashMonthlyContrib: 100, muniMonthlyContrib: 0,
    });
    const r = retireByAge(plan, 55);
    // 12000/12 + 500 + 100 = 1000 + 600 = 1600
    expect(Math.round(r.currentMonthlySavings)).toBe(1600);
  });
});
