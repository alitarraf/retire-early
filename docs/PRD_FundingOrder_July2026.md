# PRD — Funding Order: account-routing recommendation + distribution view

**Status:** Approved for implementation (2026-07-17). Branch `onboarding-flow`.
**Builds on:** `PRD_AssetAllocation_July2026.md` (this is the *account-location* axis it left as
Phase C), `PRD_ConnectedCharts_July2026.md` (the asset-mix chart lens).

## Context

**Why.** The app answers "*when* can I retire" and, via the allocation glide path, "*how risky*
is my mix." It does not answer the other question every saver has: "***where*** should my money
go — which account, in what order?" That is a distinct axis from risk:

| Axis | Means | Drives | Status |
|---|---|---|---|
| Asset allocation (risk) | stocks / bonds / cash | pre-tax return | shipped (`MixMilestones`) |
| **Account location (funding order)** | 401k / Roth / HSA / brokerage / 529 / annuity / Trump | after-tax growth, tax drag, which goals get funded | **this PRD** |

**Shape (user, 2026-07-17).** Not a new tab — **integrate** below the stock/bond/cash bars in
`AllocationCard`. Show (a) the **% split of annual savings across accounts** for the current risk
setting, (b) a **snapshot recommendation** (tax-optimal waterfall), (c) **impact on the portfolio
chart**. Routing writes an **annual savings split** (not a one-time lump). **RETI integration is
required, not deferred.** Percentages must be visible.

**Correctness fixes (by the app's own model):** include the **employer match** (free money) and
**HSA** (triple tax-free) — both absent from the initial sketch. Use the repo's real 2026 caps.

**Not advice.** Most prescriptive surface in the app: present the order as a *general best-practice
sequence* with the standing disclaimer; the **engine** shows the payoff, not prose.

## The "Trump account" (IRC §530A, OBBBA 2025) — for Phase 2

Tax-deferred IRA for a child <18, **effective 2026-07-04**. **$5,000/child/yr** cap; **$1,000
federal seed** for kids born 2025–2028; optional **$2,500 employer**; after-tax contributions,
tax-deferred growth, **earnings taxed as ordinary income** at withdrawal; **locked until age 18**,
then traditional-IRA rules. Like a 529/Coverdell it is a **kids' goal bucket** — never enters the
user's retirement drawdown; it *diverts* a slice of annual savings. Sources: Chase; IRS Notice
2025-68; Congress CRS R48910.

## Funding-order algorithm — ENGINE-DERIVED (decision: user chose option 2)

**Not a fixed textbook waterfall.** A fixed "max your tax-advantaged accounts" order was
*measured to make the verdict WORSE* in this early-retirement engine (earliest 54→55, sustainable
spend −2–4%): routing accessible brokerage into the **401k locked to 59½** starves the pre-59½
**bridge**, and the model grows taxable brokerage at the full stock return (no accumulation tax
drag) with step-up basis. So the order is **computed from the plan**: each account is ranked by
its **marginal effect on sustainable spend** (re-run drawdown with +$5k/yr into it). This is
bridge-aware for free — a locked 401k scores ~0 before 59½ and sinks below accessible Roth /
brokerage; past 59½ it rises. Because the *growth tiers* maximize sustainable spend, Apply
**improves badly-allocated plans and stays ~flat for already-efficient ones** — the honest "feeds
the numbers" story a fixed order can't promise (verified: a badly-allocated early retiree jumps
+$14k/mo, earliest 59→54; already-good early retirees stay ~flat, earliest never regresses).
*Caveat:* the two rule tiers (buffer, match) sit outside the maximization, so an already-good
plan with an uncaptured match dips a few $/mo in-model when Apply grabs the (real-world-worth-it)
match into the locked 401k — the card's copy names this rather than claiming a gain.

