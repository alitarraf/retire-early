// ─────────────────────────────────────────────────────────────
//  Account growth / contribution math. Pure functions.
// ─────────────────────────────────────────────────────────────

/**
 * Future value of a stream of annual contributions, each compounding
 * for its remaining years to the horizon. This is what makes ongoing
 * 401k/Roth contributions actually count.
 */
export function fvAnnuity(annualContrib, years, ratePct) {
  if (years <= 0 || annualContrib <= 0) return 0;
  const r = ratePct / 100;
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
