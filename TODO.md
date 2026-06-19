# TODO: Retirement Planner

## Today / Next session
Max 3. Start here.

- [ ] Manual browser click-through: optimizer **Apply → Clear → re-Apply** (Maximize tab). Confirm the Strategy banner appears/clears and the chart + estate update. (Render tests cover both states, not the click transition.)
- [ ] Manual browser click-through of the **new MC interactions** (SSR can't cover): MC card *Show/Hide outcome distribution* toggle (both tabs); Maximize *Run Monte Carlo* button → card appears.
- [ ] Manual smoke of all new sidebar sections (Estate / Advanced / Scenario) and the red stress line in both tabs after a fresh `npm run dev` + hard refresh.

## This Week
Future work pulled from PRD §7 + advisor notes. Pick one.

- [x] **Deeper Monte Carlo visualization** — done: p5/p50/p95 final-estate range, insight callout, expandable histogram (`MonteCarloCard`/`McDistChart`); opt-in MC in Maximize. (Considered but deferred: fan chart of percentile bands *over time* — needs per-run trajectories.)
- [ ] **Optimizer: sustainable-spend objective** — add the secondary objective toggle (currently estate-max only).
- [ ] **Optimizer: explicit ACA/IRMAA-aware ceiling selection** — currently respected only implicitly via the estate objective (and only if an ACA premium is entered).
- [ ] **Legacy target → feed sustainable-spend** — currently display-only; could constrain the spend search to leave the bequest.

## Backlog / someday
- [ ] Per-year dynamic withdrawal-order optimization (optimizer v2).
- [ ] Post-65 healthcare cost modeling (Medicare + Medigap).
- [ ] Per-state income-type exclusion tables (state tax currently a flat rate on all income types).
- [ ] UX polish: hold last-valid result while typing an invalid retire age (avoid the placeholder flicker) — or make `NumInput` not emit 0 on empty.
- [ ] Consider deleting dead code: `InputsPanel.jsx`, `MaximizePanel.jsx` (not imported anywhere).
- [ ] 2027 tax-year update when final IRS figures are out (single-file edit in `constants/brackets.js`).

## Blocked
- (none)

## Done This Week
- [x] Medium Roadmap PRD: Estate/Advanced/Scenario sidebar sections; one-time expenses, phase spending, birth year, legacy target, stress test; tax/SS transparency strip.
- [x] Priority 3: bisection marginal-rate solver; explicit RMD tax cash-flow; new regression tests.
- [x] Verified stress test accuracy + added red stress-projection line on the chart.
- [x] Fixed white-screen crash when retire age < current age (null-result guard).
- [x] Dynamic multi-year Roth conversion optimizer (bracket-fill engine mode, `dynamicOptimizer.js`, Maximize UI, Apply/Clear, artifact-guard + render tests).
- [x] Docs updated: in-app DocsPanel + PRD.md §4.7/§4.8 + dynamic-optimizer PRD marked shipped.
