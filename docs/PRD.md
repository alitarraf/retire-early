# Retirement Planner — Product Requirements Document

**Status:** Draft v1 · **Owner:** Ali Tarraf · **Last updated:** 2026-06-16
**Source artifacts:** `retirement-planner.jsx` (working prototype), `README.md` (handoff/migration brief)

> **Disclaimer.** This tool produces *planning estimates*, not tax or financial advice. Every dollar figure tied to the tax code (brackets, standard deduction, contribution limits, FPL, IRMAA thresholds, RMD ages) changes annually and must be reviewed each year. Treat all outputs as directional.

---

## 1. Overview & vision

The Retirement Planner is a **tax-aware retirement planning tool** that answers two questions a saver actually cares about, through two modes:

- **Retire Early** — *"What is the earliest age I can stop working and not run out of money?"* It finds the earliest safe exit age and shows which levers move it.
- **Maximize Portfolio** — *"Given when I retire, how do I optimize what I build and what I leave behind?"* It surfaces the most sustainable spend, the estate at death, where the next savings dollar has the most leverage, and the optimal Roth-conversion amount.

What makes it different from a generic compound-interest calculator is that it models the **tax reality of early retirement**: a tax-efficient withdrawal order across account types, the pre-59½ "bridge" period when the 401k is locked, the much lower tax bracket that applies to retirement-age withdrawals, Social Security inflation and taxation, and a Roth conversion ladder. The simulation runs **month by month** and is a pure, side-effect-free function — which makes it both the highest-value and the highest-risk surface in the codebase.

The product today is a single ~915-line React artifact. This PRD captures everything already built, the complete input data model, the UI requirements, the known-good correctness invariants, the planned roadmap, and the engineering sequencing to migrate the prototype into a tested, modular codebase.

---

## 2. Target persona & use cases

**Primary persona — the early retiree.** Around age 55, planning a ~10-year "bridge" from retirement to Medicare eligibility at 65 (and to penalty-free 401k access at 59½, and to Social Security later). They have a mix of account types — 401k, Roth IRA, taxable brokerage, cash/CDs, possibly municipal bonds — and need to sequence withdrawals to minimize lifetime tax and avoid running dry before tax-advantaged money unlocks.

**Core jobs to be done:**

1. **Earliest safe exit** — find the earliest age at which money lasts to life expectancy, accounting for taxes, inflation, Social Security, and account-access rules.
2. **Tax-efficient draw order** — understand which accounts to spend from, and when, so that withdrawals are taxed as little as possible.
3. **Bridge-gap survival** — confirm that accessible (pre-59½) funds cover spending during the bridge, before the 401k unlocks.
4. **Marginal allocation** — decide where the next dollar of savings (or a Roth conversion) has the highest payoff.

---

## 3. Goals & non-goals

**Goals**

