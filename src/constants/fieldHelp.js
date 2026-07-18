// Single source of truth for per-field guidance. Surfaced two ways:
//  • InfoDot tooltips next to each sidebar field (FIELD_HELP[id]).
//  • The "Inputs reference" section of DocsPanel (FIELD_HELP_GROUPS).
// Keep `context` to a sentence or two and `typical` non-prescriptive
// (ranges/context, never "set this to X").

export const FIELD_HELP = {
  // ── You / Timeline ──────────────────────────────────────────
  autoLtcg: {
    label: "Capital gains model",
    context:
      "Real brackets: the rate on brokerage gains is derived each year from the actual LTCG brackets (0/15/20% depending on your other income) plus the 3.8% NIIT above $200k/$250k MAGI. Flat rate: you pick one rate that applies always.",
  },
  autoMedicare: {
    label: "Medicare model",
    context:
      "By income: adds the real Part B premium plus IRMAA surcharges from age 65, income-tested against your MAGI from two years earlier (so a big Roth conversion at 63 raises your premium at 65). Flat: you enter one fixed surcharge.",
  },
  hsaQualifiedFraction: {
    label: "Medical share of spending",
    context:
      "HSA withdrawals are only tax-free for qualified medical costs. This caps tax-free HSA draws at this share of your spending; the rest can still come from the HSA but is taxed (plus a 20% penalty before 65). 100% = treat all spending as medical (optimistic).",
  },
  survivorAge: {
    label: "Survivor scenario",
    context:
      "Models one spouse dying at this age (yours): the survivor files single (higher tax brackets on the same income — the 'widow's tax'), keeps only the larger Social Security benefit, and household size drops for ACA purposes. 0 = not modeled.",
  },
  survivorSpendFraction: {
    label: "Survivor spending",
    context:
      "Share of household spending that continues after a spouse dies. Studies suggest a single retiree spends roughly 70–80% of the couple's budget.",
  },
  incomeStreams: {
    label: "Other income",
    context:
      "Pension, annuity, part-time work, or rental income. Taxable streams behave like real ordinary income: they raise the tax on your 401k withdrawals, Social Security taxation, ACA premiums, and IRMAA. Fixed $ streams keep their nominal amount (typical private pension); COLA streams grow with inflation.",
  },
  expenseStreams: {
    label: "Expenses that end",
    context:
      "Recurring costs on top of monthly expenses that stop at a known age — a mortgage payment, a car loan. 'Fixed payment' keeps the nominal amount (a mortgage doesn't inflate); property tax and insurance belong in monthly expenses instead.",
  },
  alreadyRetired: {
    label: "Life stage",
    context:
      "Retired switches the app to plan from today: the retire-age slider and all contribution fields disappear, and the first tab becomes a retiree dashboard (does the money last, sustainable spend, RMDs, conversions). Your contribution entries are kept and restored if you switch back.",
  },
  filingStatus: {
    label: "Filing status",
    context:
      "Sets your federal tax brackets and standard deduction throughout retirement. MFJ brackets are roughly double the single brackets.",
  },
  currentAge: {
    label: "Current age",
    context: "Your age today. Every balance compounds from now to your retire age.",
  },
  retireAge: {
    label: "Retire at",
    context:
      "The age you plan to stop working. The planner also finds your earliest viable age separately — set this to your target.",
  },
  lifeExpect: {
    label: "Live to",
    context: "The simulation runs to this age. Money lasting to here counts as success.",
    typical: "90–95 is a common longevity stress point.",
  },
  ssAge: {
    label: "Social Security at",
    context:
      "The age you claim Social Security (62–70). Earlier = permanently smaller benefit; later = permanently larger. Use PIA mode to see the exact trade-off.",
    typical: "Claiming at 62 ≈ 70% of your full benefit; at 70 ≈ 124%.",
  },
  householdSize: {
    label: "Household size",
    context:
      "Used for the ACA Federal Poverty Level calculation — it affects whether you owe the full ACA premium or qualify for subsidies.",
  },
  numDependents: {
    label: "Kids saving for",
    context:
      "Number of children you're saving education money for. Sizes the Coverdell ESA ($2k/child) and 530A Trump ($5k/child) caps in the Funding Order tool. Separate from household size.",
  },
  educationAnnualContrib: {
    label: "Kids' education savings /yr",
    context:
      "Dollars per year you set aside for kids' education. It's diverted from your own retirement savings, so the Funding Order tool shows both the tax-smart split (Coverdell → 530A Trump → 529) and what it costs your own safe spending.",
  },
  annuityContribAnnual: {
    label: "Into an annuity /yr",
    context:
      "A 'what if' amount — the Funding Order card compares routing this to a deferred annuity (guaranteed income) vs. investing it. In this model a diversified portfolio usually wins; the annuity's edge is income you can't outlive. 0 = off.",
  },
  annuityStartAge: {
    label: "Annuity income start age",
    context: "The age the deferred annuity begins paying its fixed lifetime income.",
  },
  annuityRate: {
    label: "Annuity guaranteed rate",
    context: "The guaranteed accumulation return the annuity credits before payout — deliberately conservative (annuities trade growth for a guarantee).",
  },
  annuityPayoutRate: {
    label: "Annuity payout rate",
    context: "Annual income as a % of the annuity's value at the start age (SPIA-style, e.g. ~6% at 65). Higher for older start ages.",
  },
  mygaCapital: {
    label: "MYGA lump sum",
    context:
      "A fixed annuity (MYGA) is a 'tax-deferred CD': a lump grows at a guaranteed rate, gains taxed as ordinary income (+10% penalty before 59½) at cash-out. The card compares it to a taxable CD and to investing. 0 = off.",
  },
  mygaRate: {
    label: "MYGA guaranteed rate",
    context: "The fixed annual rate the MYGA credits for the term. Compare it to current CD/Treasury yields — the annuity's only edge over a CD is the tax deferral.",
  },
  mygaTermYears: {
    label: "MYGA term",
    context: "The guarantee period (e.g. 3 years). Cashing out before the term ends usually triggers surrender charges; you can renew at the then-current rate.",
  },
  mygaCashOutAge: {
    label: "MYGA cash-out age",
    context: "The age you actually take the money (0 = end of the first term). Setting it past the term models renewing — the tax deferral compounds, and cashing out in a low-bracket retirement year (and after 59½) helps most.",
  },
  treasuryRate: {
    label: "Treasury yield",
    context:
      "The yield on Treasuries/T-bills for the MYGA comparison. Treasury interest is federal-taxable but state-tax-EXEMPT — so in a high-tax state a Treasury can beat a CD at the same rate. Munis are tax-free at both levels.",
  },
  spouseSsAge: {
    label: "Spouse SS at",
    context: "The age your spouse claims Social Security. Their benefit is added to the household pool at that age.",
  },
  spouseSsBenefit: {
    label: "Spouse benefit / mo",
    context: "Your spouse's monthly Social Security benefit in today's dollars, at their claiming age.",
  },

  // ── Money: 401k / Roth / savings ────────────────────────────
  salary: {
    label: "Salary",
    context: "Used only to compute the employer 401k match (salary × match %).",
  },
  k401Today: {
    label: "401k / Traditional balance",
    context:
      "Current pre-tax balance. Compounds to your retire age at the stock return; withdrawals in retirement are taxed as ordinary income.",
  },
  k401AnnualContrib: {
    label: "401k contribution / yr",
    context: "Your annual pre-tax contribution while working. Employer match is added on top.",
  },
  employerMatchPct: {
    label: "Employer match %",
    context: "Percent of salary your employer matches into the 401k. Added on top of your own contribution.",
  },
  rothTotal: {
    label: "Roth IRA balance",
    context:
      "Your existing Roth balance. Contributions are always withdrawable tax-free; earnings are tax-free after 59½.",
  },
  rothAnnualContrib: {
    label: "Roth contribution / yr",
    context: "Annual Roth contribution. Compounds tax-free.",
  },
  rothYearsContrib: {
    label: "Years contributing",
    context: "How many years you've contributed to the Roth — used to split your balance into contributions vs. earnings.",
  },
  existingRothEarnings: {
    label: "Existing Roth earnings",
    context:
      "The earnings portion of your current Roth balance (locked until 59½). Leave at 0 if unsure — the planner estimates the split.",
  },
  cashDeposit: {
    label: "CD / cash deposit",
    context:
      "After-tax savings in CDs or high-yield accounts. Drawn early in retirement (after Roth contributions). Grows at the CD rate.",
  },
  muniBonds: {
    label: "Municipal bonds",
    context: "Tax-free (or state-only-taxable) bond holdings. Drawn before brokerage in the draw order.",
  },
  muniReturn: {
    label: "Muni yield",
    context: "The annual yield on your municipal bonds.",
    typical: "Investment-grade munis commonly yield ~3–5%.",
  },
  muniDoubleTaxFree: {
    label: "Muni tax status",
    context:
      "In-state munis are usually federal + state tax-free; out-of-state munis are federal-free but state-taxable.",
  },
  existingBrokerage: {
    label: "Brokerage value",
    context:
      "Current market value of your taxable brokerage. Only the gain above cost basis is taxed at your long-term capital gains rate when sold.",
  },
  existingBrokerageBasis: {
    label: "Brokerage cost basis",
    context: "What you paid for your brokerage holdings. The gain above this is what gets taxed.",
  },
  hsaBalance: {
    label: "HSA balance",
    context:
      "Health Savings Account — grows tax-free and draws tax-free for qualified medical. Sits between munis and brokerage in the draw order.",
  },
  hsaAnnualContrib: {
    label: "HSA contribution / yr",
    context: "Annual HSA contribution while working.",
  },
  brokerageMonthlyContrib: {
    label: "Brokerage contribution / mo",
    context:
      "Extra money you add to your taxable brokerage each month (e.g. from your paycheck). No contribution cap, and reachable before 59½ — the bucket the 'retire by a target age' answer points to.",
  },
  cashMonthlyContrib: {
    label: "Cash / CD contribution / mo",
    context: "Money you add to CDs or cash savings each month. Grows at the CD rate; available any time.",
  },
  muniMonthlyContrib: {
    label: "Muni contribution / mo",
    context: "Money you add to municipal bonds each month. Grows tax-free (or state-only-taxable).",
  },

  // ── Spending & Social Security ──────────────────────────────
  monthlyExpense: {
    label: "Monthly expenses",
    context:
      "Your monthly spend in today's dollars. The engine inflates it to your retire date. Exclude health insurance if you use the ACA premium field.",
  },
  ssBenefit: {
    label: "SS benefit / mo",
    context: "Monthly benefit from your SSA statement at your chosen claiming age, in today's dollars.",
  },
  ssPia: {
    label: "PIA at FRA",
    context:
      "Your Primary Insurance Amount — the benefit at your Full Retirement Age from your SSA statement. The planner computes your actual benefit from your claiming age.",
  },
  ssFra: {
    label: "Your FRA",
    context: "Your Social Security Full Retirement Age (66–67 for most people).",
  },

  // ── Assumptions ─────────────────────────────────────────────
  stockReturn: {
    label: "Stock return",
    context:
      "Nominal annual return before inflation. Everything (401k, Roth, brokerage, HSA) grows at this rate. This is the biggest lever on your projection.",
    typical: "S&P 500 long-run ≈ 10% nominal (≈ 7% real after inflation). Use a lower number for conservative planning.",
  },
  inflationRate: {
    label: "Inflation",
    context: "Applied to expenses each month in retirement, and inflates Social Security.",
    typical: "~3% is the long-run average; ~4% reflects recent years.",
  },
  cashDepositRate: {
    label: "CD rate",
    context: "Rate on cash savings during accumulation (pre-retirement), taxed at your employment bracket.",
  },
  allocationEnabled: {
    label: "Risk glide path",
    context:
      "Model your portfolio as a stock/bond/cash mix that de-risks with age (like a target-date fund), instead of one flat stock return. Blends each sleeve's return year by year. Off = the legacy flat stock return.",
    typical: "Turning this on is more realistic and usually lands your safe retirement age slightly later than assuming 100% stocks forever.",
  },
  bondReturn: {
    label: "Bond return",
    context: "Assumed annual return on the bond slice of your allocation glide.",
    typical: "~4–5% nominal for intermediate high-grade bonds.",
  },

  // ── Taxes ───────────────────────────────────────────────────
  employmentBracket: {
    label: "Employment bracket",
    context: "Your marginal federal bracket while working — used only to tax CD interest during accumulation, not retirement withdrawals.",
  },
  ltcgBracket: {
    label: "Long-term cap gains",
    context: "Your long-term capital gains rate on brokerage gains (0%, 15%, or 20%). State tax is added on top.",
  },
  stateKey: {
    label: "State income tax",
    context: "State rate applied to 401k withdrawals and brokerage gains in retirement.",
  },
  stateTaxEnabled: {
    label: "State tax on/off",
    context: "Turn off if you plan to move to a no-income-tax state in retirement.",
  },

  // ── Strategy ────────────────────────────────────────────────
  annualRothConversion: {
    label: "Roth conversion / yr",
    context:
      "Convert this much per year from 401k → Roth during the bridge (retire age → 59½) while income is low. Taxed now; unlocks tax-free after 5 years. The Maximize tab computes the optimal amount.",
  },
  conversionCeiling: {
    label: "Conversion bracket-fill",
    context: "Instead of a fixed amount, convert just enough each year to fill to the top of a chosen tax bracket.",
  },
  rule55: {
    label: "Rule of 55",
    context:
      "If you left your employer at 55 or older, you can withdraw from that 401k before 59½ without the 10% penalty.",
  },
  annualSepp: {
    label: "72(t) SEPP / yr",
    context:
      "Substantially Equal Periodic Payments — a fixed annual 401k draw for 5 years or until 59½, penalty-free. Useful when Rule of 55 doesn't apply. 0 = none.",
  },
  guardrailUpper: {
    label: "Upper guardrail (WR)",
    context: "If your withdrawal rate rises above this, spending is cut 10% the next year (Guyton-Klinger).",
    typical: "Often set around 5–6%.",
  },
  guardrailLower: {
    label: "Lower guardrail (WR)",
    context: "If your withdrawal rate falls below this (portfolio growing fast), spending is raised 10%.",
    typical: "Often set around 3%.",
  },

  // ── Healthcare ──────────────────────────────────────────────
  monthlyAcaFullPremium: {
    label: "ACA benchmark premium / mo",
    context:
      "Unsubsidized benchmark silver-plan premium for your household (pre-65). Below 400% FPL you pay a sliding share of income (2.1–9.96%); above the cliff you pay this full amount. At 65 Medicare replaces it. Enter only if not already in your monthly expenses.",
  },
  monthlyIrmaaSurcharge: {
    label: "IRMAA / mo",
    context:
      "Medicare Part B+D surcharge at 65+ for higher-income retirees, based on income from two years prior. Enter only the surcharge above standard Part B.",
  },
  stateSsExemptRate: {
    label: "State SS exemption",
    context: "Many states don't tax Social Security income. Reduces the state tax applied to your SS benefit.",
  },

  // ── Estate ──────────────────────────────────────────────────
  assumeStepUpBasis: {
    label: "Step-up in basis",
    context:
      "When on, heirs inherit brokerage at date-of-death value and unrealized gains are erased. When off, the embedded gain is taxed in the estate value. Affects the estate figure only, not your spending.",
  },
  legacyTarget: {
    label: "Legacy target",
    context:
      "The estate you want to leave, in today's dollars. Results show whether your plan clears it. Display-only — it does not change assumed spending.",
  },

  // ── Advanced ────────────────────────────────────────────────
  birthYear: {
    label: "Birth year override",
    context:
      "Leave at 0 to derive from your age. Sets your exact RMD start age (73 vs 75 under SECURE 2.0) and Full Retirement Age.",
  },
  oneTimeExpenses: {
    label: "One-time expenses",
    context:
      "Lump costs at a specific age (wedding, roof, new car) in today's dollars. Inflated to that year and funded through the normal draw order.",
  },
  phaseSpending: {
    label: "Phase spending",
    context:
      "Retirement spending rarely stays flat. Set a multiplier for the go-go / slow-go / no-go phases (1.0 = no change) and the ages they begin.",
    typical: "A common glide path is go-go 1.1, slow-go 1.0, no-go 0.8.",
  },

  // ── Retire Early goal-seek (analysis-only, not a sidebar input) ──
  targetRetireAge: {
    label: "Target retire age",
    context:
      "This uses your Retire at age from the sidebar. The planner solves for the extra monthly savings needed to make that age work — and the retirement spending you'd have to accept instead if you don't save more. Change Retire at to explore other ages.",
  },

  // ── Scenario ────────────────────────────────────────────────
  scenarioMode: {
    label: "Scenario mode",
    context:
      "Deterministic uses your mean return every year. Stress Test replays a sharp early-retirement crash, and Historical replays a real bad market sequence — both shown alongside, never replacing, your headline verdict.",
  },
  stressDropPct: {
    label: "Crash size",
    context: "The annual return during the crash years (e.g. −30%).",
  },
  stressYears: {
    label: "Crash years",
    context: "How many early-retirement years the crash lasts before reverting to your mean return.",
  },
  historicalScenario: {
    label: "Historical period",
    context:
      "Replays the actual market returns from a real bad retirement start (2000, 2007, 2022, or 1973), landing the worst years right at retirement. After recorded history ends, it reverts to your mean return.",
  },
  historicalLens: {
    label: "Returns series",
    context:
      "S&P 500 applies all-equity returns to your whole portfolio (most dramatic). 60/40 blend applies a 60% stock / 40% bond return — closer to a balanced retiree's experience.",
  },
};

