// ─────────────────────────────────────────────────────────────
//  Deterministic stress test: a single bad-sequence run where the
//  market drops sharply in the first few retirement years, then
//  reverts to the mean. This isolates sequence-of-returns risk in a
//  reproducible way (unlike Monte Carlo, which averages over many
//  random paths). Reuses simulate()'s `returnSeries` hook — the
//  engine stays pure.
// ─────────────────────────────────────────────────────────────

import { simulate } from "../engine/simulate.js";

/**
 * Run one simulation with an early crash sequence.
 *
 * @param {object} simParams  Full simulate() parameter object (mean return in stockReturn).
 * @param {object} options
 * @param {number} options.dropPct  Annual return (%) during the crash years (e.g. -30).
 * @param {number} options.years    Number of consecutive early-crash years.
 * @returns {ReturnType<typeof simulate>} The simulate() result under the stress sequence.
 */
export function stressTest(simParams, { dropPct = 30, years = 3 } = {}) {
  const span = simParams.lifeExpect - simParams.retireAge;
  // Post-crash years revert to the mean — the per-year glide mean when an
  // allocation series is present, else the flat stockReturn (legacy).
  const base = simParams.returnSeries;
  const meanAt = (i) => base?.[i] ?? simParams.stockReturn;
  const crash = -Math.abs(dropPct);
  const returnSeries = Array.from({ length: span }, (_, i) => (i < years ? crash : meanAt(i)));
  return simulate({ ...simParams, returnSeries });
}
