// ─────────────────────────────────────────────────────────────
//  Account growth / contribution math. Pure functions.
// ─────────────────────────────────────────────────────────────

/**
 * Suffix growth factors for a horizon where each year can have its own rate.
 * g[y] = Π_{t=y..years} (1 + rate(t)/100), for y in 1..years (g[1] is the
 * full-horizon factor for an existing balance). `rate` is a function taking a
 * 1-based year index and returning that year's return in percent.
 */
export function growthFactors(years, rate) {
  const g = new Array(years + 2).fill(1);
  for (let y = years; y >= 1; y--) g[y] = g[y + 1] * (1 + rate(y) / 100);
  return g;
}

/**
 * Future value of a stream of annual contributions, each compounding
 * for its remaining years to the horizon. This is what makes ongoing
 * 401k/Roth contributions actually count.
 *
 * `rate` is normally a scalar percent (legacy). Pass a function (1-based year
 * index → percent) to compound each contribution along a per-year glide path;
 * the scalar path is left untouched so legacy numbers reproduce byte-for-byte.
 */
export function fvAnnuity(annualContrib, years, rate) {
  if (years <= 0 || annualContrib <= 0) return 0;
  if (typeof rate === "function") {
    const g = growthFactors(years, rate);
    let fv = 0;
    for (let y = 1; y <= years; y++) fv += annualContrib * g[y];
    return fv;
  }
  const r = rate / 100;
  let fv = 0;
  for (let y = 1; y <= years; y++) {
    fv += annualContrib * Math.pow(1 + r, years - y + 1);
  }
  return fv;
}

/**
 * Estimate how much of an existing Roth balance is contributions vs.
 * earnings, from annualContributed × yearsContributed, capped at total.
 */
export function splitRoth(total, annualContrib, yearsContrib) {
  if (total <= 0) return { contributions: 0, earnings: 0 };
  const contributions = Math.min(total, annualContrib * yearsContrib);
  return { contributions, earnings: Math.max(0, total - contributions) };
}
