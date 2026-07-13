// ─────────────────────────────────────────────────────────────
//  Asset allocation & risk glide path. Pure functions, no React.
//
//  The model's "growth" accounts (401k, Roth, brokerage, HSA) grow at a
//  single stockReturn today. This module lets that return be a BLEND of
//  equity / bond / cash whose equity share glides down with age, chosen by
//  a risk profile — a target-date-style glide. Dedicated cash (CD) and muni
//  sleeves keep their own yields; the glide governs only the growth pool.
//
//  Everything here is opt-in: consumers gate on `plan.allocationEnabled`.
//  When off, the engine uses the flat stockReturn exactly as before.
// ─────────────────────────────────────────────────────────────

// Small fixed cash slice inside the non-equity remainder; the rest is bonds.
const CASH_FLOOR = 0.05;

// Risk presets: equity share glides linearly from `startEquity` (at/below
// GLIDE_START_AGE) down to `endEquity` (at/above GLIDE_END_AGE), then holds.
export const GLIDE_START_AGE = 30;
export const GLIDE_END_AGE = 75;

export const RISK_PROFILES = {
  conservative: { label: "Conservative", startEquity: 0.60, endEquity: 0.30 },
  moderate: { label: "Moderate", startEquity: 0.90, endEquity: 0.45 },
  aggressive: { label: "Aggressive", startEquity: 1.0, endEquity: 0.60 },
};

export const RISK_PROFILE_KEYS = Object.keys(RISK_PROFILES); // for schema enums / validation

/** Clamp a number into [lo, hi]. */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Equity share for a risk profile at a given age (linear glide, then flat). */
export function equityShareAt(age, profileKey) {
  const p = RISK_PROFILES[profileKey] ?? RISK_PROFILES.moderate;
  if (age <= GLIDE_START_AGE) return p.startEquity;
  if (age >= GLIDE_END_AGE) return p.endEquity;
  const t = (age - GLIDE_START_AGE) / (GLIDE_END_AGE - GLIDE_START_AGE);
  return p.startEquity + (p.endEquity - p.startEquity) * t;
}

/** Split an equity share into { equity, bond, cash } fractions summing to 1. */
function splitFromEquity(equity) {
  const e = clamp(equity, 0, 1);
  const nonEquity = 1 - e;
  const cash = Math.min(nonEquity, CASH_FLOOR);
  const bond = nonEquity - cash;
  return { equity: e, bond, cash };
}

/**
 * The { equity, bond, cash } allocation for a plan at a given age.
 * Custom / pinned plans hold a fixed mix (no glide); named profiles glide.
 */
export function allocationAt(plan, age) {
  const pinned = plan.riskProfile === "custom" || plan.pinAllocation;
  if (pinned) {
    const e = (plan.equityPct ?? 60) / 100;
    const b = (plan.bondPct ?? 35) / 100;
    const c = (plan.cashPct ?? 5) / 100;
    const sum = e + b + c;
    // Normalize defensively so a slightly-off pin still sums to 1.
    return sum > 0 ? { equity: e / sum, bond: b / sum, cash: c / sum } : splitFromEquity(0.6);
  }
  return splitFromEquity(equityShareAt(age, plan.riskProfile));
}

/**
 * Blended annual return (percent) for a { equity, bond, cash } split, given the
 * plan's per-asset return assumptions. Equity → stockReturn, bond → bondReturn,
 * cash → the nominal CD rate.
 */
export function blendedReturn(split, plan) {
  return (
    split.equity * plan.stockReturn +
    split.bond * (plan.bondReturn ?? 0) +
    split.cash * (plan.cashDepositRate ?? 0)
  );
}

/** Blended growth-pool return (percent) for a plan at a given age. */
export function blendedReturnAt(plan, age) {
  return blendedReturn(allocationAt(plan, age), plan);
}

/**
 * Per-year blended returns (percent) over a horizon, indexed 0..span-1, where
 * entry i is the blend at `startAge + i`. Used to build both the accumulation
 * growth factors and the drawdown returnSeries.
 */
export function glideReturnSeries(plan, startAge, span) {
  return Array.from({ length: Math.max(0, span) }, (_, i) => blendedReturnAt(plan, startAge + i));
}
