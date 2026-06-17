// M4 — Monte Carlo wrapper. Keeps simulate() pure; injects per-year return series.

import { simulate } from "./simulate.js";

// Box-Muller normal sample from the provided rng function.
function stdNormal(rng) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-10, rng()))) * Math.cos(2 * Math.PI * rng());
}

/**
 * Run `n` stochastic simulations with normally-distributed annual returns.
 *
 * @param {object} simParams     Full simulate() parameter object; stockReturn is the mean return.
 * @param {object} options
 * @param {number} options.n              Number of runs (default 1000).
 * @param {number} options.stockReturnStd Annual return std-dev in percent (default 12).
 * @param {number|null} options.seed      Integer seed for deterministic output; null = random.
 * @returns {{ successRate: number, medianEndTotal: number, depletionAges: Array<number|null> }}
 */
export function monteCarlo(simParams, { n = 1000, stockReturnStd = 12, seed = null } = {}) {
  // Park-Miller LCG for a seeded, deterministic, portable RNG.
  let state = seed !== null ? ((seed % 2147483646) + 1) : (Math.floor(Math.random() * 2147483646) + 1);
  const lcg = () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
  const rng = seed !== null ? lcg : Math.random;

  const years = simParams.lifeExpect - simParams.retireAge;
  const mean = simParams.stockReturn;
  const depletionAges = [];
  const endTotals = [];
  let successes = 0;

  for (let i = 0; i < n; i++) {
    const returnSeries = Array.from({ length: years }, () => mean + stockReturnStd * stdNormal(rng));
    const result = simulate({ ...simParams, returnSeries });
    depletionAges.push(result.depleted);
    endTotals.push(result.snaps.at(-1)?.total ?? 0);
    if (result.depleted === null) successes++;
  }

  endTotals.sort((a, b) => a - b);
  return {
    successRate: successes / n,
    medianEndTotal: endTotals[Math.floor(n / 2)],
    depletionAges,
  };
}
