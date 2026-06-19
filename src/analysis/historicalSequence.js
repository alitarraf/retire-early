// ─────────────────────────────────────────────────────────────
//  Historical sequence test: replay a real bad market sequence (e.g.
//  retiring into 2000, 2007, 2022, or 1973) through the drawdown sim.
//  A generalization of stressTest — instead of a synthetic early crash,
//  the per-year returns come from the HISTORICAL_RETURNS table. Once the
//  recorded history runs out (retirement outlasts the data), it reverts
//  to the user's mean return, exactly like stressTest's post-crash tail.
//  Reuses simulate()'s `returnSeries` hook — the engine stays pure.
// ─────────────────────────────────────────────────────────────

import { simulate } from "../engine/simulate.js";
import { HISTORICAL_RETURNS } from "../constants/historicalReturns.js";

/**
 * Run one simulation replaying actual returns from `startYear` onward.
 *
 * @param {object} simParams  Full simulate() parameter object (mean return in stockReturn).
 * @param {object} options
 * @param {number} options.startYear  First retirement year (e.g. 2007).
 * @param {"sp"|"balanced"} options.lens  Which return series to apply.
 * @returns {ReturnType<typeof simulate>} The simulate() result under the historical sequence.
 */
export function historicalSequence(simParams, { startYear, lens = "balanced" } = {}) {
  const span = simParams.lifeExpect - simParams.retireAge;
  const mean = simParams.stockReturn;
  const returnSeries = Array.from(
    { length: span },
    (_, i) => HISTORICAL_RETURNS[startYear + i]?.[lens] ?? mean, // revert to mean past recorded history
  );
  return simulate({ ...simParams, returnSeries });
}
