// ─────────────────────────────────────────────────────────────
//  Planning model: normalize raw UI inputs into a `plan`, project
//  balances to a retirement age, and run the engine at any age.
//  Pure functions — the analysis routines build on these.
// ─────────────────────────────────────────────────────────────

import { fvAnnuity, splitRoth } from "../engine/accounts.js";
import { simulate } from "../engine/simulate.js";
import { ssClaimFactor } from "../engine/socialSecurity.js";
import { STATE_TAXES, DEFAULT_FILING_STATUS, CONTRIB_LIMITS, RMD_BIRTH_YEAR_THRESHOLD, TAX_YEAR } from "../constants/brackets.js";

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
  stockReturn: 10.0,
  inflationRate: 3.0,
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
  rule55: false,
  annualSepp: 0,
  guardrailUpper: 0,
  guardrailLower: 0,

  // ACA (M2)
  monthlyAcaFullPremium: 0, // full unsubsidized premium; 0 = not tracked

  // P5 correctness additions
  ssPia: 0,          // Primary Insurance Amount (benefit at FRA); 0 = use ssBenefit directly
  ssFra: 67,         // Full Retirement Age; 67 for born 1960+
  hsaBalance: 0,     // current HSA balance (grows to retirement)
  hsaAnnualContrib: 0, // annual HSA contribution until retirement
  monthlyIrmaaSurcharge: 0, // IRMAA Medicare Part B/D surcharge at 65+
  stateSsExemptRate: 0,     // 0 = SS fully taxable at state rate; 1 = fully exempt

  // Estate & legacy
  assumeStepUpBasis: true, // heirs inherit brokerage at market value (unrealized gains erased)
  legacyTarget: 0,         // desired estate at death, today's $; 0 = none (display-only gap)

  // Advanced inputs
  birthYear: 0,            // 0 = derive from currentAge; else authoritative for RMD start age
  oneTimeExpenses: [],     // [{ age, amount }] one-off costs in today's $ (weddings, repairs, …)
  goGoMult: 1,             // phase spending multiplier, retire → slowGoAge
  slowGoMult: 1,           // phase spending multiplier, slowGoAge → noGoAge
  noGoMult: 1,             // phase spending multiplier, noGoAge+
  slowGoAge: 70,           // age the slow-go phase begins
  noGoAge: 80,             // age the no-go phase begins

  // Scenario testing
  scenarioMode: "deterministic", // "deterministic" | "stress"
  stressDropPct: 30,             // crash magnitude (%) applied in the early stress years
  stressYears: 3,                // number of consecutive early-crash years
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
  // birthYear (if explicitly supplied) is authoritative for the RMD start age; otherwise derive it.
  const birthYear = p.birthYear > 0 ? p.birthYear : TAX_YEAR - p.currentAge;
  const rmdAge = birthYear >= RMD_BIRTH_YEAR_THRESHOLD ? 75 : 73;
  const { contributions: rothContribNow, earnings: rothEarningsNow } = splitRoth(
    p.rothTotal,
    p.rothAnnualContrib,
    p.rothYearsContrib,
  );
  const yearsToRetire = Math.max(0, p.retireAge - p.currentAge);
  const monthlyAtRetirement = p.monthlyExpense * Math.pow(1 + p.inflationRate / 100, yearsToRetire);

  // If PIA is supplied, derive the claimed benefit from the claiming age vs FRA.
  const ssBenefit = p.ssPia > 0 ? p.ssPia * ssClaimFactor(p.ssAge, p.ssFra) : p.ssBenefit;

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
    ssBenefit,
    ss2Benefit: p.hasSpouse ? p.spouseSsBenefit : 0,
    ss2Age: p.spouseSsAge,
    rmdAge,
    birthYear, // derived (or explicit) birth year used for RMD age
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
    hsaBalance:
      (plan.hsaBalance ?? 0) * Math.pow(1 + r, yrs) +
      fvAnnuity(plan.hsaAnnualContrib ?? 0, yrs, plan.stockReturn),
  };
}

/** Build the full simulate() parameter object for retiring at `age`. */
export function simParamsAt(plan, age, overrides = {}) {
  const yrs = age - plan.currentAge;
  const proj = projectTo(plan, yrs, overrides);
  return {
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
    rmdAge: overrides.rmdAge ?? plan.rmdAge,
    monthlyAcaFullPremium: overrides.monthlyAcaFullPremium ?? plan.monthlyAcaFullPremium,
    householdSize: plan.householdSize,
    rule55: overrides.rule55 ?? plan.rule55,
    annualSepp: overrides.annualSepp ?? plan.annualSepp,
    guardrailUpper: overrides.guardrailUpper ?? plan.guardrailUpper,
    guardrailLower: overrides.guardrailLower ?? plan.guardrailLower,
    monthlyIrmaaSurcharge: overrides.monthlyIrmaaSurcharge ?? plan.monthlyIrmaaSurcharge,
    stateSsExemptRate: overrides.stateSsExemptRate ?? plan.stateSsExemptRate,
    assumeStepUpBasis: overrides.assumeStepUpBasis ?? plan.assumeStepUpBasis,
    // One-time expenses: entered in today's $; inflate to retire-date $ (same basis as monthlyExpense)
    // and keep only entries that land within the simulated window (retirement → life expectancy).
    oneTimeExpenses: (overrides.oneTimeExpenses ?? plan.oneTimeExpenses ?? [])
      .filter((e) => e && e.amount > 0 && e.age >= age && e.age < plan.lifeExpect)
      .map((e) => ({ age: e.age, amount: e.amount * Math.pow(1 + plan.inflationRate / 100, yrs) })),
    goGoMult: overrides.goGoMult ?? plan.goGoMult,
    slowGoMult: overrides.slowGoMult ?? plan.slowGoMult,
    noGoMult: overrides.noGoMult ?? plan.noGoMult,
    slowGoAge: overrides.slowGoAge ?? plan.slowGoAge,
    noGoAge: overrides.noGoAge ?? plan.noGoAge,
  };
}

/** Balances at the configured retirement age. */
export function projectAtRetirement(plan, overrides = {}) {
  return projectTo(plan, plan.yearsToRetire, overrides);
}

/** Run the full simulation for retiring at `age` (with optional overrides). */
export function runAt(plan, age, overrides = {}) {
  if (age - plan.currentAge < 0) return null;
  return simulate(simParamsAt(plan, age, overrides));
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
