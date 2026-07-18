// ─────────────────────────────────────────────────────────────
//  Planning model: normalize raw UI inputs into a `plan`, project
//  balances to a retirement age, and run the engine at any age.
//  Pure functions — the analysis routines build on these.
// ─────────────────────────────────────────────────────────────

import { fvAnnuity, growthFactors, splitRoth } from "../engine/accounts.js";
import { blendedReturnAt, glideReturnSeries } from "../engine/allocation.js";
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
  numDependents: 0,        // children you're saving for (drives ESA/Trump/529 sizing, Phase 2)
  educationAnnualContrib: 0, // $/yr you set aside for kids' education (diverted from retirement)

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

  // Asset allocation & risk glide path (opt-in; off = flat stockReturn everywhere).
  // When on, the growth pool (401k/Roth/brokerage/HSA) earns a blended equity/bond/
  // cash return whose equity share glides down with age per the risk profile.
  allocationEnabled: false,
  riskProfile: "moderate", // "conservative" | "moderate" | "aggressive" | "custom"
  bondReturn: 4.5,         // nominal annual % on the bond slice of the blend
  pinAllocation: false,    // expert: hold a fixed mix (no glide) using the pcts below
  equityPct: 60,           // custom/pinned mix (percent; equity+bond+cash = 100)
  bondPct: 35,
  cashPct: 5,

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
  cashMonthlyContrib: 0,      // ongoing $/mo into CD/cash savings
  muniBonds: 0,
  muniReturn: 4.5,
  muniDoubleTaxFree: true,
  muniMonthlyContrib: 0,      // ongoing $/mo into municipal bonds
  existingBrokerage: 0,
  existingBrokerageBasis: 0,
  brokerageMonthlyContrib: 0, // ongoing $/mo into taxable brokerage

  // Deferred annuity (Phase 2b) — a "should I?" comparison, not a baked-in sleeve.
  // Contributions grow at a guaranteed rate to the start age, then annuitize into
  // a fixed lifetime income stream (ordinary-income tax). 0 contrib = feature off.
  annuityContribAnnual: 0,  // $/yr you'd route to a deferred annuity instead of your portfolio
  annuityStartAge: 65,      // age the guaranteed income begins
  annuityRate: 4.5,         // guaranteed accumulation return (%) — annuities pay conservative rates
  annuityPayoutRate: 6.0,   // annual payout as % of the annuity value at start (SPIA-style)

  // Fixed annuity / MYGA (multi-year guaranteed annuity) — a "tax-deferred CD".
  // A lump grows tax-deferred at a guaranteed rate; gains are ordinary-income taxed
  // (+10% penalty pre-59½) at cash-out. Pure comparison, no sim. 0 capital = off.
  mygaCapital: 0,      // lump sum you'd put in
  mygaRate: 5.0,       // guaranteed rate (%)
  mygaTermYears: 3,    // product term (renewable)
  mygaCashOutAge: 0,   // age you'd cash out; 0 = end of the first term (currentAge + term)
  treasuryRate: 4.5,   // Treasury yield — federal-taxable, state-EXEMPT
  treasuryBalance: 0,  // held Treasuries (Invest tab; becomes a real drawn-down sleeve in Phase 3)

  // Tax
  employmentBracket: 22,
  ltcgBracket: 15, // manual LTCG rate; only used when autoLtcg is false
  autoLtcg: true,  // derive the LTCG rate from real brackets (stacking + NIIT) each sim year
  stateKey: "Oregon",
  stateTaxEnabled: true,

  // Strategy
  annualRothConversion: 0,
  conversionCeiling: 0,      // bracket-fill target (taxable-income top); 0 = fixed amount above
  conversionEndAge: 59.5,    // conversions allowed while age < this (optimizer may raise to ~72)
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
  monthlyIrmaaSurcharge: 0, // flat IRMAA surcharge at 65+ (manual path; ignored when autoMedicare)
  autoMedicare: false, // income-tested Part B + IRMAA (2-yr lookback); off by default because
                       // many users already carry Medicare premiums inside monthlyExpense
  hsaQualifiedFraction: 1, // share of spend that is qualified medical for HSA draws (1 = legacy)
  stateSsExemptRate: 0,     // 0 = SS fully taxable at state rate; 1 = fully exempt

  // Estate & legacy
  assumeStepUpBasis: true, // heirs inherit brokerage at market value (unrealized gains erased)
  legacyTarget: 0,         // desired estate at death, today's $; 0 = none (display-only gap)

  // Life stage
  alreadyRetired: false,   // true = plan from today: retireAge pinned to currentAge,
                           // accumulation inputs ignored, retiree-focused results

  // Advanced inputs
  birthYear: 0,            // 0 = derive from currentAge; else authoritative for RMD start age
  oneTimeExpenses: [],     // [{ age, amount }] one-off costs in today's $; NEGATIVE = windfall
                           // (downsizing proceeds, inheritance) banked into cash
  incomeStreams: [],       // [{ label, monthly, startAge, endAge, cola, taxType, survivorPct }]
                           // pension/annuity/part-time/rental, monthly in today's $
  expenseStreams: [],      // [{ label, monthly, startAge, endAge, inflate }] recurring costs
                           // that end (mortgage P&I…), monthly in today's $
  survivorAge: 0,          // primary's age when the spouse dies; 0 = not modeled
  survivorSpendFraction: 0.75, // share of base spending that continues afterwards
  goGoMult: 1,             // phase spending multiplier, retire → slowGoAge
  slowGoMult: 1,           // phase spending multiplier, slowGoAge → noGoAge
  noGoMult: 1,             // phase spending multiplier, noGoAge+
  slowGoAge: 70,           // age the slow-go phase begins
  noGoAge: 80,             // age the no-go phase begins

  // Scenario testing
  scenarioMode: "deterministic", // "deterministic" | "stress" | "historical"
  stressDropPct: 30,             // crash magnitude (%) applied in the early stress years
  stressYears: 3,                // number of consecutive early-crash years
  historicalScenario: "gfc2007", // HISTORICAL_SCENARIOS key replayed in historical mode
  historicalLens: "balanced",    // "sp" (all-equity) | "balanced" (60/40) return series
};

