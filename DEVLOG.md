# DEVLOG: Retirement Planner

A tax-aware, month-by-month retirement drawdown simulator (React + Vite, pure-JS engine).

---

## Quick reference (read this first on a fresh start)

**Run it**
- `npm run dev` → dev server (WSL2: case-insensitive FS, HMR needs polling — already set in `vite.config.js`; after edits, **restart server + hard-refresh** Ctrl+Shift+R or you'll see stale UI).
- `npm test` → vitest (CI gate). `npm run build` → prod build.

**Architecture (3 layers, never import upward)**
```
constants/brackets.js   TAX_YEAR=2026, brackets, limits, FPL/ACA, RMD table — single source of truth
engine/                 pure, no React: simulate.js (crown jewel), tax.js, accounts.js, rmd.js,
                        socialSecurity.js, monteCarlo.js
analysis/               plan.js (hub) + earliestRetireAge, sensitivity, marginalValue,
                        optimalConversion, sustainableSpend, stressTest, dynamicOptimizer
components/ + App.jsx    React UI
```

**Key facts that save time**
- **Live sidebar is `InputsSidebar.jsx`** (accordion). `InputsPanel.jsx` and `MaximizePanel.jsx` are **DEAD CODE** — not imported by App. Don't edit them.
- `App.jsx` holds all state via `useState(DEFAULTS)`, derives `plan = makePlan(inputs)`, passes results down. **Four tabs:** Retire Early (`EarlyPanel`+`RightRail`), Maximize (`MaximizeCenter`+`MaximizeRail`), **Get advice** (`AdvicePanel`), How it works (`DocsPanel`).
- **"Retire at" is a full-width command band** (`RetireAtControl.jsx`) at the top of the center results column, not a sidebar field. **No-lag scrubbing:** a slider drag updates `dragAge` ONLY (never `setInputs`), so `inputs`/`plan` stay referentially stable and every expensive memo is frozen for free; a cheap `livePlan`/`liveResult` (1 sim) tracks the drag; commit on release/discrete action triggers the full recompute. Don't "fix" this with `useTransition`.
- **Per-field help is single-sourced** in `constants/fieldHelp.js` (`FIELD_HELP` + `FIELD_HELP_GROUPS`) — feeds both the sidebar `InfoDot` tooltips and the DocsPanel inputs reference. Add a field's help once, there.
- **`survivesAt` (plan.js) is bridge-aware**: `depleted === null && bridgeShortfall === 0`. So `earliestRetireAge`/`sensitivity`/`retireByAge` all refuse ages where money is stranded in a locked 401k. Invariant D holds by construction (the verdict *is* `survivesAt`).
- **`simulate()` contract:** pure month-by-month drawdown. Returns `{ snaps, depleted, bridgeShortfall, estateGainTax, taxSummary, conversions }`. Draw order is a tested invariant.
- **`simParamsAt()` in plan.js is THE chokepoint** — every new sim field must route through it so all 5 analysis routines (which call `runAt → simParamsAt`) inherit it. Bypassing it makes analyses diverge from the verdict.
- **Tests are the gate.** Invariants A–E in `simulate.test.js` + others. When adding engine params, use **identity defaults** (off = byte-identical output) and re-run the full suite after every engine edit.
- Tax year is 2026, MFJ default. Annual update = single-file edit in `constants/brackets.js`.

**Test suite: 185 passing, 14 files** (was 94 at start of 2026-06-17, 156 at end of that day).

---

## Session: 2026-06-18 — UX overhaul, goal-seek, contributions, MC chart, the "Retire at" lever

Long session driven by live user feedback. Test count 156 → 185. Green, build clean throughout.
**No engine math changes** except additive `projectTo` contribution levers + a deliberate
`survivesAt` semantics change (below). Each item was planned (EnterPlanMode) and advisor-reviewed.

### 1. UX simplification + "$7M retiree" CFP workflow
- **Two-tier sidebar** (`InputsSidebar.jsx`): **Essentials** (You · Money · Spending · Assumptions) always shown; **Fine-tuning (optional)** group (Taxes · Strategy · Healthcare · Estate · Advanced · Scenario) collapsed. Merged old Accounts+Savings into one **Money** section.
- **Quick-start onboarding** (`QuickStart.jsx`, new) — first-run mini-form (age · retired/working · total saved · monthly spend) pre-fills the sidebar; dismissal persisted in `localStorage`.
- **Hover tooltips** — new `InfoDot` primitive in `ui.jsx`; content single-sourced from new `constants/fieldHelp.js`, which `DocsPanel` now also renders from.
- **Progressive-disclosure output** — plain-language verdict line in the hero; secondary cards tucked behind a "Show details" `Collapsible` (Early + Maximize).
- **"Get advice" tab** (`AdvicePanel.jsx`, new) — advice-only/flat-fee fiduciary explainer, static AUM-fee illustration, links to NAPFA/XYPN/Garrett/Wealthramp, and an **export** of the plan summary (`analysis/planSummary.js`, new, pure). Disclaimers throughout (educational, not advice).

### 2. "Retire by a target age" goal-seek (`analysis/retireByAge.js`, new)
- Binary-searches the **extra monthly brokerage savings** needed to retire at a target age, plus the **trim-spend trade-off**. Oracle requires **`depleted === null` AND `bridgeShortfall === 0`** (a survival-only oracle understates savings for a young all-401k plan — verified: it'd say "$0" while `bridgeShortfall:234`).
- New `projectTo` override `brokerageAnnual` (additive, defaults 0): contributed principal adds to **both value and cost basis** (after-tax dollars → no phantom LTCG). Goal-seek override stacks on top of the user's input.
- Card displays `Math.ceil(extraMonthly)` so **following the recommendation always clears the bar** (round-down would leave a $1 residual). Integration test proves the loop closes.

### 3. Per-account contributions + one-click Max (`InputsSidebar.jsx`, `plan.js`)
- New **monthly** contribution inputs for **brokerage / CD / munis** (`×12 → fvAnnuity` at each account's rate; brokerage adds to basis). 401k/Roth/HSA keep annual inputs and gain a **Max** chip (fills the 2026 IRS limit). Single **"You save $X/mo ($Y/yr · N% of salary)"** readout at the top of Money.
- `retireByAge` `currentMonthlySavings` updated to include the new contributions (excl. employer match).

### 4. Monte Carlo chart restructure (both panels — parity)
- New shared **`PortfolioChartCard.jsx`**: a toggle between **Projection** (stacked composition) and **Outcome range** (a clean MC fan — `StackedChart view="fan"`: band + median + faint deterministic line, no bars). Fan view shows a Monte Carlo explanation card.
- **MC stats card moved into "Show details"; histogram removed** from the UI (`McDistChart` + `buildHistogram` retained, still unit-tested, just unused in-app). Maximize's on-demand MC folds into the toggle (Run button when not yet run).

### 5. Unify the target age
- Removed the separate "target age" textbox; the goal-seek card now keys to `plan.retireAge` (single source of truth) per user ("two age inputs is confusing").

### 6. The "Retire at" lever — elevated, no-lag, then made beautiful
- `RetireAtControl.jsx` (new): big slider + −/+ steppers + quick-target chips. **No-lag architecture** added in `App.jsx`: `dragAge` state + `livePlan`/`liveResult`; heavy memos stay on the committed `plan` and freeze during a drag via referential stability (see Quick reference). Confirmed ~1 sim/tick vs ~800.
- Iterated on placement per feedback: pinned-in-sidebar → full-width band → **center-column command band** (between sidebar and right rail, via grid restructure). Removed the duplicate sidebar "Retire at" field and the redundant header strip.
- **"Playful" treatment** (chosen over Horizon/Ticket/Glow options): the age **pops** on commit (keyed so it's smooth mid-drag), gradient text, a warm **"≈ N years away · free in YYYY"** sub-line, and a **"✨ your earliest"** sparkle when you land on the earliest feasible age. Milestone-age ticks (55 / 59½ / 62 / 65 / 67) on the track that teach + click-to-jump. Keyframes in App's global `<style>`; `prefers-reduced-motion` respected.

### 7. "Show details" → below the chart + auto-open
- `Collapsible` (`ui.jsx`) made optionally **controlled** (`open`/`onToggle`). Each panel auto-opens details when content appears there: a **stress test**, a **legacy-target change**, or switching the chart to **Outcome range** (`PortfolioChartCard` gained `onViewChange`). Still hand-collapsible; retire-age drags don't trigger it.

### 8. Chart phase labels (`StackedChart.jsx`)
- Fixed Bridge/Early/SS+ **overlap** (existence checks + left-to-right collision skip) and **over-bars** readability — labels now sit in a reserved **top strip** (bars scale into `plotH = H − 18`, so they can't reach the labels). No pill.

### Bugs fixed (advisor catches)
- **`earliestRetireAge` floored at `currentAge + 1`** → returned 63 for an already-retired 62-yo ($7M persona). Floored at `currentAge`. Regression test added (the suite never exercised `retireAge == currentAge`).
- **`survivesAt` was bridge-blind** → `earliest = 30` for an all-401k 30-yo (money stranded in a locked account). Made bridge-aware (semantics change; invariant D holds by construction since its verdict *is* `survivesAt`; full suite stayed green).
- **`InfoDot` popover clipped** by the sidebar's `overflow:auto` → rewritten to viewport-fixed + edge-clamped.
- **Fan view dupes**: duplicate "MC 10–90%" label and doubled MC explanation paragraph → deduped (inline legend suppressed in fan; clip note moved to a compact top-right tag; `MonteCarloCard` paragraph dropped).
- **Fan legend overlap** ("90th ↑ off-chart" ran into "Median") → short labels + clip note relocated top-right.
- **SSR comment-split** in adjacent static+dynamic text (`Earliest {age}`, `Retire by age {age}`) broke substring tests → template literals.

### Decisions
- **Early/Maximize parity**: output/UX changes go to *both* result panels (user corrected an Early-only scoping). Shared components where possible (`PortfolioChartCard`). Saved to memory.
- Goal-seek savings bucket is **taxable brokerage** (uncapped, reachable pre-59½ — what an early target needs). Brokerage/CD/muni contributions are **monthly** (paycheck-style, matches the goal-seek's "$/mo" answer); 401k/Roth/HSA stay **annual** (IRS framing). "Max" uses base limits (no 50+/55+ catch-up beyond HSA's) — noted, not a regression.
- CFP feature is **informational CTA + client-side export**, no backend; networks verified via web search.
- No-lag lever: **don't** reach for `useTransition` — the freeze is structural (don't mutate `inputs` during a scrub).

### Tomorrow's Starting Point
- **Manual browser pass** of everything SSR/tests can't see (this is the standing gap each round): the slider **drag feel** + the **playful animations** (pop/gradient/sparkle, reduced-motion), the command-band **fit** in the center column + milestone-tick alignment, the **auto-open** triggers (stress / legacy / Outcome range), the phase-label **top-strip** positioning across a near-60 retire age and tall-bars scenarios, and the **Quick-start → export** flows.
- New files this session: `constants/fieldHelp.js`, `analysis/planSummary.js`, `analysis/retireByAge.js`, `components/panels/{QuickStart,AdvicePanel,PortfolioChartCard,RetireAtControl}.jsx`.

---

## Session: 2026-06-17 (cont.) — Enhanced Stress Test & Monte Carlo

Implemented `PRD_Enhanced_Stress_Test_MonteCarlo_June2026`. Test count 136 → 156. Green, build clean.

### Completed
- **Engine (`monteCarlo.js`)** — enriched the return shape *additively* (backward-compat preserved, RNG draw order untouched): `p5/p50/p95EndTotal`, `depletionRate`, 12-bin `histogram`, plus exported pure helpers `percentile`, `buildHistogram`, `pctDepletedBefore`. Outcome range is ranked by **final estate**, not depletion age (every run has a final balance; depletion age is undefined for survivors).
- **`MonteCarloCard.jsx`** (new) — success rate + Worst/Median/Best (5th/median/95th) estate + one-sentence insight + expandable distribution. Returns `null` on missing result so callers pass through safely (no NaN).
- **`McDistChart.jsx`** (new) — final-estate histogram; depleted runs in the red leftmost bin; 5th/median/95th markers.
- **Retire Early**: replaced the inline MC block with `<MonteCarloCard>` (live). **Maximize**: MC is **opt-in** behind a *Run Monte Carlo* button (`maxMcOn` state in App; memo re-caches on input change) so optimizing stays fast — honors PRD's "optional secondary view" + performance asks.
- **Tests**: +12 in `monteCarlo.test.js` (percentile/histogram/pctDepletedBefore helpers + enriched-output ordering/sum/back-compat), +4 render guards (Maximize MC card + Run button, `McDistChart` normal + all-depleted). **Docs**: DocsPanel MC section (percentiles, distribution, on-demand-in-Maximize) + PRD marked Implemented.

### Follow-up: percentile fan on the portfolio chart (user request)
- `monteCarlo()` now also returns `bands: [{ age, p5, p50, p95 }]` — per-year percentiles of total portfolio value across all runs (exported helper `percentileBands`). All runs share the horizon and the engine pushes a yearly snapshot ($0 after depletion), so trajectories align by index; ~zero extra compute beyond the runs already executing.
- `StackedChart` gained an `mcBands` prop: a shaded 5–95% area + blue median line over the existing deterministic bars (kept). Wired in both panels via `mcResult?.bands`. Histogram retained per user ("keep the histogram for now").
- Tests: `percentileBands` unit tests + bands-shape/ordering assertions + a `StackedChart` fan render guard. **156 passing.**
- Note: snapshots are end-of-year, so bands run `retireAge+1 … lifeExpect` (aligns index-for-index with the deterministic snaps).
- **Scale fix (user feedback):** the raw upper band (a few lucky sequences → tens of $M) was driving the y-axis up and crushing the bars to an unreadable sliver. `StackedChart` now anchors `maxVal` to the central outcome (deterministic + stress + p50) and caps it at **2.5× baseMax**; when the upper band exceeds that it clips and the legend appends "90th ↑ off-chart". Full upper tail still visible in the histogram. Well-funded plans show the band uncapped.
- **10th/90th instead of 5th/95th (user feedback):** the whole MC surface (fan band, card stats, histogram markers) now uses a **10–90 cone** — tighter and more representative on the right-skewed distribution. Engine end-totals renamed `p5/p95EndTotal` → `p10/p90EndTotal`. Card labels: Downside (10th) / **Median estate (50th)** / Upside (90th). Clarified for the user: the median estate **is** p50 — `p50EndTotal === medianEndTotal` (added a test asserting it).

### Post-review fixes (advisor)
- **Maximize gate was one-shot**: `maxMcOn` never reset, so after the first *Run* every keystroke recomputed 500 runs live. Added `useEffect(reset, [mainSimParams])` → genuinely on-demand; button reappears after each edit.
- **Histogram "red = depleted" was a lie**: equal-width bin 0 swept low-but-surviving outcomes in with the $0 runs. `buildHistogram` now reserves bin 0 for *exactly* depleted runs (`depleted:true`) and spreads survivors over the rest. Chart colors by the flag.
- **`McDistChart` had no render coverage** (the one SVG outside the NaN net, since the card defaults to collapsed): added direct render tests.

### Decisions
- Initially shipped histogram-only (cheap; reuses sorted `endTotals`). **User then asked for a percentile fan on the portfolio chart** → added `bands` + `StackedChart` overlay, kept the histogram. Trajectory retention is cheap in practice (the 500 runs already execute live; we just keep each run's yearly totals), so the earlier perf worry didn't bite.
- Kept `engine/monteCarlo` and `analysis/stressTest` separate (layer rule) despite PRD Task 1's "enhance or replace" wording — enriched in place.

### Tomorrow's Starting Point
- **Manual browser click-through** of the two new stateful interactions SSR can't cover: the MC card's *Show/Hide outcome distribution* toggle, and Maximize's *Run Monte Carlo* button → card appears.

---

## Session: 2026-06-17

Big day — implemented three PRDs end-to-end. Test count 94 → 136. All green, build clean.

### Completed

**1. Medium Roadmap PRD** (`docs/PRD_Next_Medium_Roadmap_June2026.md`)
- New sidebar sections in `InputsSidebar.jsx`: **Estate**, **Advanced**, **Scenario** (accordion, collapsed by default, at the bottom after Healthcare; each has a `summary` chip + `CAPTIONS` entry).
- **Moved** the step-up-in-basis toggle out of the Tax section → **Estate** section (single source; this is why it "disappeared" from Tax).
- New inputs wired: `legacyTarget`, `birthYear` (override), `oneTimeExpenses` (add/remove repeater), phase spending (`goGoMult`/`slowGoMult`/`noGoMult` + `slowGoAge`/`noGoAge`), `scenarioMode` (deterministic/stress) + `stressDropPct`/`stressYears`.
- Engine (`simulate.js`): added one-time expenses, phase-spending multipliers, and a `taxSummary` output (`ssTaxableFrac`, `k401EffRate`). All identity-defaulted.
- `plan.js`: `birthYear` (when set) is authoritative for RMD start age; FRA stays manual with an SSA-derived hint (`fraForBirthYear` added to `socialSecurity.js`). All new fields routed through `simParamsAt`.
- `analysis/stressTest.js`: deterministic early-crash bad-sequence run (reuses `returnSeries`).
- Results: new `components/panels/ResultsExtras.jsx` — `TaxTransparency` (SS taxable %, 401k eff rate, step-up note), `LegacyGap` (estate vs inflated target), `StressCard` — shown in both `EarlyPanel` and `MaximizeCenter`.
- Tests: `roadmap.test.js`. Docs: `DocsPanel.jsx` + `PRD.md §4.7`.

**2. Priority 3 robustness** (PRD §3.5)
- **Marginal-rate solver → bisection** (`grossUpMonthly`, exported from `simulate.js`). Converges even across a bracket boundary; identical to old fixed-point except on straddling draws (where bisection is more accurate).
- **RMD tax cash-flow**: a forced RMD now reinvests the **full gross** into brokerage and pays the tax explicitly from cash (`cd`) then brokerage (`bk`). Degenerates to old behavior when `cd=0`.
- Tests: `priority3.test.js` (solver convergence, RMD with `cd>0`, step-up on/off, low-income SS). Docs disclaimers added.

**3. Stress test: verified + red chart overlay**
- Confirmed numerically the stress test is accurate: crash applied to early years then reverts to mean; "-30%" is a nominal annual rate compounded monthly (≈ -26% realized) — same convention as every other return in the engine. It's a deterministic worst-case, not a forecast.
- Added a **red stress-projection line** to `StackedChart.jsx` (only when Stress mode active), wired via `stressSnaps` in both panels.

**4. Dynamic Roth conversion optimizer** (`docs/PRD_Dynamic_Optimizer_June2026.md` — now marked Implemented)
- Engine: conversion ladder gained **bracket-fill mode** (`conversionCeiling` = taxable-income top to fill to) + configurable `conversionEndAge` (default 59.5; optimizer raises to ~72 for RMD-prep years) + `conversions[]` output.
- **Critical correctness fix:** conversion tax is funded from `cd`→`bk` AND the conversion is **capped at what that liquid can pay tax on**. Closes an artifact where a big bracket-fill with little cash was silently tax-free (which would have made the optimizer recommend a fictitious strategy).
- `analysis/dynamicOptimizer.js`: runs baseline + 10/12/22/24% bracket ceilings (~5 sims), picks max net estate, returns recommended bracket, per-year schedule, total converted, RMD reduction.
- UI: `MaximizeCenter.jsx` optimizer card with **Apply these conversions** button; `InputsSidebar.jsx` Strategy section shows active strategy + **Clear** (visible/reversible).
- Tests: `dynamicOptimizer.test.js` (incl. artifact guard) + new `render.test.jsx` (SSR render smoke tests via `react-dom/server` — no new deps; catches render crashes/NaN).
- `optimalConversion.js` kept (still unit-tested) but no longer used in the live UI.

### Bugs / Issues Discovered (fixed)
- **White-screen crash** typing in the retire-age field: `runMain` returns `null` when `retireAge < currentAge` (transient while typing), panels did `const { snaps } = result` → crash. Fixed with a null-result guard in `App.jsx` (renders a "Check the retirement age" card instead). Pre-existing latent bug.
- **Conversion under-taxing artifact**: conversion tax was capped at `cd`, so an unbounded bracket-fill could be tax-free → fixed with the affordability cap (see optimizer note above).

### Decisions Made
- `birthYear` drives **RMD age only**; FRA stays manual (avoid two controls writing the same value).
- `legacyTarget` is **display-only** (gap vs estate); does not constrain sustainable-spend. (MVP choice.)
- Phase multipliers default **1.0** (identity); stress test is a **separate illustrative card**, never the headline verdict.
- Optimizer objective is **estate-max only**. ACA/IRMAA respected **implicitly** via the objective (conversions feed MAGI → premium cost → lower estate), not as hard constraints — documented in `PRD.md §4.8`.
- Kept `optimalConversion.js` for its test; not used in UI.
- Engine changes always identity-defaulted; full suite re-run after each.

### Tomorrow's Starting Point
- **Manual browser click-through** of the optimizer Apply → Clear → re-Apply cycle. Render tests cover both *states* but not the click *transition* (SSR can't fire events). This is the one thing not yet visually verified.
- Then pick from TODO.md — strongest next candidate is deeper Monte Carlo visualization (percentile bands) or the sustainable-spend objective for the optimizer.
