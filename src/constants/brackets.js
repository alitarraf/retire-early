// ─────────────────────────────────────────────────────────────
//  Tax constants — SINGLE SOURCE OF TRUTH for everything tied to
//  the tax code. The annual update should be a single-file edit.
//
//  ⚠ TAX_YEAR 2026 figures below are the IRS inflation-adjusted
//  amounts. Verify against final IRS publications and the 2026
//  FPL / IRMAA tables before relying on them. Planning estimates,
//  not tax advice.
// ─────────────────────────────────────────────────────────────

export const TAX_YEAR = 2026;

export const FILING_STATUS = {
  SINGLE: "single",
  MFJ: "mfj",
  HOH: "hoh",
};

// Default filing status for the household model.
export const DEFAULT_FILING_STATUS = FILING_STATUS.MFJ;

export const FILING_STATUS_LABELS = {
  single: "Single",
  mfj: "Married filing jointly",
  hoh: "Head of household",
};

// 2026 standard deduction by filing status.
export const STD_DEDUCTION = {
  single: 16100,
  mfj: 32200,
  hoh: 24150,
};

// 2026 federal ordinary-income brackets by filing status.
// `upTo` is the top of each band of TAXABLE income (after std deduction).
export const FED_BRACKETS = {
  single: [
    { upTo: 12400, rate: 0.10 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  mfj: [
    { upTo: 24800, rate: 0.10 },
    { upTo: 100800, rate: 0.12 },
    { upTo: 211100, rate: 0.22 },
    { upTo: 403550, rate: 0.24 },
    { upTo: 512450, rate: 0.32 },
    { upTo: 768700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  hoh: [
    { upTo: 17700, rate: 0.10 },
    { upTo: 67450, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256200, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

// 2026 contribution limits (under age-50 base, no catch-up).
// Catch-ups per IRS Notice 2025-67; verify against final IRS pubs each tax year.
export const CONTRIB_LIMITS = {
  k401: 24500,
  k401Catchup50: 8000,   // additional elective-deferral catch-up at age 50+ (→ $32,500)
  k401Catchup60: 11250,  // SECURE 2.0 super catch-up, ages 60–63 (REPLACES the 50+ amount → $35,750)
  rothIra: 7500,
  rothIraCatchup50: 1100, // additional IRA catch-up at age 50+ (→ $8,600; no 60–63 super catch-up for IRAs)
  hsaIndividual: 4300,   // 2026 HSA limit (self-only)
  hsaFamily: 8550,       // 2026 HSA limit (family)
  hsaCatchup: 1000,      // additional catch-up at age 55+
};

// 2026 education & children's-account limits (Phase 2). Verify against final IRS
// pubs each tax year — several of these are new/unsettled.
export const KIDS_LIMITS = {
  coverdellEsa: 2000,     // Coverdell ESA, per beneficiary/yr (statutory, not inflation-indexed)
  trumpAccount: 5000,     // Trump account (IRC §530A), per child/yr, 2026–27 (indexed $100 from 2028)
  trumpSeed: 1000,        // one-time federal seed, per child born 2025–2028 (doesn't count vs the cap)
  trumpEmployer: 2500,    // optional employer contribution/yr, per employee (counts toward the $5k)
  trumpStartYear: 2026,   // §530A contributions cannot be made before Jul 4, 2026
  giftAnnualExclusion: 19000, // 529 has no federal cap; gift-tax annual exclusion (per donor/beneficiary; superfund = 5×)
};

// Long-term capital-gains rate options offered in the UI (manual override
// when autoLtcg is off).
export const LTCG_RATES = [0, 15, 20];

// 2026 LTCG brackets (Rev. Proc. 2025-32). `upTo` is the top of the band of
// TAXABLE income; gains stack on top of ordinary taxable income. These
// thresholds ARE inflation-indexed annually (unlike NIIT).
export const LTCG_BRACKETS = {
  single: [
    { upTo: 49450, rate: 0 },
    { upTo: 545500, rate: 0.15 },
    { upTo: Infinity, rate: 0.20 },
  ],
  mfj: [
    { upTo: 98900, rate: 0 },
    { upTo: 613700, rate: 0.15 },
    { upTo: Infinity, rate: 0.20 },
  ],
  hoh: [
    { upTo: 66200, rate: 0 },
    { upTo: 579600, rate: 0.15 },
    { upTo: Infinity, rate: 0.20 },
  ],
};

// Net Investment Income Tax (IRC §1411): 3.8% on investment income above the
// MAGI threshold. Thresholds are NOT inflation-indexed — fixed in law.
export const NIIT = {
  rate: 0.038,
  threshold: { single: 200000, mfj: 250000, hoh: 200000 },
};

// Ordinary employment-bracket options offered in the UI.
export const EMPLOYMENT_BRACKETS = [10, 12, 22, 24, 32, 35, 37];

// Flat effective state income-tax rates (simplification — applied to
// all income types today; income-type nuance is a roadmap item).
export const STATE_TAXES = [
  { name: "No state tax", rate: 0 },
  { name: "Oregon", rate: 9.9 },
  { name: "California", rate: 13.3 },
  { name: "New York", rate: 10.9 },
  { name: "New Jersey", rate: 10.75 },
  { name: "Minnesota", rate: 9.85 },
  { name: "Vermont", rate: 8.75 },
  { name: "Iowa", rate: 8.53 },
  { name: "Wisconsin", rate: 7.65 },
  { name: "Maine", rate: 7.15 },
  { name: "Georgia", rate: 5.75 },
  { name: "Arizona", rate: 4.5 },
  { name: "Colorado", rate: 4.4 },
  { name: "Indiana", rate: 3.23 },
  { name: "Pennsylvania", rate: 3.07 },
  { name: "Florida", rate: 0 },
  { name: "Texas", rate: 0 },
  { name: "Washington", rate: 0 },
  { name: "Nevada", rate: 0 },
];

// ACA cliff / FPL inputs (for roadmap P1; 2026 coverage uses the
// 2025 federal poverty guidelines, 48 contiguous states). AK/HI differ.
export const ACA = {
  fplBase: 15650, // household of 1
  fplPerAdditionalPerson: 5500,
  cliffMultiple: 4.0, // 400% FPL cliff is back for 2026
  // 2026 applicable-percentage table (Rev. Proc. 2025-25): the share of MAGI a
  // household contributes toward the benchmark silver plan, linearly
  // interpolated within each FPL band. Enhanced (ARPA/IRA) credits expired
  // 12/31/2025; ≥400% FPL gets no credit (the cliff).
  applicablePcts: [
    { fplFrom: 0.00, fplTo: 1.33, pctFrom: 0.0210, pctTo: 0.0210 },
    { fplFrom: 1.33, fplTo: 1.50, pctFrom: 0.0314, pctTo: 0.0419 },
    { fplFrom: 1.50, fplTo: 2.00, pctFrom: 0.0419, pctTo: 0.0660 },
    { fplFrom: 2.00, fplTo: 2.50, pctFrom: 0.0660, pctTo: 0.0844 },
    { fplFrom: 2.50, fplTo: 3.00, pctFrom: 0.0844, pctTo: 0.0996 },
    { fplFrom: 3.00, fplTo: 4.00, pctFrom: 0.0996, pctTo: 0.0996 },
  ],
};

/** Applicable percentage for a MAGI/FPL ratio (linear within bands; cliff ≥ 4.0). */
export function acaApplicablePct(fplRatio) {
  if (fplRatio >= ACA.cliffMultiple) return null; // no credit — pay full premium
  for (const b of ACA.applicablePcts) {
    if (fplRatio < b.fplTo) {
      const span = b.fplTo - b.fplFrom;
      const t = span > 0 ? Math.max(0, fplRatio - b.fplFrom) / span : 0;
      return b.pctFrom + (b.pctTo - b.pctFrom) * t;
    }
  }
  return null;
}

// ── Medicare Part B / IRMAA (2026, CMS) ──
// IRMAA is a hard cliff per tier, based on MAGI from TWO years prior.
// Thresholds and surcharges below are 2026 figures; the engine indexes both
// by the plan's inflation rate (approximation — real premium growth has
// historically outpaced CPI; the top tier is frozen until 2028 by law).
export const MEDICARE = {
  partBBase: 202.90, // standard monthly Part B premium, per person
  irmaa: {
    single: [
      { magiUpTo: 109000, partB: 0, partD: 0 },
      { magiUpTo: 137000, partB: 81.20, partD: 14.50 },
      { magiUpTo: 171000, partB: 202.90, partD: 37.50 },
      { magiUpTo: 205000, partB: 324.60, partD: 60.40 },
      { magiUpTo: 500000, partB: 446.30, partD: 83.30 },
      { magiUpTo: Infinity, partB: 487.00, partD: 91.00 },
    ],
    mfj: [
      { magiUpTo: 218000, partB: 0, partD: 0 },
      { magiUpTo: 274000, partB: 81.20, partD: 14.50 },
      { magiUpTo: 342000, partB: 202.90, partD: 37.50 },
      { magiUpTo: 410000, partB: 324.60, partD: 60.40 },
      { magiUpTo: 750000, partB: 446.30, partD: 83.30 },
      { magiUpTo: Infinity, partB: 487.00, partD: 91.00 },
    ],
  },
};

/**
 * Monthly IRMAA surcharge (Part B + Part D, per person) for a lookback MAGI.
 * hoh uses the single scale (SSA has no separate hoh table).
 */
export function irmaaMonthlySurcharge(magi, filingStatus = "single", indexFactor = 1) {
  const tiers = MEDICARE.irmaa[filingStatus] ?? MEDICARE.irmaa.single;
  for (const t of tiers) {
    if (magi <= t.magiUpTo * indexFactor) return (t.partB + t.partD) * indexFactor;
  }
  const top = tiers[tiers.length - 1];
  return (top.partB + top.partD) * indexFactor;
}

// ── Social Security provisional income thresholds (IRC §86) ──
// NOT inflation-adjusted — unchanged since 1983/1993 as enacted.
// Provisional Income = other AGI + ½ gross SS.
// Below T1: 0% taxable. T1–T2: up to 50%. Above T2: up to 85%.
export const SS_PROVISIONAL_THRESHOLDS = {
  single: [25000, 34000],
  mfj:    [32000, 44000],
  hoh:    [25000, 34000],
  mfs:    [0, 0],
};

// ── RMD constants (SECURE 2.0) ───────────────────────────────
// Birth-year threshold that determines RMD start age.
// Born ≤ 1959 → RMD age 73; born ≥ 1960 → RMD age 75.
export const RMD_BIRTH_YEAR_THRESHOLD = 1960;

// IRS Uniform Lifetime Table divisors (from IRS Pub 590-B, post-SECURE 2.0).
// Verify against final IRS publications — these change with inflation adjustments.
// Key: integer age; value: distribution period divisor used in RMD = balance / divisor.
export const RMD_UNIFORM_LIFETIME = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
  94: 9.5,  95: 8.9,  96: 8.4,  97: 7.8,  98: 7.3,  99: 6.8, 100: 6.4,
 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0,
 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};
