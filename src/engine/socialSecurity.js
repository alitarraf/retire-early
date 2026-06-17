/**
 * IRS benefit adjustment factor for claiming Social Security before or after FRA.
 *
 * Before FRA: months 1–36 reduce at 5/9% per month; beyond 36 months at 5/12% per month.
 * After  FRA: increase at 2/3% per month (8%/yr), capped at age 70 (36 months max).
 *
 * @param {number} claimAge  Age when SS is claimed (e.g. 62, 67, 70).
 * @param {number} fra       Full Retirement Age (e.g. 67 for born 1960+).
 * @returns {number} Multiplier to apply to the PIA (Primary Insurance Amount).
 */
export function ssClaimFactor(claimAge, fra) {
  const monthsDiff = Math.round((claimAge - fra) * 12);
  if (monthsDiff >= 0) {
    // Delayed: +2/3% per month, capped at 36 months (age 70).
    return 1 + Math.min(monthsDiff, 36) * (2 / 300);
  }
  // Early: first 36 months at 5/9%/mo, additional months at 5/12%/mo.
  const monthsEarly = -monthsDiff;
  const first36 = Math.min(monthsEarly, 36) * (5 / 900);
  const beyond36 = Math.max(0, monthsEarly - 36) * (5 / 1200);
  return 1 - first36 - beyond36;
}
