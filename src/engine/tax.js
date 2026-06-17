// ─────────────────────────────────────────────────────────────
//  Federal income-tax helpers. Pure functions, filing-status aware.
//  All rates returned as decimals (e.g. 0.12 for 12%).
// ─────────────────────────────────────────────────────────────

import {
  FED_BRACKETS,
  STD_DEDUCTION,
  DEFAULT_FILING_STATUS,
} from "../constants/brackets.js";

function bracketsFor(filingStatus) {
  return FED_BRACKETS[filingStatus] ?? FED_BRACKETS[DEFAULT_FILING_STATUS];
}

function deductionFor(filingStatus) {
  return STD_DEDUCTION[filingStatus] ?? STD_DEDUCTION[DEFAULT_FILING_STATUS];
}

/**
 * Blended (effective) federal rate on a withdrawal/income amount,
 * after the standard deduction. Returns tax / gross.
 */
export function effectiveFedRate(income, filingStatus = DEFAULT_FILING_STATUS) {
  const taxable = Math.max(0, income - deductionFor(filingStatus));
  if (taxable <= 0 || income <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of bracketsFor(filingStatus)) {
    const chunk = Math.min(taxable - prev, upTo - prev);
    if (chunk <= 0) break;
    tax += chunk * rate;
    prev = upTo;
    if (prev >= taxable) break;
  }
  return tax / income;
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
