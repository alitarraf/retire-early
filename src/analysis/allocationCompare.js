// Allocation payoff: earliest safe retirement age at each named risk profile.
// Feeds the AllocationCard's three-profile comparison — the honest framing of
// "allocation is a tool to answer WHEN can I retire" (PRD §UI). We force the
// glide ON for every row (allocationEnabled:true, pinAllocation:false) so the
// comparison is apples-to-apples regardless of the user's current toggle.
//
// This lives in the analysis layer (it calls earliestRetireAge + makePlan);
// the pure glide math stays in engine/allocation.js.

import { makePlan } from "./plan.js";
import { earliestRetireAge } from "./earliestRetireAge.js";
import { RISK_PROFILE_KEYS } from "../engine/allocation.js";

/**
 * Earliest safe retirement age for each risk profile, all with the glide on.
 * @param {object} rawInputs  Un-normalized UI inputs (same shape makePlan takes).
 * @param {object} opts       Forwarded to earliestRetireAge (e.g. { max }).
 * @returns {{ conservative: number|null, moderate: number|null, aggressive: number|null }}
 */
export function profileEarliestAges(rawInputs, opts = {}) {
  const out = {};
  for (const key of RISK_PROFILE_KEYS) {
    const plan = makePlan({
      ...rawInputs,
      allocationEnabled: true,
      riskProfile: key,
      pinAllocation: false,
    });
    out[key] = earliestRetireAge(plan, opts);
  }
  return out;
}
