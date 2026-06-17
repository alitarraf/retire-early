// Earliest age at which the plan survives to life expectancy.
// Scans candidate ages calling the same engine as the verdict, so the
// two can never disagree (invariant D). Optional `overrides` let the
// sensitivity analysis re-run the search under a tweaked scenario.

import { survivesAt } from "./plan.js";

export function earliestRetireAge(plan, { min, max = 75, overrides = {} } = {}) {
  const start = min ?? plan.currentAge + 1;
  for (let age = start; age <= max; age++) {
    if (survivesAt(plan, age, overrides)) return age;
  }
  return null;
}
