# Reti Onboarding Flow — Screen Content Spec

**Status:** Phase 4 (copy) — awaiting confirmation before implementation.
**Replaces:** `src/components/panels/QuickStart.jsx` (single popup).
**Goal:** Capture high-signal inputs (esp. real account mix) + teach as you go. Web app; renders desktop + `MobileShell`. Writes via `setInputs` + `QS_KEY`.

**Decisions:** required spine + skippable depth · live result updating as you answer · soft Ask Pro at end.

**Voice:** calm, plain-English, second-person ("you"), specific. No jargon in headlines; jargon allowed in guidance microcopy where it teaches. Footer on every screen: _"Educational planning tool — not financial advice."_

**Progress:** thin bar top of every screen (Steps 1–7 of the spine; the optional menu at 8 is "bonus", not counted against the bar). Back arrow on every screen except 1.

---

## Step 1 — Welcome (hook)

- **Eyebrow:** START HERE
- **Headline:** **See exactly when your money runs out — and what to do about it.**
- **Subhead:** A tax-accurate picture of your retirement in about two minutes. Answer a few questions and watch your plan come alive.
- **Device preview:** the app's portfolio-depletion chart (reference `PortfolioChartCard` / `StackedChart`).
- **Primary CTA:** `Build my plan →`
- **Secondary:** `Skip — I'll fill it in myself` (dismisses, same as today's Skip)

---

## Step 2 — Life stage (THE FORK)

- **Headline:** **Where are you right now?**
- **Subhead:** This shapes everything that follows.
- **Options (single-select, large cards):**
  - 💼 **Still working** — building toward retirement → sets `alreadyRetired: false`
  - 🌅 **Already retired** — living off my savings → sets `alreadyRetired: true`, pins `retireAge = currentAge`
- **Inline field (below, both paths):** "I'm ___ years old" → `currentAge` (NumInput, 25–90)
- **CTA:** `Continue →` (enabled once age set)

---

## Step 3 — About you

- **Headline:** **A little about your household.**
- **Subhead:** Your filing status and state change how every dollar is taxed — this is what makes Reti accurate.
- **Fields:**
  - **Filing status** → `filingStatus` (Single / Married filing jointly / Head of household). Selecting "Married" reveals the spouse block.
  - **Spouse?** → `hasSpouse`. If yes: spouse's Social Security claim age → `spouseSsAge` (SS benefit captured at Step 6).
  - **People in your household** → `householdSize` (drives ACA/FPL). Guidance: _"Include everyone your budget supports — used for healthcare subsidy math."_
  - **State** → `stateKey` (searchable dropdown), `stateTaxEnabled`. Guidance: _"Some states don't tax retirement income at all — Reti knows the difference."_
- **CTA:** `Continue →`

---

## Step 4 — Your money (THE KEY SCREEN)

- **Headline:** **What have you saved — and where?**
- **Subhead:** These accounts are taxed *very* differently. Splitting them out is the single thing that makes your answer real instead of a guess.
- **Buckets** (each a labeled $ input; a running total sums at the bottom). Non-zero buckets shown; zero buckets collapse behind `+ Add another account`:
  - 🏦 **401(k) / traditional IRA** → `k401Today` — _"Pre-tax. Taxed as income when you withdraw."_
  - 🌱 **Roth IRA / Roth 401(k)** → `rothTotal` — _"Already taxed. Grows and comes out tax-free."_
  - 📈 **Taxable brokerage** → `existingBrokerage` (+ "What did you pay for it?" → `existingBrokerageBasis`, default = same) — _"You're taxed only on the gains, at lower rates."_
  - 💵 **Cash / CDs / savings** → `cashDeposit`
  - 🩺 **HSA** → `hsaBalance` — _"Triple tax-free for medical costs."_
  - 🏛️ **Municipal bonds** → `muniBonds` — _"Interest is federally tax-free."_
- **Running total footer:** "Total saved: **$X**"
- **CTA:** `Continue →`

---

## Step 5 — Still saving *(WORKING PATH ONLY — skipped entirely if retired)*

- **Headline:** **How fast are you building it?**
- **Subhead:** Your savings between now and retirement.
- **Fields:**
  - **I plan to retire at** → `retireAge` (min currentAge+1). Guidance: _"You can change this anytime — Reti will also tell you the *earliest* age that's safe."_
  - **Annual salary** → `salary`
  - **Into my 401(k) each year** → `k401AnnualContrib` (default = IRS limit) + **Employer match %** → `employerMatchPct`. Guidance: _"The match is free money — most people should grab all of it first."_
  - **Into my Roth each year** → `rothAnnualContrib`
  - **Into brokerage each month** → `brokerageMonthlyContrib` (optional)
- **First appearance of the live result strip** (see below).
- **CTA:** `Continue →`

---

## Step 6 — Spending & Social Security

- **Headline:** **What will retirement cost — and what will Social Security cover?**
- **Fields:**
  - **Monthly spending in retirement** → `monthlyExpense`. Guidance: _"In today's dollars. Most people underestimate healthcare — that's covered separately if you want to add it later."_
  - **Your Social Security** → `ssBenefit` (monthly) + **claim at age** → `ssAge`. Guidance: _"Don't know it? Grab your real number from ssa.gov — or leave our estimate. Typical is $1,500–$3,000/mo."_
  - *(if `hasSpouse`)* **Spouse's Social Security** → `spouseSsBenefit` (+ `spouseSsAge` from Step 3).
- **Live strip updates.**
- **CTA:** `See my plan →`

---

## Step 7 — Building your plan → the reveal (PAYOFF)

- **Processing moment (~1.5s):** pulsing Reti mark — "Running your plan, month by month…"
- **Reveal — headline branches:**
  - **Retired:** **Your money lasts to age {N}.** (green if ≥ lifeExpect, amber if short)
    - Sub: "Based on {monthlyExpense}/mo and everything you told us."
  - **Working:** **You're on track to retire at {N}.** / (if their target is safe) **Retiring at {retireAge}? You've got it — money lasts to {M}.**
- **Two supporting stat chips:** e.g. "Safe to spend: $X/mo" · "Estate at {lifeExpect}: $Y"
- **Reassurance:** _"This updates the instant you change anything. Want it sharper?"_
- **Primary CTA:** `Sharpen my plan →` (to Step 8)
- **Secondary:** `Take me to the app →` (skip depth, go to Step 9→10)

---

## Step 8 — Sharpen it *(OPTIONAL DEPTH — skippable menu)*

- **Headline:** **Want a sharper plan?**
- **Subhead:** Add any of these, or skip them all and refine later in the sidebar. Each takes under a minute.
- **Cards (tap to expand a mini-form inline; completed cards get a ✓):**
  - 🩺 **Healthcare before Medicare** → `monthlyAcaFullPremium`, `autoMedicare`, `hsaQualifiedFraction`. _"The ACA gap years are a big early-retirement cost."_
  - 💰 **Pension, annuity or part-time income** → `incomeStreams[]`; **and costs that end** (mortgage) → `expenseStreams[]`.
  - 🧾 **Taxes & conversions** → `autoLtcg`, `stateSsExemptRate`, `annualRothConversion`/`conversionCeiling`. _"Roth conversions in low-income years can save six figures."_
  - 📉 **Spending phases** → `goGoMult`/`slowGoMult`/`noGoMult` + ages. _"Most people spend more early ('go-go years'), less later."_
  - 📊 **Market assumptions** → `stockReturn`, `inflationRate`, `cashDepositRate`.
  - 🎁 **Leave an estate** → `legacyTarget`, `assumeStepUpBasis`.
  - 🌊 **One-time events** → `oneTimeExpenses[]` (windfalls = negative), `survivorAge`.
- Every expansion updates the live strip.
- **CTA:** `Done — see my plan →`

---

## Step 9 — Ask Reti *(soft Ask Pro)*

- **Headline:** **Now ask it anything.**
- **Subhead:** "When should I take Social Security?" · "What if the market drops 30% my first year?" · "Can I spend more?"
- **Body:** Reti's chat answers in plain English and can run the numbers on your exact plan. _(Soft line, no wall:)_ "A few questions are free every day; **Ask Pro** removes the limit."
- **Primary CTA:** `Explore my plan →`
- **Secondary:** `Learn about Ask Pro` (opens paywall/entitlement info — non-blocking)

---

## Step 10 — Enter the app

- Sets `QS_KEY`, applies all collected inputs via `setInputs`, dismisses the flow, lands on the results tab (RetiredPanel if retired, EarlyPanel if working) with the sidebar pre-filled.

---

## The live result strip (Steps 5–8)

A slim persistent bar (bottom on mobile, top or side on desktop) that recomputes via the same `makePlan`/`runMain` path the app uses, on every field change:
- **Working:** "On track: retire at **{earliestAge}** · money lasts to **{depletionAge}**"
- **Retired:** "Money lasts to **{depletionAge}**" + green/amber dot vs `lifeExpect`.
- Debounced; never blocks input. It's the "watch it come alive" hook that makes Step 7 feel earned.

---

## Field coverage summary

**Spine (everyone):** `currentAge`, `alreadyRetired`, `filingStatus`, `hasSpouse`, `spouseSsAge`, `householdSize`, `stateKey`, `k401Today`, `rothTotal`, `existingBrokerage`(+basis), `cashDeposit`, `hsaBalance`, `muniBonds`, `monthlyExpense`, `ssBenefit`, `ssAge`, `spouseSsBenefit`.
**Spine (working only):** `retireAge`, `salary`, `k401AnnualContrib`, `employerMatchPct`, `rothAnnualContrib`, `brokerageMonthlyContrib`.
**Optional depth:** healthcare, income/expense streams, tax/conversion, spending phases, market assumptions, estate, one-time/survivor.
**Left at defaults / sidebar-only:** `lifeExpect`, `ssPia`/`ssFra`, guardrails, rule55/SEPP, scenario testing, muni yields, birthYear — all sensible defaults, refined later.
