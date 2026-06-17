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
export const CONTRIB_LIMITS = {
  k401: 24500,
  rothIra: 7500,
};

// Long-term capital-gains rate options offered in the UI.
export const LTCG_RATES = [0, 15, 20];

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
};
