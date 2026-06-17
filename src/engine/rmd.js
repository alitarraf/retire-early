// Pure RMD helpers. Traditional 401k/IRA only — Roth IRAs have no lifetime RMDs.

import { RMD_UNIFORM_LIFETIME } from "../constants/brackets.js";

/**
 * IRS Uniform Lifetime divisor for the given age.
 * Returns Infinity for ages below the table (no RMD required).
 */
export function rmdFactor(age) {
  return RMD_UNIFORM_LIFETIME[Math.floor(age)] ?? Infinity;
}
