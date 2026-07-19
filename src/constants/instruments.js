// ─────────────────────────────────────────────────────────────
//  Instrument registry (PRD_InvestTab_July2026) — the SINGLE source
//  of truth for every place money can go. The Invest tab's editable
//  list AND its priority recommendation both read from this array, so
//  adding a future instrument is ONE entry here — it appears in both
//  automatically.
//
//  Each descriptor points at existing DEFAULTS keys (balanceKey /
//  contribKey) so the list edits the real plan inputs; `rateKey` is the
//  plan assumption that drives its growth; `capKey` maps to the
//  age-adjusted IRS cap (contribCaps); `tax` + `accessAge` drive the
//  priority score. Pure data — no React, no engine.
// ─────────────────────────────────────────────────────────────

export const INSTRUMENT_CATEGORIES = [
  { key: "retirement", label: "Your accounts" },
  { key: "safe", label: "Safe / fixed income" },
  { key: "income", label: "Annuities (income)" },
  { key: "kids", label: "Kids — separate goal" },
];

// tax character: free (Roth/HSA/muni) > deferred (401k/MYGA) > stateExempt
// (Treasuries) > taxable (brokerage/cash). Used for the priority score + row color.
export const INSTRUMENTS = [
  { key: "k401", label: "401(k) / Traditional", category: "retirement", tax: "deferred", whose: "you",
    balanceKey: "k401Today", contribKey: "k401AnnualContrib", contribUnit: "year", rateKey: "stockReturn",
    capKey: "k401", accessAge: 59.5, simModeled: true, note: "Pre-tax; taxed as income later" },
  { key: "roth", label: "Roth IRA", category: "retirement", tax: "free", whose: "you",
    balanceKey: "rothTotal", contribKey: "rothAnnualContrib", contribUnit: "year", rateKey: "stockReturn",
    capKey: "ira", accessAge: 0, simModeled: true, note: "Tax-free growth & withdrawals" },
  { key: "hsa", label: "HSA", category: "retirement", tax: "free", whose: "you",
    balanceKey: "hsaBalance", contribKey: "hsaAnnualContrib", contribUnit: "year", rateKey: "stockReturn",
    capKey: "hsa", accessAge: 0, simModeled: true, note: "Triple tax-free for medical" },
  { key: "brokerage", label: "Taxable brokerage", category: "retirement", tax: "taxable", whose: "you",
    balanceKey: "existingBrokerage", contribKey: "brokerageMonthlyContrib", contribUnit: "month", rateKey: "stockReturn",
    capKey: null, accessAge: 0, simModeled: true, note: "Only gains taxed (LTCG); accessible" },
  { key: "cash", label: "Cash / CDs / HYSA", category: "safe", tax: "taxable", whose: "you",
    balanceKey: "cashDeposit", contribKey: "cashMonthlyContrib", contribUnit: "month", rateKey: "cashDepositRate",
    capKey: null, accessAge: 0, simModeled: true, note: "Interest taxed yearly" },
  { key: "muni", label: "Municipal bonds", category: "safe", tax: "free", whose: "you",
    balanceKey: "muniBonds", contribKey: "muniMonthlyContrib", contribUnit: "month", rateKey: "muniReturn",
    capKey: null, accessAge: 0, simModeled: true, note: "Federally tax-free interest" },
  { key: "treasury", label: "Treasuries / T-bills", category: "safe", tax: "stateExempt", whose: "you",
    balanceKey: "treasuryBalance", contribKey: null, contribUnit: null, rateKey: "treasuryRate",
    capKey: null, accessAge: 0, simModeled: true, note: "Yield is state-tax-exempt" },
  { key: "myga", label: "Fixed annuity (MYGA)", category: "safe", tax: "deferred", whose: "you",
    balanceKey: "mygaCapital", contribKey: null, contribUnit: null, rateKey: "mygaRate",
    capKey: null, accessAge: 59.5, simModeled: true, note: "Tax-deferred CD; ordinary tax at cash-out",
    extraFields: [
      { key: "mygaTermYears", label: "Term (yrs)", min: 1, max: 20 },
      { key: "mygaCashOutAge", label: "Cash out age", min: 0, max: 95 },
    ] },
  { key: "incomeAnnuity", label: "Lifetime income annuity", category: "income", tax: "deferred", whose: "you",
    balanceKey: null, contribKey: "annuityContribAnnual", contribUnit: "year", rateKey: "annuityRate",
    capKey: null, accessAge: 0, simModeled: false, note: "Guaranteed lifetime income",
    extraFields: [
      { key: "annuityStartAge", label: "Income starts age", min: 50, max: 85 },
      { key: "annuityPayoutRate", label: "Payout %", suffix: "%", step: 0.1 },
    ] },
  { key: "education", label: "Education (529 / ESA / 530A Trump)", category: "kids", tax: "free", whose: "kid",
    balanceKey: null, contribKey: "educationAnnualContrib", contribUnit: "year", rateKey: "stockReturn",
    capKey: null, accessAge: 0, simModeled: false, note: "For the kids — diverted from your retirement" },
];

/** Instruments grouped by category, in registry order (drops empty groups). */
export function instrumentsByCategory() {
  return INSTRUMENT_CATEGORIES
    .map((c) => ({ ...c, items: INSTRUMENTS.filter((i) => i.category === c.key) }))
    .filter((c) => c.items.length > 0);
}

export const INSTRUMENT_BY_KEY = Object.fromEntries(INSTRUMENTS.map((i) => [i.key, i]));
