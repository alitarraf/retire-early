// ─────────────────────────────────────────────────────────────
//  Dynamic multi-year Roth conversion optimizer (Maximize mode).
//
//  Upgrades the single-amount grid search (optimalConversion.js) to a
//  multi-year "fill to top of X% bracket each year" strategy. For each
//  candidate bracket ceiling it runs the full (accurate) simulation —
//  with conversions allowed across a window (retireAge → ~72) so the
//  benefit of shrinking future RMDs is captured — and keeps the ceiling
//  that maximizes the net estate at life expectancy (step-up applied).
//
//  Pure: it only calls runMain() with overrides; the engine stays pure.
// ─────────────────────────────────────────────────────────────

import { runMain } from "./plan.js";
import { FED_BRACKETS } from "../constants/brackets.js";

// Net estate at death = final portfolio total minus any embedded LTCG tax (step-up off).
const netEstate = (res) =>
  res && res.snaps.length ? res.snaps[res.snaps.length - 1].total - (res.estateGainTax || 0) : 0;

const k401At = (res, age) =>
  res.snaps.find((s) => s.age === age)?.k401 ?? res.snaps[res.snaps.length - 1]?.k401 ?? 0;

/**
 * @param {object} plan
 * @param {object} [options]
 * @param {number} [options.windowEnd]  Last age (exclusive) to convert through. Default min(72, lifeExpect-1).
 * @returns {{
 *   type: "fill"|"none", ceiling: number, rate: number, endAge: number,
 *   estateBase: number, estateWith: number, gain: number,
 *   schedule: Array<{age:number, amount:number}>, totalConverted: number,
 *   rmdReduction: number, rmdAge: number,
 * }}
 */
export function dynamicOptimizer(plan, { windowEnd } = {}) {
  const endAge = windowEnd ?? Math.max(plan.retireAge + 1, Math.min(72, plan.lifeExpect - 1));

  // Baseline: no conversions at all.
  const base = runMain(plan, { annualRothConversion: 0, conversionCeiling: 0 });
  const estateBase = base ? netEstate(base) : 0;

  // Candidate ceilings: the tops of the 10/12/22/24% federal bands for this filing status.
  // (Filling above 24% is rarely worthwhile and the search stays cheap — ~4 simulations.)
  const brackets = FED_BRACKETS[plan.filingStatus] ?? FED_BRACKETS.mfj;
  const candidates = brackets.filter((b) => Number.isFinite(b.upTo) && b.rate <= 0.24);

  let best = { type: "none", ceiling: 0, rate: 0, res: base, estate: estateBase };
  for (const b of candidates) {
    const res = runMain(plan, {
      annualRothConversion: 0,
      conversionCeiling: b.upTo,
      conversionEndAge: endAge,
    });
    const estate = netEstate(res);
    // Require a real improvement (>$1) so floating-point noise never "wins".
    if (estate > best.estate + 1) best = { type: "fill", ceiling: b.upTo, rate: b.rate, res, estate };
  }

  const schedule = best.type === "fill" ? best.res.conversions ?? [] : [];
  const totalConverted = schedule.reduce((s, e) => s + e.amount, 0);

  // RMD-reduction insight: 401k balance at the user's RMD start age, baseline vs optimized.
  const rmdAge = plan.rmdAge ?? 73;
  const rmdReduction =
    best.type === "fill" ? Math.max(0, k401At(base, rmdAge) - k401At(best.res, rmdAge)) : 0;

  return {
    type: best.type,
    ceiling: best.ceiling,
    rate: best.rate,
    endAge,
    estateBase,
    estateWith: best.estate,
    gain: best.estate - estateBase,
    schedule,
    totalConverted,
    rmdReduction,
    rmdAge,
  };
}
