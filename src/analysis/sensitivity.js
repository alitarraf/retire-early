// Sensitivity analysis (Retire Early mode): each lever changes one
// thing and re-runs the full earliest-age search. delta = years gained
// (positive) vs the baseline earliest age. Overrides are threaded
// straight through the engine (projection + simulation) so each row is
// a real, fully-simulated scenario.

import { earliestRetireAge } from "./earliestRetireAge.js";

export function sensitivity(plan) {
  const base = earliestRetireAge(plan);
  // `ov` drives the simulated preview (engine-override namespace: rothAnnual,
  // muniAdd, …). `apply` is the equivalent patch in the *raw inputs* namespace,
  // so clicking a lever writes a real, persistent input change (e.g. an extra
  // Roth override of `7500 - current` maps to setting rothAnnualContrib = 7500).
  const spend = (n) => ({
    ov: { monthlyExpense: Math.max(500, plan.monthlyExpense - n) },
    apply: { monthlyExpense: Math.max(500, plan.monthlyExpense - n) },
  });
  const levers = [
    { label: "SS +$500/mo", ov: { ssBenefit: plan.ssBenefit + 500 }, apply: { ssBenefit: plan.ssBenefit + 500 } },
    { label: "SS +$1,000/mo", ov: { ssBenefit: plan.ssBenefit + 1000 }, apply: { ssBenefit: plan.ssBenefit + 1000 } },
    { label: "Spend −$500/mo", ...spend(500) },
    { label: "Spend −$1,000/mo", ...spend(1000) },
    { label: "Spend −$2,000/mo", ...spend(2000) },
    // Guard the apply against the no-change case: the preview only ever *adds*
    // toward 7500 (ov = max(0, 7500 - current)), so apply must never lower an
    // already-higher contribution — that would silently contradict a "—" row.
    { label: "Max Roth $7.5k/yr", ov: { rothAnnual: Math.max(0, 7500 - plan.rothAnnualContrib) }, apply: { rothAnnualContrib: Math.max(plan.rothAnnualContrib, 7500) } },
    { label: "Add $50k munis", ov: { muniAdd: 50000 }, apply: { muniBonds: plan.muniBonds + 50000 } },
    { label: "Take SS at 62", ov: { ssAge: 62, ssBenefit: plan.ssBenefit * 0.7 }, apply: { ssAge: 62, ssBenefit: plan.ssBenefit * 0.7 } },
  ];

  return levers.map(({ label, ov, apply }) => {
    const newEarliest = earliestRetireAge(plan, { max: 75, overrides: ov });
    const delta = newEarliest !== null && base !== null ? base - newEarliest : null;
    return { label, newEarliest, delta, apply };
  });
}
