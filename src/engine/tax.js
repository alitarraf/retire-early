// ─────────────────────────────────────────────────────────────
//  Federal income-tax helpers. Pure functions, filing-status aware.
//  All rates returned as decimals (e.g. 0.12 for 12%).
// ─────────────────────────────────────────────────────────────

import {
  FED_BRACKETS,
  STD_DEDUCTION,
  DEFAULT_FILING_STATUS,
  SS_PROVISIONAL_THRESHOLDS,
} from "../constants/brackets.js";

function bracketsFor(filingStatus) {
  return FED_BRACKETS[filingStatus] ?? FED_BRACKETS[DEFAULT_FILING_STATUS];
}

function deductionFor(filingStatus) {
  return STD_DEDUCTION[filingStatus] ?? STD_DEDUCTION[DEFAULT_FILING_STATUS];
}

function applyBrackets(income, filingStatus) {
  const taxable = Math.max(0, income - deductionFor(filingStatus));
  if (taxable <= 0 || income <= 0) return 0;
  let tax = 0, prev = 0;
  for (const { upTo, rate } of bracketsFor(filingStatus)) {
    const chunk = Math.min(taxable - prev, upTo - prev);
    if (chunk <= 0) break;
    tax += chunk * rate;
    prev = upTo;
    if (prev >= taxable) break;
  }
  return tax;
}

/** Dollar amount of federal income tax on `income`, after the standard deduction. */
export function federalTax(income, filingStatus = DEFAULT_FILING_STATUS) {
  return applyBrackets(income, filingStatus);
}

/**
 * Blended (effective) federal rate on a withdrawal/income amount,
 * after the standard deduction. Returns tax / gross.
 */
export function effectiveFedRate(income, filingStatus = DEFAULT_FILING_STATUS) {
  if (income <= 0) return 0;
  return applyBrackets(income, filingStatus) / income;
}

/**
 * Annual taxable Social Security amount under IRC §86 provisional income rules.
 * `otherOrdinaryIncome` is annual income from all sources except SS (e.g. 401k draws).
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
export function marginalFedRate(income, filingStatus = DEFAULT_FILING_STATUS) {
  const taxable = Math.max(0, income - deductionFor(filingStatus));
  for (const { upTo, rate } of bracketsFor(filingStatus)) {
    if (taxable <= upTo) return rate;
  }
  return 0.37;
}