/** Normalize raw inputs into a plan with derived fields. */
export function makePlan(raw) {
  const p = { ...DEFAULTS, ...raw };

  // Already retired: planning starts NOW. Force the retirement age to today
  // and zero all accumulation flows in the NORMALIZED plan only — the raw
  // inputs are untouched, so toggling back restores them.
  if (p.alreadyRetired) {
    p.retireAge = p.currentAge;
    p.salary = 0;
    p.employerMatchPct = 0;
    p.k401AnnualContrib = 0;
    p.rothAnnualContrib = 0;
    p.hsaAnnualContrib = 0;
    p.cashMonthlyContrib = 0;
    p.muniMonthlyContrib = 0;
    p.brokerageMonthlyContrib = 0;
  }

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
  const brokerageExtra = overrides.brokerageAnnual ?? 0;
  const hsaExtra = overrides.hsaAnnual ?? 0;
  const cashExtra = overrides.cashAnnual ?? 0;
  // Ongoing user contributions (entered as $/mo, annualized here).
  const brokContribAnnual = (plan.brokerageMonthlyContrib ?? 0) * 12;
  const cashContribAnnual = (plan.cashMonthlyContrib ?? 0) * 12;
  const muniContribAnnual = (plan.muniMonthlyContrib ?? 0) * 12;

  // Growth-pool return (401k/Roth/brokerage/HSA). Legacy = flat stockReturn; with
  // allocation on, each accumulation year earns the age-blended glide return.
  // `eqRateAt(t)` is the blend during year t (1-based); age that year ≈ currentAge+(t-1).
  const eqRateAt = plan.allocationEnabled
    ? (t) => blendedReturnAt(plan, plan.currentAge + (t - 1))
    : null;
  const eqRate = eqRateAt ?? plan.stockReturn;              // scalar or per-year fn for fvAnnuity
  const eqBalFactor = eqRateAt ? growthFactors(yrs, eqRateAt)[1] : Math.pow(1 + r, yrs);

  return {
    rothContributions:
      plan.rothContribNow * eqBalFactor +
      fvAnnuity(plan.rothAnnualContrib + rothExtra, yrs, eqRate),
    rothEarnings: (plan.rothEarningsNow + plan.existingRothEarnings) * eqBalFactor,
    // Brokerage contributions (user input + goal-seek override) are after-tax
    // dollars, so the contributed principal adds to both the value and the cost
    // basis (no phantom gain).
    brokerage:
      plan.existingBrokerage * eqBalFactor +
      fvAnnuity(brokContribAnnual + brokerageExtra, yrs, eqRate),
    brokerageBasis: plan.existingBrokerageBasis + (brokContribAnnual + brokerageExtra) * yrs,
    k401:
      plan.k401Today * eqBalFactor +
      fvAnnuity(plan.total401kAnnual + k401Extra, yrs, eqRate),
    cashDeposit:
      plan.cashDeposit * Math.pow(1 + rC, yrs) +
      fvAnnuity(cashContribAnnual + cashExtra, yrs, plan.depositAfterTaxRate),
    muniBonds:
      (plan.muniBonds + muniExtra) * Math.pow(1 + rM, yrs) +
      fvAnnuity(muniContribAnnual, yrs, plan.muniReturn),
    hsaBalance:
      (plan.hsaBalance ?? 0) * eqBalFactor +
      fvAnnuity((plan.hsaAnnualContrib ?? 0) + hsaExtra, yrs, eqRate),
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
    // Brackets/deduction/FPL are IRS-inflation-indexed annually; "today" in the
    // model is TAX_YEAR, so the retirement date sits `yrs` index-years out.
    taxIndexYears: yrs,
    // In-retirement cash/muni sleeves earn their own yields, not the stock
    // return. CD interest is approximated at the after-tax accumulation rate.
    cashReturn: plan.depositAfterTaxRate,
    muniYield: plan.muniReturn,
    // Allocation glide (opt-in): the equity growth pool follows the age-blended
    // return each retirement year via simulate()'s returnSeries hook. Cash/muni
    // sleeves keep their own yields. Off → no series, flat stockReturn (legacy).
    ...(plan.allocationEnabled
      ? { returnSeries: glideReturnSeries(plan, age, plan.lifeExpect - age) }
      : {}),
    ...proj,
    brokerageLtcgRate: plan.brokerageLtcgRate,
    stateTaxRate: plan.effectiveStateTax,
    ssBenefit: overrides.ssBenefit ?? plan.ssBenefit,
    ss2Benefit: overrides.ss2Benefit ?? plan.ss2Benefit,
    ss2Age: overrides.ss2Age ?? plan.ss2Age,
    annualRothConversion: overrides.annualRothConversion ?? plan.annualRothConversion,
    conversionCeiling: overrides.conversionCeiling ?? plan.conversionCeiling,
    conversionEndAge: overrides.conversionEndAge ?? plan.conversionEndAge,
    filingStatus: plan.filingStatus,
    rmdAge: overrides.rmdAge ?? plan.rmdAge,
    monthlyAcaFullPremium: overrides.monthlyAcaFullPremium ?? plan.monthlyAcaFullPremium,
    householdSize: plan.householdSize,
    rule55: overrides.rule55 ?? plan.rule55,
    annualSepp: overrides.annualSepp ?? plan.annualSepp,
    guardrailUpper: overrides.guardrailUpper ?? plan.guardrailUpper,
    guardrailLower: overrides.guardrailLower ?? plan.guardrailLower,
    monthlyIrmaaSurcharge: overrides.monthlyIrmaaSurcharge ?? plan.monthlyIrmaaSurcharge,
    autoMedicare: plan.autoMedicare,
    hsaQualifiedFraction: plan.hsaQualifiedFraction,
    // IRMAA's 2-year lookback covers the final working years right after
    // retirement; salary approximates pre-retirement MAGI.
    preRetirementMagi: plan.salary,
    stateSsExemptRate: overrides.stateSsExemptRate ?? plan.stateSsExemptRate,
    assumeStepUpBasis: overrides.assumeStepUpBasis ?? plan.assumeStepUpBasis,
    autoLtcg: plan.autoLtcg,
    // One-time expenses: entered in today's $; inflate to retire-date $ (same basis as monthlyExpense)
    // and keep only entries that land within the simulated window (retirement → life expectancy).
    oneTimeExpenses: (overrides.oneTimeExpenses ?? plan.oneTimeExpenses ?? [])
      .filter((e) => e && e.amount !== 0 && e.age >= age && e.age < plan.lifeExpect)
      .map((e) => ({ age: e.age, amount: e.amount * Math.pow(1 + plan.inflationRate / 100, yrs) })),
    // Streams: inflation-linked amounts (cola/inflate true) are entered in
    // today's $ and scale to retire-date $ like monthlyExpense; fixed-nominal
    // amounts (a mortgage payment, a non-COLA pension quote) pass through
    // unchanged. Entries that end before retirement are dropped.
    incomeStreams: (overrides.incomeStreams ?? plan.incomeStreams ?? [])
      .filter((s) => s && s.monthly > 0 && (s.endAge == null || s.endAge > age))
      .map((s) => ({
        ...s,
        monthly: s.cola === true ? s.monthly * Math.pow(1 + plan.inflationRate / 100, yrs) : s.monthly,
      })),
    expenseStreams: (overrides.expenseStreams ?? plan.expenseStreams ?? [])
      .filter((s) => s && s.monthly > 0 && (s.endAge == null || s.endAge > age))
      .map((s) => ({
        ...s,
        monthly: s.inflate === true ? s.monthly * Math.pow(1 + plan.inflationRate / 100, yrs) : s.monthly,
      })),
    survivorAge: overrides.survivorAge ?? plan.survivorAge,
    survivorSpendFraction: overrides.survivorSpendFraction ?? plan.survivorSpendFraction,
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

/**
 * Can the plan actually retire at `age`? Requires surviving to life
 * expectancy AND no pre-59½ bridge shortfall — money stranded in a locked
 * 401k does not count as "retired." This keeps earliestRetireAge honest for
 * early (pre-bridge-access) targets, where depleted alone stays null because
 * the locked 401k is never touched.
 */
export function survivesAt(plan, age, overrides = {}) {
  const res = runAt(plan, age, overrides);
  return res !== null && res.depleted === null && res.bridgeShortfall === 0;
}

/** The main run at the configured retirement age. */
export function runMain(plan, overrides = {}) {
  return runAt(plan, plan.retireAge, overrides);
}
