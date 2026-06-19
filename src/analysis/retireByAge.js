// Retire Early goal-seek: given a target retirement age, solve for the extra
// taxable-brokerage savings needed to make it work — plus the alternative
// lever (trim retirement spend). Mirrors sustainableSpend's binary search, but
// solves for savings instead of spend.
//
// The success oracle requires BOTH no depletion AND no bridge shortfall:
// for an early target the 401k is locked until 59½, so money stranded there
// does not count toward making the bridge years work. Using survival alone
// (depleted === null) would understate the savings needed.

import { runAt } from "./plan.js";

const SAVINGS_CAP = 1_000_000; // ceiling for the extra-savings search ($/yr)
const ITERATIONS = 24;

// Reaches the target = survives to life expectancy AND the pre-59½ bridge
// never runs short. (Same oracle as survivesAt in plan.js.)
function reaches(plan, age, overrides) {
  const res = runAt(plan, age, overrides);
  return res !== null && res.depleted === null && res.bridgeShortfall === 0;
}

// Max today's-$ monthly spend that still reaches the target age with current
// savings. `mid` is a today's-$ value; runAt → simParamsAt inflates it to the
// target date, so the returned figure is comparable to the user's expense input.
function maxSpendToday(plan, targetAge) {
  let lo = 0;
  let hi = plan.monthlyExpense;
  let result = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (reaches(plan, targetAge, { monthlyExpense: mid })) {
      result = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return result;
}

export function retireByAge(plan, targetAge) {
  // What the user saves per year (their own contributions, excluding employer match).
  const currentSavingsAnnual =
    (plan.k401AnnualContrib ?? 0) + (plan.rothAnnualContrib ?? 0) + (plan.hsaAnnualContrib ?? 0) +
    ((plan.brokerageMonthlyContrib ?? 0) + (plan.cashMonthlyContrib ?? 0) + (plan.muniMonthlyContrib ?? 0)) * 12;

  const base = {
    targetAge,
    runway: targetAge > plan.currentAge,
    onTrack: false,
    feasible: false,
    extraAnnual: 0,
    extraMonthly: 0,
    pctSalary: 0,
    altSpendMonthlyToday: null,
    currentMonthlySavings: currentSavingsAnnual / 12,
  };

  // No runway: retiring at/before today can't be fixed by saving more now.
  if (!base.runway) return base;

  // Already on track with current savings and spend?
  if (reaches(plan, targetAge, {})) {
    return { ...base, onTrack: true, feasible: true };
  }

  // Binary-search the minimal extra brokerage savings that reaches the target.
  let sol = null;
  if (reaches(plan, targetAge, { brokerageAnnual: SAVINGS_CAP })) {
    let lo = 0;
    let hi = SAVINGS_CAP;
    for (let i = 0; i < ITERATIONS; i++) {
      const mid = (lo + hi) / 2;
      if (reaches(plan, targetAge, { brokerageAnnual: mid })) {
        sol = mid;
        hi = mid;
      } else {
        lo = mid;
      }
    }
  }

  const altSpendMonthlyToday = maxSpendToday(plan, targetAge);

  // Even the search cap can't reach it — surface only the spend trade-off.
  if (sol == null) {
    return { ...base, feasible: false, altSpendMonthlyToday };
  }

  return {
    ...base,
    feasible: true,
    extraAnnual: sol,
    extraMonthly: sol / 12,
    pctSalary: plan.salary > 0 ? (sol / plan.salary) * 100 : 0,
    altSpendMonthlyToday,
  };
}
