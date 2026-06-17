// Maximize mode: exhaustive search of annual Roth-conversion amounts
// ($0–$60k in $5k steps), picking the one that maximizes estate value
// at death. Runs the full simulation per candidate.

import { runMain } from "./plan.js";

export function optimalConversion(plan, { maxConv = 60000, step = 5000 } = {}) {
  const baseEnd = endTotal(runMain(plan, { annualRothConversion: 0 }));
  let best = { amount: 0, endVal: baseEnd };
  for (let conv = step; conv <= maxConv; conv += step) {
    const endVal = endTotal(runMain(plan, { annualRothConversion: conv }));
    if (endVal > best.endVal) best = { amount: conv, endVal };
  }
  return { ...best, baseEnd };
}

function endTotal(res) {
  if (!res || !res.snaps.length) return 0;
  return res.snaps[res.snaps.length - 1].total;
}
