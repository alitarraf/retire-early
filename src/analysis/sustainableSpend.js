// Maximize mode: max monthly spend (at retirement) where money still
// lasts to life expectancy. Binary search over the full simulation.

import { simulate } from "../engine/simulate.js";
import { projectAtRetirement } from "./plan.js";

export function sustainableSpend(plan, { iterations = 24, lo = 1000, hi = 50000 } = {}) {
  const proj = projectAtRetirement(plan);
  let low = lo;
  let high = hi;
  let result = plan.monthlyAtRetirement;
  for (let i = 0; i < iterations; i++) {
    const mid = (low + high) / 2;
    const { depleted } = simulate({
      retireAge: plan.retireAge,
      lifeExpect: plan.lifeExpect,
      ssAge: plan.ssAge,
      monthlyExpense: mid,
      inflationRate: plan.inflationRate,
      stockReturn: plan.stockReturn,
      ...proj,
      brokerageLtcgRate: plan.brokerageLtcgRate,
      stateTaxRate: plan.effectiveStateTax,
      ssBenefit: plan.ssBenefit,
      ss2Benefit: plan.ss2Benefit,
      ss2Age: plan.ss2Age,
      annualRothConversion: plan.annualRothConversion,
      filingStatus: plan.filingStatus,
    });
    if (depleted === null) {
      result = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return result;
}