// Ordered groups for the DocsPanel "Inputs reference" section, so the
// docs and the tooltips render from the same text.
export const FIELD_HELP_GROUPS = [
  { title: "Who you are / Timeline", ids: ["filingStatus", "currentAge", "retireAge", "lifeExpect", "ssAge", "householdSize"] },
  { title: "Spending & Social Security", ids: ["monthlyExpense", "ssBenefit", "ssPia", "ssFra"] },
  { title: "Accounts & savings", ids: ["k401Today", "k401AnnualContrib", "employerMatchPct", "rothTotal", "rothYearsContrib", "existingRothEarnings", "cashDeposit", "cashMonthlyContrib", "muniBonds", "muniMonthlyContrib", "existingBrokerage", "existingBrokerageBasis", "brokerageMonthlyContrib", "hsaBalance"] },
  { title: "Assumptions", ids: ["stockReturn", "inflationRate", "cashDepositRate"] },
  { title: "Taxes", ids: ["employmentBracket", "ltcgBracket", "stateKey", "stateTaxEnabled"] },
  { title: "Strategy", ids: ["annualRothConversion", "conversionCeiling", "rule55", "annualSepp", "guardrailUpper", "guardrailLower"] },
  { title: "Healthcare & Medicare", ids: ["monthlyAcaFullPremium", "monthlyIrmaaSurcharge", "stateSsExemptRate"] },
  { title: "Estate & legacy", ids: ["assumeStepUpBasis", "legacyTarget"] },
  { title: "Advanced", ids: ["birthYear", "oneTimeExpenses", "phaseSpending"] },
  { title: "Scenario testing", ids: ["scenarioMode", "stressDropPct", "stressYears", "historicalScenario", "historicalLens"] },
];