Two tiers stay **rules** (a deterministic drawdown can't price them):
1. **Emergency buffer** → cash to 6× monthly expense, capped at 20% of the budget (sequence-risk safety).
2. **Employer match** → 401k up to `salary × employerMatchPct` (free money the sim grants regardless).

Then **engine-ranked fill** of {HSA (if held), Roth, 401k, brokerage} by marginal sustainable-spend,
highest-first to IRS caps, brokerage the uncapped overflow (so a low-ranked locked 401k gets
nothing beyond the match). *(Phase 2 inserts kids' goals — ESA/Trump/529 — and an annuity slice.)*

Output `[{ step, key, field, label, reason, tax, amount, cap, filled, marginal }]` + `impact`
(`{ base, after, delta }` monthly sustainable spend). Lives in `src/analysis/fundingOrder.js`
(pure of React; calls `sustainableSpend` + `makePlan`, analysis layer).

## Phase 1 — Retirement buckets (integrated core; ships first, RETI included)

Scope: the **6 existing buckets** (401k, Roth, HSA, brokerage, cash, munis). **No new engine
sleeve → invariants A–E stay byte-identical.**

**Engine / analysis**
- `src/analysis/fundingOrder.js` — `recommendedFunding(plan)` (engine-ranked, above). Budget from
  summed per-account contribs (mirrors `monthlySavings`, `essentials.jsx:106`).
- **Engine seams (opt-in, inert by default → invariants A–E byte-identical):** `projectTo` gains
  `hsaAnnual`/`cashAnnual` contribution overrides (only 401k/Roth/muni/brokerage existed);
  `sustainableSpend` gains an `overrides` pass-through so the marginal probes can inject +$5k/yr.
- `src/constants/brackets.js` — 401k 50+, IRA 50+, SECURE-2.0 60–63 catch-ups (IRS Notice 2025-67).
- **Apply (write) path:** map the recommendation to `k401AnnualContrib`, `rothAnnualContrib`,
  `hsaAnnualContrib`, `brokerageMonthlyContrib`, `cashMonthlyContrib` via `setInputs` → `projectTo`
  → earliest-age/estate + `PortfolioChartCard` all move. No new engine hook.
- **Impact readout:** the **sustainable-spend delta** (`impact.delta`, monthly) between today's
  split and the recommendation — the real "feeds the numbers" outcome, non-negative for the growth
  tiers by construction. Estate-at-death and a fixed order were rejected as confounded (step-up
  basis favors brokerage; the textbook order made the verdict worse). Apply also re-shapes the
  projection chart + hero verdict (browser-verified: earliest age 59→54, +$14k/mo).

**UI — Funding Order block in `AllocationCard.jsx`, below `MixMilestones`**
- **"The cascade" (signature):** priority-ordered account rows (order carries meaning), each with a
  horizontal **capacity bar** (routed vs. IRS cap → "filled, spills to next"), a prominent **% of
  annual savings** (JetBrains Mono), a one-word tax reason. Reuse `BracketBar`'s fill idiom + the
  card palette (a distinct account ramp, not the stock/bond/cash greens, to keep the two axes
  legible). Quiet everywhere except the cascade. Respect `prefers-reduced-motion`.
- Two reads: **"Where your savings goes now"** (current inputs, %) vs. **"Recommended order"** (%),
  + impact line + **Apply** button.
- **Mode-aware:** working = recommendation + Apply; **retired** = balances distribution only, no
  Apply (mirrors `earliestByRisk={null}` gating).
- **Parity:** shared card → Early / Maximize / Retired + onboarding `allocate` step; verify
  `MobileShell` (`feedback_early_maximize_parity`).

**RETI (required)** — `route_savings` write tool in `toolRegistry.js` (model `set_allocation`,
`writeKind:"inputs"` → inherits staging/undo/change-log/write-budget): computes/validates the split
(caps + budget conservation), writes the contribution fields. *Decision (build):* the
contribution fields stay writable by `update_inputs` too (NOT added to `UPDATE_EXCLUDED`) —
unlike allocation/scenario, there's no cross-field validation the generic path would violate,
and per-field edits ("set my 401k to $10k") stay useful; `route_savings` is the higher-level
convenience that computes the whole optimal split. Context line (current savings + route_savings
hint) in `context.js`; one `systemPrompt` line. Bump tool count in `CLAUDE.md` (15 → 16).

**Tests** — `src/__tests__/fundingOrder.test.js` (16) + `fundingOrderCard.render.test.jsx` (3):
tier order, cap enforcement + catch-ups, overflow, match/HSA first, aggressive→Roth tilt, budget
conservation, apply patch, render smoke. Invariants A–E unchanged; `toolDrift` auto-covers the
new tool. **475 tests green, build clean.**

## Phase 2 — Goal buckets

**Decisions (user, 2026-07-17):** A1 kids' education is **diverted from retirement** (honest cost);
B1 entered as a **$/yr amount**; C **kids' accounts first, annuity follow-up**; name it **530A Trump
Account**.

### Kids' education — BUILT ✅
- **Inputs:** `numDependents` + `educationAnnualContrib` (DEFAULTS; sidebar in `YouFields` /
  `MoneyFields`, gated on dependents; `fieldHelp` entries; auto agent-writable via `update_inputs`).
- **Constants:** `KIDS_LIMITS` in `brackets.js` — ESA $2,000/child, 530A Trump $5,000/child + $1,000
  seed (born 2025–2028) + $2,500 employer (§530A, ≥2026-07-04), 529 gift-exclusion $19k.
- **Model (diverted, off the retirement sim):** `kidsFundingSplit(plan)` splits the yearly education
  savings by fixed best-practice order **Coverdell ESA → 530A Trump → 529** (sized by dependents; the
  engine can't rank the child's own accounts). `recommendedFunding` attaches `rec.kids` with the
  **opportunity cost** = safe monthly spend forgone vs. keeping that money in the user's best account.
- **UI:** `KidsBlock` subsection in `FundingOrderCard` (split + %+caps + honest cost line). RETI:
  context line when set. **Docs:** `DocsPanel` "Account types compared" — two tables (retirement &
  savings; kids' & education) matching the user's spec columns, + a 530A Trump caveat callout.
- **Tests:** `fundingOrder.test.js` (kids split, conservation, cost≥0), render smokes for the card
  block + the docs tables. **483 green, build clean.**

### Deferred annuity — BUILT ✅ (a "should I?" comparison, not a baked-in sleeve)
- **Inputs:** `annuityContribAnnual` + `annuityStartAge` (+ expert `annuityRate`/`annuityPayoutRate`)
  in `StrategyFields`; `fieldHelp`; auto agent-writable.
- **Model (no `simulate` draw-order change):** `deferredAnnuityStream(plan)` grows the yearly
  contribution at the guaranteed rate to the start age, annuitizes at the payout rate → a fixed
  nominal, **ordinary-income** income stream (the honest least-favorable treatment). `recommendedFunding`
  attaches `rec.annuity` comparing **sustainable spend with the annuity stream vs. the same money in
  the user's best account** (reuses the tested `incomeStreams` override path). Verdict is honest —
  the portfolio usually wins; the annuity's edge is longevity (income you can't outlive).
- **UI:** `AnnuityBlock` in `FundingOrderCard` (guaranteed income + annuity-vs-invest verdict). Docs:
  annuity row in the retirement table. Tests: stream math, portfolio-usually-wins, render.

### Recommend-even-if-unchecked — BUILT ✅
Per the user's onboarding question: the funding order now ranks **every** account whether held or
not (HSA no longer gated on `hasHsa`); un-held accounts carry a `needsOpen` flag → the card shows
"· open one" and an HDHP-eligibility caveat for the HSA. Naming a better account the user hasn't
opened is the point.

### Onboarding — BUILT ✅
A "Saving for kids' education" card added to the optional depth step (sets `numDependents` +
`educationAnnualContrib`). Design decision (user): keep the calm core-accounts-+-expand money step;
**no per-instrument checkbox wall**; teach the full best-practice order and flag what to open.

### Remaining
- Custodial Roth IRA as a routing tier (documented in the table; needs a child-earned-income input).

## Consistency with the Maximize "next $1k/yr" card (marginalValue.js)

The Maximize card and Funding Order once ranked by different objectives (estate vs. spend), so
they could name different "best" accounts in the same panel. Reconciled: `marginalValues(plan,
{objective})` now takes a **lens** — `"spend"` (default; same sustainable-spend objective + account
set {401k, Roth, HSA, brokerage} as Funding Order → they agree) or `"estate"`. `MarginalValueCard`
gains a **"While alive" / "Leave behind"** toggle so both questions are answerable; the estate lens
is computed lazily only when selected. Munis dropped from the card (Funding Order doesn't route
them). RETI `run_analysis → marginal_value` returns `monthlySpendGain` (spend lens).

## Files
- New: `src/analysis/fundingOrder.js`, `src/__tests__/fundingOrder.test.js`.
- Edit (unification): `src/analysis/marginalValue.js` (objective lens), `ResultsExtras.jsx`
  (`MarginalValueCard` toggle), `agent/toolRegistry.js` (`marginal_value` = spend).
- Edit: `src/constants/brackets.js`, `src/components/panels/AllocationCard.jsx`, `src/App.jsx`
  (memoized recommendation + apply handler, like `earliestByRisk`/`pickRisk`),
  `src/agent/toolRegistry.js` + `context.js` + `systemPrompt.js`, `CLAUDE.md`.
- Phase 2: DEFAULTS + engine sleeves + drawdown exclusions.

## Verification
1. `npm test` — new suite green; **A–E unchanged**.
2. `npm run dev` + `.claude/skills/verify`: Funding Order renders below the risk bars; recommended
   cascade respects caps + overflows to brokerage; **Apply** writes the split and the earliest-age +
   portfolio chart visibly move; retired = balances-only; Aggressive→Roth tilt shifts the %. Repeat
   Maximize + Retired + `MobileShell` + onboarding `allocate` (parity).
3. RETI: "how should I split my savings?" → `route_savings` fires, writes, logs/undoes.
4. Sanity: recommended order lands an earlier safe age / higher estate than a brokerage-heavy split.
