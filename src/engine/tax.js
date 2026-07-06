// ─────────────────────────────────────────────────────────────
//  Federal income-tax helpers. Pure functions, filing-status aware.
//  All rates returned as decimals (e.g. 0.12 for 12%).
// ─────────────────────────────────────────────────────────────

import {
  FED_BRACKETS,
  STD_DEDUCTION,
  DEFAULT_FILING_STATUS,
  SS_PROVISIONAL_THRESHOLDS,
  LTCG_BRACKETS,
  NIIT,
} from "../constants/brackets.js";

function bracketsFor(filingStatus) {
  return FED_BRACKETS[filingStatus] ?? FED_BRACKETS[DEFAULT_FILING_STATUS];
}

function deductionFor(filingStatus) {
  return STD_DEDUCTION[filingStatus] ?? STD_DEDUCTION[DEFAULT_FILING_STATUS];
}

// `indexFactor` scales bracket tops and the standard deduction to a future
// tax year (IRS inflation adjustments): 1 = TAX_YEAR as published.
function applyBrackets(income, filingStatus, indexFactor = 1) {
  const taxable = Math.max(0, income - deductionFor(filingStatus) * indexFactor);
  if (taxable <= 0 || income <= 0) return 0;
  let tax = 0, prev = 0;
  for (const { upTo, rate } of bracketsFor(filingStatus)) {
    const top = upTo * indexFactor;
    const chunk = Math.min(taxable - prev, top - prev);
    if (chunk <= 0) break;
    tax += chunk * rate;
    prev = top;
    if (prev >= taxable) break;
  }
  return tax;
}

/** Dollar amount of federal income tax on `income`, after the standard deduction. */
export function federalTax(income, filingStatus = DEFAULT_FILING_STATUS, indexFactor = 1) {
  return applyBrackets(income, filingStatus, indexFactor);
}

/**
 * Blended (effective) federal rate on a withdrawal/income amount,
 * after the standard deduction. Returns tax / gross.
 */
export function effectiveFedRate(income, filingStatus = DEFAULT_FILING_STATUS, indexFactor = 1) {
  if (income <= 0) return 0;
  return applyBrackets(income, filingStatus, indexFactor) / income;
}

/**
 * Annual taxable Social Security amount under IRC §86 provisional income rules.
 * `otherOrdinaryIncome` is annual income from all sources except SS (e.g. 401k draws).
 * The provisional thresholds are deliberately NOT inflation-indexed — they are
 * frozen in law (unchanged since 1983/1993), so no indexFactor applies here.
 */
export function taxableSsAmount(annualGrossSS, otherOrdinaryIncome, filingStatus = DEFAULT_FILING_STATUS) {
  if (annualGrossSS <= 0) return 0;
  const [t1, t2] = SS_PROVISIONAL_THRESHOLDS[filingStatus] ?? SS_PROVISIONAL_THRESHOLDS.single;
  const pi = otherOrdinaryIncome + 0.5 * annualGrossSS;
  if (pi <= t1) return 0;
  if (pi <= t2) return Math.min(0.5 * annualGrossSS, 0.5 * (pi - t1));
  const below50 = Math.min(0.5 * annualGrossSS, 0.5 * (t2 - t1));
  return Math.min(0.85 * annualGrossSS, below50 + 0.85 * (pi - t2));
}

/**
 * Top (marginal) bracket rate at a given income level, after the
 * standard deduction. Used for Roth-conversion cost.
 */
/**
 * Federal LTCG rate for gains stacked on top of `ordinaryGrossIncome`
 * (pre-deduction). Gains sit above ordinary taxable income in the LTCG
 * brackets; this returns the rate at that stacking point. A gain large
 * enough to straddle a breakpoint is approximated at the single rate where
 * the stack begins (the engine applies one effective rate per year).
 * LTCG thresholds are IRS inflation-indexed, so `indexFactor` applies.
 */
export function ltcgRateAt(ordinaryGrossIncome, filingStatus = DEFAULT_FILING_STATUS, indexFactor = 1) {
  const brackets = LTCG_BRACKETS[filingStatus] ?? LTCG_BRACKETS[DEFAULT_FILING_STATUS];
  const ordTaxable = Math.max(0, ordinaryGrossIncome - deductionFor(filingStatus) * indexFactor);
  for (const { upTo, rate } of brackets) {
    if (ordTaxable < upTo * indexFactor) return rate;
  }
  return brackets[brackets.length - 1].rate;
}

/** True when MAGI crosses the (non-indexed) NIIT threshold for the filing status. */
export function niitApplies(magi, filingStatus = DEFAULT_FILING_STATUS) {
  return magi > (NIIT.threshold[filingStatus] ?? NIIT.threshold[DEFAULT_FILING_STATUS]);
}

export function marginalFedRate(income, filingStatus = DEFAULT_FILING_STATUS, indexFactor = 1) {
  const taxable = Math.max(0, income - deductionFor(filingStatus) * indexFactor);
  for (const { upTo, rate } of bracketsFor(filingStatus)) {
    if (taxable <= upTo * indexFactor) return rate;
  }
  return 0.37;
}
