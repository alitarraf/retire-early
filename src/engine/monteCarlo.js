// M4 — Monte Carlo wrapper. Keeps simulate() pure; injects per-year return series.

import { simulate } from "./simulate.js";

// Box-Muller normal sample from the provided rng function.
function stdNormal(rng) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-10, rng()))) * Math.cos(2 * Math.PI * rng());
}

/**
 * Percentile of an already-ascending-sorted array using nearest-rank.
 * p is a fraction in [0,1]; p=0.05 → worst 5%, p=0.95 → best 5%.
 */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[idx];
}

/**
 * Bucket `values` into a histogram of length `bins`. Bin 0 is reserved for
 * *exactly* the depleted runs (end balance < $1, i.e. $0), flagged `depleted:true`;
 * the remaining `bins-1` bins are equal-width over (0, max] of the survivors.
 * Keeping the depleted set its own bin lets the chart honestly color it "depleted"
 * without sweeping low-but-surviving outcomes into the same bucket.
 * Returns [{ x0, x1, count, depleted? }].
 */
export function buildHistogram(values, bins = 12) {
  if (!values.length) return [];
  const survivors = values.filter((v) => v >= 1);
  const depleted = values.length - survivors.length;
  const sbins = Math.max(1, bins - 1);
  const max = Math.max(...survivors, 1);
  const width = max / sbins;
  const out = [{ x0: 0, x1: 0, count: depleted, depleted: true }];
  for (let i = 0; i < sbins; i++) out.push({ x0: i * width, x1: (i + 1) * width, count: 0 });
  for (const v of survivors) {
    let i = Math.floor(v / width); // index within survivor bins
    if (i >= sbins) i = sbins - 1;
    if (i < 0) i = 0;
    out[i + 1].count++; // +1 to skip the reserved depleted bin
  }
  return out;
}

/**
 * Fraction of runs that deplete strictly before `age`.
 * Only defined over runs that deplete at all; nulls (survivors) never count.
 */
export function pctDepletedBefore(depletionAges, age) {
  if (!depletionAges.length) return 0;
  const n = depletionAges.filter((a) => a !== null && a < age).length;
  return n / depletionAges.length;
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
  // Per-year mean: the allocation glide series when present, else flat stockReturn.
  const base = simParams.returnSeries;
  const meanAt = (i) => base?.[i] ?? simParams.stockReturn;
  const depletionAges = [];
  const endTotals = [];
  // Per-year total-portfolio value for every run, for the percentile fan chart.
  // All runs share the same horizon (retireAge→lifeExpect) and the engine always
  // pushes a snapshot per year ($0 after depletion), so trajectories align by index.
  const trajectories = [];
  let ages = [];
  let successes = 0;

  for (let i = 0; i < n; i++) {
    const returnSeries = Array.from({ length: years }, (_, y) => meanAt(y) + stockReturnStd * stdNormal(rng));
    const result = simulate({ ...simParams, returnSeries });
    depletionAges.push(result.depleted);
    endTotals.push(result.snaps.at(-1)?.total ?? 0);
    trajectories.push(result.snaps.map((s) => s.total));
    if (i === 0) ages = result.snaps.map((s) => s.age);
    if (result.depleted === null) successes++;
  }

  endTotals.sort((a, b) => a - b);
  return {
    n,
    successRate: successes / n,
    // Final-wealth percentiles are the robust outcome metric: every run has an end
    // total ($0 if depleted), unlike depletion-age percentiles which are only defined
    // over the subset that depletes. p10 = downside, p50 = median, p90 = upside.
    // medianEndTotal and p50EndTotal are the same value (the median estate).
    medianEndTotal: endTotals[Math.floor(n / 2)], // unchanged (backward compat)
    p10EndTotal: percentile(endTotals, 0.1),
    p50EndTotal: percentile(endTotals, 0.5),
    p90EndTotal: percentile(endTotals, 0.9),
    depletionRate: 1 - successes / n,
    depletionAges,
    histogram: buildHistogram(endTotals, 12),
    bands: percentileBands(trajectories, ages),
  };
}

/**
 * Per-year percentile bands across all run trajectories. Uses a 10th–90th cone
 * (rather than 5th–95th) so the shaded band stays representative on right-skewed
 * return distributions where the extreme tails run far from the center.
 * @param {number[][]} trajectories  one yearly-total array per run.
 * @param {number[]} ages            age at each year index (from any run).
 * @returns {Array<{ age, p10, p50, p90 }>}
 */
export function percentileBands(trajectories, ages) {
  if (!trajectories.length || !ages.length) return [];
  const span = Math.min(ages.length, ...trajectories.map((t) => t.length));
  const bands = [];
  for (let j = 0; j < span; j++) {
    const col = trajectories.map((t) => t[j] ?? 0).sort((a, b) => a - b);
    bands.push({
      age: ages[j],
      p10: percentile(col, 0.1),
      p50: percentile(col, 0.5),
      p90: percentile(col, 0.9),
    });
  }
  return bands;
}
