// Maximize mode: max monthly spend (at retirement) where money still
// lasts to life expectancy. Binary search over the FULL simulation pipeline
// (simParamsAt), so rule 55, SEPP, ACA, Medicare/IRMAA, RMDs, one-time
// expenses, phase multipliers and every other lever the main run models are
// respected — the number matches what the dashboard would actually show.
//
// Two deliberate choices:
//  - Success requires no depletion AND no bridge shortfall (mirrors
//    survivesAt): a spend level that silently starves the pre-59.5 bridge is
//    not "sustainable".
//  - Guardrails are zeroed inside the search: self-cutting spending rules
//    make "maximum sustainable spend" ill-defined (every level "survives" by
//    cutting itself).

import { simulate } from "../engine/simulate.js";
import { simParamsAt } from "./plan.js";

export function sustainableSpend(plan, { iterations = 24, lo = 1000, hi = 50000, overrides = {} } = {}) {
  const yrs = Math.max(0, plan.retireAge - plan.currentAge);
  const deflate = Math.pow(1 + plan.inflationRate / 100, yrs);
  const survives = (monthlyAtRetirement) => {
    const params = {
      ...simParamsAt(plan, plan.retireAge, { ...overrides, monthlyExpense: monthlyAtRetirement / deflate }),
      guardrailUpper: 0,
      guardrailLower: 0,
    };
    const { depleted, bridgeShortfall } = simulate(params);
    return depleted === null && bridgeShortfall === 0;
  };

  let low = lo;
  let high = hi;
  let result = 0; // stays 0 when even `lo` cannot be sustained
  for (let i = 0; i < iterations; i++) {
    const mid = (low + high) / 2;
    if (survives(mid)) {
      result = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return result;
}
