// Earliest age at which the plan survives to life expectancy.
// Scans candidate ages calling the same engine as the verdict, so the
// two can never disagree (invariant D). Optional `overrides` let the
// sensitivity analysis re-run the search under a tweaked scenario.

import { survivesAt } from "./plan.js";

export function earliestRetireAge(plan, { min, max = 75, overrides = {} } = {}) {
  // Floor at currentAge so an already-retired user (retireAge == currentAge)
  // can be found to "retire now" — otherwise the search would skip their
  // actual retire age and falsely report they need another year.
  const start = min ?? plan.currentAge;
  for (let age = start; age <= max; age++) {
    if (survivesAt(plan, age, overrides)) return age;
  }
  return null;
}
