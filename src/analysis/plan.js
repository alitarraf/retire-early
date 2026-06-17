// ─────────────────────────────────────────────────────────────
//  Planning model: normalize raw UI inputs into a `plan`, project
//  balances to a retirement age, and run the engine at any age.
//  Pure functions — the analysis routines build on these.
// ─────────────────────────────────────────────────────────────

import { fvAnnuity, splitRoth } from "../engine/accounts.js";
import { simulate } from "../engine/simulate.js";
import { STATE_TAXES, DEFAULT_FILING_STATUS, CONTRIB_LIMITS } from "../constants/brackets.js";

// Default scenario (2026, MFJ household).
export const DEFAULTS = {
  filingStatus: DEFAULT_FILING_STATUS,

  // Household & timeline
  currentAge: 38,
  retireAge: 55,
  ssAge: 67,
  lifeExpect: 85,
  householdSize: 2,

  // Spouse (combined household pool — only timeline/SS tracked)
  hasSpouse: true,
  spouseSsAge: 67,
  spouseSsBenefit: 1500,

  // Spending & SS
  monthlyExpense: 10000,
  ssBenefit: 1800,

  // Rates
  stockReturn: 7.0,
  inflationRate: 4.2,
  cashDepositRate: 3.9,

  // 401k
  k401Today: 120000,
  k401AnnualContrib: CONTRIB_LIMITS.k401,
  employerMatchPct: 4,
  salary: 120000,

  // Roth IRA
  rothTotal: 45000,
  rothAnnualContrib: CONTRIB_LIMITS.rothIra,
  rothYearsContrib: 6,
  existingRothEarnings: 0,

  // Other savings
  cashDeposit: 75000,
  muniBonds: 0,
  muniReturn: 4.5,
  muniDoubleTaxFree: true,
  existingBrokerage: 0,
  existingBrokerageBasis: 0,

  // Tax
  employmentBracket: 22,
  ltcgBracket: 15,
  stateKey: "Oregon",
  stateTaxEnabled: true,

  // Strategy
  annualRothConversion: 0,
};

/** Normalize raw inputs into a plan with derived fields. */
export function makePlan(raw) {
  const p = { ...DEFAULTS, ...raw };

  const stateRate = STATE_TAXES.find((s) => s.name === p.stateKey)?.rate ?? 0;
  const effectiveStateTax = p.stateTaxEnabled ? stateRate : 0;
  const accumulationOrdinaryRate = Math.min(90, p.employmentBracket + effectiveStateTax);
  const brokerageLtcgRate = p.ltcgBracket + effectiveStateTax;
  const depositAfterTaxRate = p.cashDepositRate * (1 - accumulationOrdinaryRate / 100);
  const annualEmployerMatch = (p.salary * p.employerMatchPct) / 100;
  const total401kAnnual = p.k401AnnualContrib + annualEmployerMatch;
  const { contributions: rothContribNow, earnings: rothEarningsNow } = splitRoth(
    p.rothTotal,
    p.rothAnnualContrib,
    p.rothYearsContrib,
  );
  const yearsToRetire = Math.max(0, p.retireAge - p.currentAge);
  const monthlyAtRetirement = p.monthlyExpense * Math.pow(1 + p.inflationRate / 100, yearsToRetire);

  return {
    ...p,
    effectiveStateTax,
    accumulationOrdinaryRate,
    brokerageLtcgRate,
    depositAfterTaxRate,
    annualEmployerMatch,
    total401kAnnual,
    rothContribNow,
    rothEarningsNow,
    yearsToRetire,
    monthlyAtRetirement,
    ss2Benefit: p.hasSpouse ? p.spouseSsBenefit : 0,
    ss2Age: p.spouseSsAge,
  };
}

/** Project per-account balances forward `yrs` years to a retirement date. */
export function projectTo(plan, yrs, overrides = {}) {
  const r = plan.stockReturn / 100;
  const rC = plan.depositAfterTaxRate / 100;
  const rM = plan.muniReturn / 100;
  const k401Extra = overrides.k401Annual ?? 0;
  const rothExtra = overrides.rothAnnual ?? 0;
  const muniExtra = overrides.muniAdd ?? 0;
  return {
    rothContributions:
      plan.rothContribNow * Math.pow(1 + r, yrs) +
      fvAnnuity(plan.rothAnnualContrib + rothExtra, yrs, plan.stockReturn),
    rothEarnings: (plan.rothEarningsNow + plan.existingRothEarnings) * Math.pow(1 + r, yrs),
    brokerage: plan.existingBrokerage * Math.pow(1 + r, yrs),
    brokerageBasis: plan.existingBrokerageBasis,
    k401:
      plan.k401Today * Math.pow(1 + r, yrs) +
      fvAnnuity(plan.total401kAnnual + k401Extra, yrs, plan.stockReturn),
    cashDeposit: plan.cashDeposit * Math.pow(1 + rC, yrs),
    muniBonds: (plan.muniBonds + muniExtra) * Math.pow(1 + rM, yrs),
  };
}

/** Balances at the configured retirement age. */
export function projectAtRetirement(plan, overrides = {}) {
  return projectTo(plan, plan.yearsToRetire, overrides);
}

/** Run the full simulation for retiring at `age` (with optional overrides). */
export function runAt(plan, age, overrides = {}) {
  const yrs = age - plan.currentAge;
  if (yrs < 0) return null;
  const proj = projectTo(plan, yrs, overrides);
  return simulate({
    retireAge: age,
    lifeExpect: plan.lifeExpect,
    ssAge: overrides.ssAge ?? plan.ssAge,
    monthlyExpense:
      (overrides.monthlyExpense ?? plan.monthlyExpense) *
      Math.pow(1 + plan.inflationRate / 100, yrs),
    inflationRate: plan.inflationRate,
    stockReturn: plan.stockReturn,
    ...proj,
    brokerageLtcgRate: plan.brokerageLtcgRate,
    stateTaxRate: plan.effectiveStateTax,
    ssBenefit: overrides.ssBenefit ?? plan.ssBenefit,
    ss2Benefit: overrides.ss2Benefit ?? plan.ss2Benefit,
    ss2Age: overrides.ss2Age ?? plan.ss2Age,
    annualRothConversion: overrides.annualRothConversion ?? plan.annualRothConversion,
    filingStatus: plan.filingStatus,
  });
}

/** Convenience: does the plan survive to life expectancy at `age`? */
export function survivesAt(plan, age, overrides = {}) {
  const res = runAt(plan, age, overrides);
  return res !== null && res.depleted === null;
}

/** The main run at the configured retirement age. */
export function runMain(plan, overrides = {}) {
  return runAt(plan, plan.retireAge, overrides);
}
