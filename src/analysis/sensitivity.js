// Sensitivity analysis (Retire Early mode): each lever changes one
// thing and re-runs the full earliest-age search. delta = years gained
// (positive) vs the baseline earliest age. Overrides are threaded
// straight through the engine (projection + simulation) so each row is
// a real, fully-simulated scenario.

import { earliestRetireAge } from "./earliestRetireAge.js";

export function sensitivity(plan) {
  const base = earliestRetireAge(plan);
  const levers = [
    { label: "SS +$500/mo", ov: { ssBenefit: plan.ssBenefit + 500 } },
    { label: "SS +$1,000/mo", ov: { ssBenefit: plan.ssBenefit + 1000 } },
    { label: "Spend −$500/mo", ov: { monthlyExpense: Math.max(500, plan.monthlyExpense - 500) } },
    { label: "Spend −$1,000/mo", ov: { monthlyExpense: Math.max(500, plan.monthlyExpense - 1000) } },
    { label: "Spend −$2,000/mo", ov: { monthlyExpense: Math.max(500, plan.monthlyExpense - 2000) } },
    { label: "Max Roth $7.5k/yr", ov: { rothAnnual: Math.max(0, 7500 - plan.rothAnnualContrib) } },
    { label: "Add $50k munis", ov: { muniAdd: 50000 } },
    { label: "Take SS at 62", ov: { ssAge: 62, ssBenefit: plan.ssBenefit * 0.7 } },
  ];

  return levers.map(({ label, ov }) => {
    const newEarliest = earliestRetireAge(plan, { max: 75, overrides: ov });
    const delta = newEarliest !== null && base !== null ? base - newEarliest : null;
    return { label, newEarliest, delta };
  });
}