- Optimize for **after-tax portfolio longevity** (does the money last?), **estate value** (what's left at death), and **earliest retirement age**.
- Make the tax consequences of withdrawal order, Roth conversions, and account access rules **visible and actionable**.
- Keep the simulation engine **pure and testable** so every analysis routine derives from one trustworthy source of truth.
- Make the **annual tax-constant update a single-file edit**.

**Non-goals (current)**

- Not tax, legal, or investment advice.
- No integration with real financial accounts; all inputs are user-entered.
- No real-time market data; returns are user-assumed.
- Spouse accounts are modeled as a **single combined household pool**, not tracked per-spouse (deliberate simplification — see §13).

---

## 4. Current state — features already built

This section is a descriptive inventory of the working prototype (`retirement-planner.jsx`).

### 4.1 Simulation engine — `simulate()`

A **pure, side-effect-free** month-by-month drawdown simulation. It takes a snapshot of balances and assumptions *at the retirement date* and projects forward to life expectancy.

- **Cadence:** iterates monthly from `retireAge` to `lifeExpect`; emits yearly snapshots.
- **Growth:** every account compounds monthly at the assumed return; CD and muni use their own rates in projection.
- **7-step withdrawal (draw) order** each month, after Social Security offsets spending:
  1. Roth contributions (always tax- and penalty-free)
  2. Roth earnings (free after 59½)
  3. Converted Roth tranches (free after **both** the 5-year lock **and** age 59½)
  4. Municipal bonds (tax-free if double-tax-free)
  5. Taxable brokerage (LTCG taxed only on the gain fraction; basis drawn down proportionally)
  6. 401k (after 59½ only; taxed at the **effective retirement bracket** on the actual annual withdrawal)
  7. CD / cash deposit
- **Tax model:**
  - *Accumulation phase:* CD interest taxed yearly at employment bracket + state; 401k/Roth grow untaxed; brokerage gains taxed only at sale.
  - *401k withdrawals:* taxed using federal brackets on the **actual annual withdrawal** (not the working-years bracket) + state — the key insight that retirement income usually sits in a far lower bracket.
  - *Brokerage:* only gain above cost basis is taxed, at LTCG + state.
  - *Social Security:* inflated monthly with CPI; up to 85% taxable at the marginal rate; only counts once `age >= ssAge`.
  - *Roth conversion ladder:* during the bridge, converts from the 401k each year, pays marginal-rate tax (deducted from CD then brokerage), and the converted tranche unlocks tax-free 5 years later.
- **Outputs:** `{ snaps, depleted, bridgeShortfall }`
  - `snaps` — yearly `{ age, roth, brokerage, k401, cd, muni, total }`
  - `depleted` — age money runs out, or `null` if it lasts to `lifeExpect`. Fires **only** when all funds, including the then-unlocked 401k, are exhausted.
  - `bridgeShortfall` — count of months before 59½ where accessible funds fell short while the 401k was still locked (a softer signal than hard depletion).

### 4.2 Retire Early mode

- **Earliest retirement age** — linear/binary search calling `simulate()` per candidate age; returns the first age at which money lasts to `lifeExpect`.
- **Survival verdict** — derived from the *same* engine: "Retiring at X works / runs out at age Y."
- **Sensitivity analysis** — 8 levers, each re-running the full simulation with one thing changed, reported as years gained/lost: SS +$500/mo, SS +$1,000/mo, Spend −$500/−$1,000/−$2,000/mo, Max Roth $7k/yr, Add $50k munis, Take SS at 62.
- **Phase breakdown** — Bridge (`retireAge`→59½), Early Retirement (59½→`ssAge`), Full SS (`ssAge`+), each with portfolio balance and description.
- **Bridge-gap warning** — surfaces `bridgeShortfall` when accessible funds fall short before 59½, recommending munis/brokerage or the conversion ladder.

### 4.3 Maximize Portfolio mode

- **Projected balances at retirement** — per-account future values via `fvAnnuity` for ongoing contributions plus compounded existing balances.
- **Sustainable monthly spend** — binary search (20 iterations) for the maximum monthly draw where money still lasts to `lifeExpect`.
- **Estate at death** — final snapshot total.
- **Marginal value of $1k/yr** — extra estate value at death from adding $1,000/yr to each of 401k / Roth / munis, via full simulation per account.
- **Optimal Roth conversion** — exhaustive search $0–$60k in $5k steps, picking the amount that maximizes estate value.

### 4.4 Inputs & configuration (as built)

Timeline; monthly spending & expected SS benefit; rates (stock return, inflation, CD rate); 401k (balance, annual contribution, salary, employer match %, with FV-annuity treatment of future contributions); Roth IRA (balance, contribution/yr, years contributed → contribution/earnings split, existing earnings); CD/cash; municipal bonds (balance, yield, double-tax-free toggle); taxable brokerage (value, cost basis); tax config (employment bracket, LTCG bracket, ~19 states with flat effective rates, on/off toggle); Roth conversion ladder amount; a 401k withdrawal tax preview.

### 4.5 UI/UX (as built)

Two-mode tab bar; a derived-values "sanity strip"; a left input panel and a right output panel; a stacked portfolio-over-time chart (phase-shaded background, legend); a federal bracket bar visualizing effective/marginal rates; reusable input primitives (`NumInput`, `Select`, `Toggle`, `Collapsible`, `Row`, `Section`, `Card`). Design language: muted green palette, `Inter` for text, `JetBrains Mono` for figures, card-based outputs.

### 4.6 Tax constants (as built)

2025 single-filer values: `STD_DEDUCTION = 14600`; 7-tier `FED_BRACKETS`; 401k limit `23000`; Roth IRA limit `7000`; a `STATE_TAXES` table (~19 states, flat effective rates). **Known simplification:** state tax is applied as a flat rate to all income types (several states treat SS/retirement income differently — see §9 P5).

> **Constants update:** the live constants file is now `TAX_YEAR = 2026` (MFJ default), with 2026 brackets, `STD_DEDUCTION` and contribution limits (`k401 = 24500`, `rothIra = 7500`, HSA family `8550`). Verify against final IRS publications before relying on projections.

### 4.7 Recent additions (roadmap P0–P5 + tax accuracy + medium pass) — *shipped*

The full P0–P5 roadmap below is **built**, and the simulation engine has since gained tax-accuracy and usability work:

- **Engine (`simulate()`):** RMDs (SECURE 2.0 age 73/75 + Uniform Lifetime table), ACA MAGI cliff, Rule of 55, 72(t) SEPP, Monte Carlo via a per-year `returnSeries` hook, Guyton-Klinger guardrails, IRMAA, HSA, state SS exemption, SS provisional-income taxation (up to 85%), marginal-rate traditional withdrawals, and **step-up in basis** (`assumeStepUpBasis`) — heirs inherit brokerage at market value unless toggled off, in which case the embedded gain is taxed into the estate.
- **Medium pass (this PRD — `PRD_Next_Medium_Roadmap_June2026.md`):**
  - **One-time / lump-sum expenses** — an editable list of `{ age, amount }` (today's $), inflated to the spend year and funded through the draw order.
  - **Phase-based spending** — go-go / slow-go / no-go multipliers with configurable boundary ages (identity defaults preserve prior behavior).
  - **Birth-year override** — authoritative for the RMD start age; surfaces the SSA Full Retirement Age as a hint.
  - **Legacy / estate target** — projected estate vs an inflated target (display-only gap).
  - **Deterministic stress test** — an early-crash bad-sequence run shown as an illustrative downside card, separate from the headline verdict.
  - **Tax transparency** — `simulate()` now also returns `taxSummary` (`ssTaxableFrac`, `k401EffRate`) surfaced in both result panels.
- **Priority 3 robustness (PRD §3.5):**
  - **Marginal-rate solver** — the 401k gross-up now uses a 50-step **bisection** (`grossUpMonthly`) instead of a 3-iteration fixed point, which converges robustly even when a draw straddles a federal bracket boundary. Identical to the old result except on bracket-straddling draws (where bisection is strictly more accurate).
  - **RMD tax cash-flow** — a forced RMD now reinvests the **full gross** into the taxable brokerage and pays the income tax explicitly from cash (`cd`) then brokerage (`bk`). This is slightly more conservative than netting the tax out of the proceeds; total wealth still drops by exactly the tax. (Degenerates to the prior behavior when `cd = 0`.)
- **Updated outputs:** `simulate()` now returns `{ snaps, depleted, bridgeShortfall, estateGainTax, taxSummary }`.
- **UI:** the left accordion sidebar gained **Estate**, **Advanced**, and **Scenario** sections; the in-app "How it works" tab documents all of the above.
- **Tests:** regression coverage added in `src/__tests__/roadmap.test.js` (one-time firing/inflation, phase multipliers, birth-year→RMD, FRA schedule, stress monotonicity, tax-summary capture, default inertness) and `src/__tests__/priority3.test.js` (solver convergence across a bracket boundary, RMD tax cash-flow with `cd > 0`, step-up on/off estate gain tax, low-provisional-income SS taxation). Full suite: **122 passing**.

> **Still display-only:** the legacy target shows a projected-estate-vs-target gap; it does not feed the sustainable-spend search (a defensible MVP choice, noted for future work).

---

## 5. Input variable catalog (complete)

The full set of inputs the simulation should accept, grouped by category. Each is tagged **`[built]`** (present in the prototype) or **`[new]`** (missing, proposed). This is the data model the engine and UI are built around; `[new]` rows map to roadmap items.

| Category | Variable | Status | Notes / consumed by |
|---|---|---|---|
| **Household & filing** | Filing status (Single / MFJ / HoH; MFS optional) | `[new]` | Brackets, std deduction, SS taxability, ACA FPL, IRMAA (§6) |
| | Your birth year | `[new]` | More precise than current age; drives RMD age & full retirement age (SECURE 2.0) |
| | Current age | `[built]` | Timeline base |
| | Household size / # dependents | `[new]` | ACA FPL (P1) |
| | State while working | `[new]` | Accumulation-phase tax |
| | State in retirement | `[built→split]` | Can differ from working state |
| **Spouse** (shown only when MFJ) | Spouse birth year / current age | `[new]` | Timeline, RMD |
| | Spouse retire age | `[new]` | |
| | Spouse SS benefit & claiming age | `[new]` | Dual SS, survivor dynamics |
| | Spouse pre-retirement income | `[new]` | Household tax |
| | Spouse account balances (or "combine household" toggle) | `[new]` | Open question §13 |
| **Timeline** | Retire age | `[built]` | |
| | SS claim age | `[built]` | |
| | Life expectancy | `[built]` | |
| | Spouse equivalents | `[new]` | |
| **Pre-retirement income** | Salary | `[built]` | Employer match base |
| | Employer match % | `[built]` | |
| | Other income (bonus / RSU / side) | `[new]` | |
| **Spending** | Monthly expenses today (inflated to retirement) | `[built]` | |
| | Phase-based spending (go-go / slow-go / no-go) | `[new]` | Pairs with guardrails (P4) |
| | Healthcare split (ACA pre-65 vs Medicare post-65) | `[new]` | P1 / P5 |
| | One-time / lump expenses (year + amount) | `[new]` | Home, college, car |
| | Legacy / estate target (amount to leave) | `[new]` | Maximize mode goal |
| **Accounts** (balance + contribution + assumed return) | 401k / traditional (balance, annual contribution, match, salary) | `[built]` | |
| | Roth IRA (balance, contribution/yr, years contributed, earnings split) | `[built]` | |
| | Taxable brokerage (value, cost basis, LTCG rate) | `[built]` | |
| | CD / cash (balance, rate) | `[built]` | |
| | Municipal bonds (balance, yield, double-tax-free) | `[built]` | |
| | HSA (balance, contribution) | `[new]` | P5 |
| | Pension (annual amount, start age, COLA y/n) | `[new]` | |
| | Annuity / other guaranteed income | `[new]` | |
| **Retirement income** | Social Security benefit (you) | `[built]` | |
| | SS claiming-age actuarial adjustment (62 / FRA / 70) | `[new]` | P5 |
| | Spouse SS + survivor consideration | `[new]` | |
| | Pension / annuity / rental / part-time | `[new]` | |
| **Rates & assumptions** | Stock/nominal return, inflation, CD rate, muni yield | `[built]` | |
| | Return standard deviation | `[new]` | Monte Carlo (P3) |
| | Asset allocation / glide path | `[new]` | Optional, future |
| **Tax** | Filing status (cross-ref Household) | `[new]` | |
| | Employment bracket (or derive from income) | `[built]` | |
| | Long-term cap-gains bracket | `[built]` | |
| | State tax (with income-type nuance) | `[built]` / `[new]` | Nuance = P5 |
| **Strategy levers** | Annual Roth-conversion amount (or "convert to top of bracket") | `[built]` / `[new]` | |
| | Rule of 55 toggle | `[new]` | P2 |
| | 72(t) SEPP mode | `[new]` | P2 |
| | 401k withdrawal tax preview | `[built]` | |
| | Custom withdrawal-order override | `[new]` | Optional |

---

## 6. Filing status — captured as input data

Filing status is one of the household inputs in §5, **not** a separate workstream. It is documented here only so its effects aren't forgotten when the features that consume it are built:

- Federal **bracket widths** and the **standard deduction** differ for MFJ (roughly double the single values).
- **Social Security taxability** thresholds differ.
- **ACA FPL** scales with household size (P1).
- **IRMAA** thresholds differ (P5).
- MFJ implies **two SS benefits** and **survivor** dynamics.

Where it plugs in — `effectiveFedRate`, `marginalFedRate`, `FED_BRACKETS`, `STD_DEDUCTION`, and the SS/ACA/IRMAA logic — is noted alongside each feature that consumes it, rather than treated as a foundational milestone.

---

## 7. UI/UX requirements & layout

Formalizes the two-column shell the prototype already hints at.

- **Left column = all inputs; right column = all outputs.** Inputs never appear on the right; outputs never appear on the left.
- **One-screen goal.** Primary inputs fit a single viewport without scrolling. Achieved via grouped sections, compact controls, sensible defaults, and **progressive disclosure** — rare/advanced inputs (tax config, conversion ladder, 72(t), spouse details, phase spending) live in collapsible panels (the existing `Collapsible` pattern), collapsed by default; only high-signal inputs are visible up front.
- **Intuitive top-to-bottom input flow**, ordered the way a person thinks:
  **Who you are** (filing status, ages, household) → **Timeline** → **Income** → **Spending** → **Accounts / savings** → **Assumptions (rates)** → **Tax** → **Strategy**.
  Spouse fields appear inline only when MFJ is selected.
- **Right-column output priority:** headline verdict / earliest age at the very top (most important answer first) → supporting analysis (sensitivity, marginal value, or optimal conversion depending on mode) → portfolio-over-time chart → a details/assumptions footnote. The same left input column feeds both modes; only the right column swaps.
- **Live recompute** as inputs change (already via `useMemo`), with a persistent sanity strip summarizing key derived numbers.
- **Responsive:** columns stack on narrow viewports (inputs first, then outputs), preserving the same order.
- **Visual language:** keep the existing palette, `JetBrains Mono` for figures, and card-based outputs — unless the M0 refactor adopts a styling system (open question §13).

---

## 8. Known correctness invariants

The five hand-validated scenarios from the handoff brief, reframed as **acceptance/regression criteria**. A refactor must not change these outputs without an explicit, understood reason.

- **A — Roth conversion shifts balances.** With conversion on vs off, total at ages 58–60 stays ~equal (conversion is tax-neutral short-term; it just moves money between buckets minus tax cost), and the converted scenario's end-of-life total is ≥ the unconverted one. *Bug guard:* if conversion makes no difference at all, it isn't wiring into `k`/`roth_conv`.
- **B — No false depletion during the bridge.** If Roth contributions run dry before 59½ but the 401k holds a large balance, the model must **not** report hard `depleted` in the bridge — it survives once the 401k unlocks, or reports `bridgeShortfall`.
- **C — Social Security must inflate.** Net SS at 70 exceeds net SS at 67 in nominal terms (CPI), provided the scenario doesn't deplete before `ssAge`.
- **D — Earliest-age and verdict must agree.** Both derive from the same engine. If the verdict says retiring at `retireAge` fails, `earliestRetireAge > retireAge`; if it succeeds, `earliestRetireAge <= retireAge`.
- **E — Default-scenario sanity.** The shipped defaults produce a realistic seven-figure portfolio at retirement (not ~$266k — that would mean the FV annuity on future contributions isn't applied).

---

## 9. Planned features — roadmap

> **Status (2026-06-17):** P0–P5 below are all **shipped** (see §4.7). The descriptions are retained for design rationale and tax-year detail. Remaining future work has moved to `PRD_Next_Medium_Roadmap_June2026.md` §7: deeper Monte Carlo visualization, a multi-year bracket-filling Roth optimizer, post-65 healthcare modeling, and per-state income-type exclusion tables.

Ordered by impact on the early-retiree persona. Each item: rule, tax-year detail, engine hook.

### P0 — RMDs (Required Minimum Distributions) — *correctness bug*
The model lets the 401k grow and be drawn optimally; the IRS forces withdrawals, which can push the user into a higher bracket — so late-retirement taxes are currently understated.
- **Rule:** RMD age 73 for those born 1951–1959, **75 for those born 1960+** (SECURE 2.0).
- **Formula:** `RMD = prior_year_end_balance / Uniform_Lifetime_factor(age)` (factor 26.5 at 73, decreasing) — implement the table as a lookup.
- **Tax:** ordinary income at the retirement bracket. Roth IRAs have **no** lifetime RMDs.
- **Engine hook:** once `age >= rmdAge`, force a minimum 401k withdrawal even if `need` is met; tax it; route the post-spending excess into the taxable brokerage. Deterministic, easy to test — **build first.**

### P1 — ACA subsidy cliff / MAGI management — *highest dollar impact for early retirees*
On the ACA marketplace from 55→65; arguably the single most important number in early-retirement planning, and it interacts directly with draw order and conversions (both move MAGI).
- **Rule:** enhanced credits expired end of 2025; the **400% FPL cliff is back for 2026** (~$62,600 MAGI single, 2026). Above it, full price — potentially >$1,500/mo at 62.
- **Interaction:** Roth withdrawals do **not** count toward MAGI; traditional 401k withdrawals and Roth **conversions do**. Tension: aggressive conversions raise MAGI past the cliff, and the IRMAA 2-year lookback raises Medicare premiums later.
- **New inputs:** household size, filing status, state (FPL — AK/HI differ), estimated full-price premium.
- **Engine hook:** compute annual MAGI inside `simulate()` (traditional withdrawals + conversions + taxable interest/gains + 85% of SS, minus Roth withdrawals), compare to the FPL cliff, add/subtract premium subsidy from `need`, warn when a conversion/withdrawal crosses the line.

### P2 — Rule of 55 & 72(t) SEPP — *fixes bridge-gap advice*
The model treats the 401k as fully locked until 59½; two legitimate early-access doors exist.
- **Rule of 55:** penalty-free withdrawals from the 401k of the employer you just left if you separate in/after the year you turn 55. Flexible (no fixed schedule).
- **72(t) SEPP:** substantially equal periodic payments before 59½ via one of three IRS methods; must continue **5 years or until 59½, whichever is longer**; rigid (busting it triggers retroactive penalties).
- **Engine hook:** a "Rule of 55" toggle unlocks flexible 401k draw from `retireAge`; a separate "72(t)" mode forces a fixed annual withdrawal for the required period.

### P3 — Monte Carlo / sequence-of-returns risk — *methodology upgrade*
Straight-line projection hides the most dangerous early-retirement risk: a bad market in the first 3–5 years.
- **Approach:** run N (~1,000) simulations drawing annual returns from a distribution (mean = `stockReturn`, std-dev input ~15–18%); report **probability of success**. Lighter alternative: a fixed "stress test" (e.g. 30% crash in years 1–3).
- **Reporting caveat:** show **magnitude** of failure, not just probability ("runs out at year 28 of 30" ≠ "year 12").
- **Engine hook:** wrap `simulate()` in a loop with a stochastic return generator; the engine stays pure and takes a per-year return series (or a seedable RNG) instead of a flat rate.

### P4 — Dynamic spending / guardrails
- **Approach:** Guyton-Klinger guardrails — cut spending in bad years, raise in good ones, within bands. Pairs naturally with P3.
- **Engine hook:** make monthly spend adjust based on the prior year's performance relative to a guardrail band.

### P5 — Lower-priority correctness
- **IRMAA** Medicare surcharges (cliff-based, 2-year lookback; matters at 63+; interacts with P1 conversions).
- **SS claiming-age adjustment** (62 vs FRA vs 70 swings the benefit ~7–8%/yr).
- **State-tax income-type nuance** (e.g. Oregon exempts some SS/retirement income).
- **HSA** (triple-tax-advantaged).

---

## 10. Technical architecture & engineering plan

### 10.1 Target module structure
Migrate the monolith toward (from the handoff brief):

```
src/
  engine/        simulate.js · tax.js · accounts.js · rmd.js* · aca.js* · socialSecurity.js* · earlyAccess.js* · monteCarlo.js*
  analysis/      earliestRetireAge.js · sensitivity.js · marginalValue.js · optimalConversion.js
  components/    inputs/ · panels/ · charts/
  constants/     brackets.js   (FED_BRACKETS, STATE_TAXES, STD_DEDUCTION, limits, TAX_YEAR)
  App.jsx
  __tests__/     simulate.test.js (priority) · tax.test.js · rmd.test.js · aca.test.js
```
`*` = new modules added by the roadmap.

### 10.2 Critical React note (carried from the prototype)
**Never define components inside another component's render body.** The prototype originally nested `LeftPanel`/`EarlyPanel`/`MaximizePanel` inside the main function, creating new component types every render — React unmounted/remounted the subtree on each keystroke, destroying input focus and scroll. They were converted to render functions; in the refactor, make them **real top-level components in their own files with props.**

### 10.3 The `simulate()` contract (stable interface)
`simulate(inputs) → { snaps, depleted, bridgeShortfall }`. Inputs are balances/assumptions **at the retirement date** (monthly expense already inflated by the caller; SS benefit in today's dollars, inflated by the engine). The 7-step draw order and tax model in §4.1 are the contract every analysis routine depends on and must be preserved/tested.

Existing helpers to port as-is, then test: `fvAnnuity`, `effectiveFedRate`, `marginalFedRate`, and the Roth contribution/earnings split.

### 10.4 Validation strategy
- Seed the test suite from scenarios A–E (§8); treat them as regression gates.
- Spot-check engine outputs against external calculators: SmartAsset/AARP/IRS for RMDs; QuantCalc + 2026 FPL tables for the ACA cliff; CalcBee for effective retirement tax; Boldin/QuantCalc for Monte Carlo success-probability. Match within a few percent; investigate larger gaps. Verify tax constants against IRS publications for the target year.

### 10.5 Tax-year maintenance
Centralize **all** code-tied figures (brackets, standard deduction, contribution limits, FPL, IRMAA thresholds, RMD ages) in `constants/brackets.js` with a clear `TAX_YEAR` marker, so the annual update is a single-file edit. Add a visible "planning estimates, not tax advice" disclaimer.

---

## 11. Phased delivery plan (milestones)

> **Mandate:** lock correctness before adding features. M0 is a hard gate.

- **M0 — Foundation.** Scaffold the project (Vite/React + a test runner), split the monolith into modules (§10.1), extract `simulate()` as pure functions, write the A–E regression suite. **Gate: all five scenarios pass before any feature work.**
- **M-UI — Layout (runs alongside M0).** Implement the two-column / one-screen layout (§7) and wire the complete input catalog (§5) with progressive disclosure.
- **M1 — P0 RMDs.**
- **M2 — P1 ACA cliff / MAGI.**
- **M3 — P2 early access (Rule of 55 / 72(t)).**
- **M4 — P3 Monte Carlo.**
- **M5 — P4 guardrails.**
- **M6 — P5 correctness backlog** (IRMAA, SS claiming adjustment, MFJ handling, state-tax nuance, HSA).

Each milestone lists its acceptance tests and the relevant external-calculator spot-check before it's considered done.

---

## 12. Success metrics

- **Engine correctness** — A–E regression suite green; engine outputs within a few percent of reference calculators on the §10.4 checks.
- **Usability** — a user reaches an earliest-age verdict *and* an actionable lever within a single screen, no scrolling for primary inputs.
- **Maintainability** — the annual tax update is a single-file edit (`constants/brackets.js`); adding a roadmap feature touches its own engine module without breaking the `simulate()` contract.

---

## 13. Resolved decisions & remaining risks

**Resolved (2026-06-16):**

- **Target tax year → 2026.** All constants in `constants/brackets.js` carry `TAX_YEAR = 2026` and use the 2026 IRS inflation-adjusted figures (verify against IRS publications before relying on them).
- **Filing status → MFJ is the default**, with Single and Head of Household also supported. The tax engine is filing-status-aware from M0, so this is no longer a deferred P5 item.
- **Spouse accounts → single combined household pool.** No per-spouse account tracking; spouse data affects timeline, SS, and household tax only.
- **Monte Carlo (P3) → full stochastic simulation (~1,000 runs) as the primary method, with a lightweight deterministic "stress test" (fixed bad sequences) as a fast preview mode.**

**Remaining risks:**

- **Tax-constant accuracy** — 2026 figures must be reconciled against final IRS publications and 2026 FPL/IRMAA tables before launch.
- **Styling system** — keep inline styles or adopt a styling system; deferred, not blocking.
