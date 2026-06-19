# PRD: Enhanced Stress Test & Monte Carlo Visualization
**Version:** v1.0  
**Date:** 2026-06-17  
**Status:** ✅ Implemented 2026-06-17

> **Implementation notes:** `monteCarlo()` enriched additively with final-wealth
> percentiles (`p5/p50/p95EndTotal`), `depletionRate`, and a 12-bin `histogram`
> (plus exported pure helpers `percentile`, `buildHistogram`, `pctDepletedBefore`).
> New `MonteCarloCard` (success rate + best/median/worst cards + insight sentence +
> expandable `McDistChart` histogram) is **live in Retire Early** and **opt-in in
> Maximize** (a *Run Monte Carlo* button; the result memo-caches on input change).
> Outcome range is ranked by **final estate** rather than depletion age (every run
> has a final balance; depletion age is undefined for survivors). The deterministic
> early-crash `stressTest.js` was kept as the "quick stress" tier (layer boundary:
> `monteCarlo` is `engine/`, `stressTest` is `analysis/` — enriched in place, not
> merged). Tests: +12 in `monteCarlo.test.js`, +2 render guards. 150 passing.

---

## 1. Executive Summary & Scope

The engine already supports variable returns via `returnSeries` and has a basic `stressTest.js`. However, stress testing / Monte Carlo is not yet prominently surfaced to users.

**Goal:** Make sequence-of-returns risk visible and actionable, especially in the **Retire Early** mode, while keeping performance good.

**In Scope:**
- Prominent, optional **Stress Test** view or toggle in both modes (focus on Retire Early).
- Lightweight Monte Carlo (200–500 runs) or deterministic stress scenarios (e.g., bad early returns).
- Clear outputs: Success probability, range of outcomes (depletion year percentiles), and key insights.
- Reuse existing `returnSeries` support in `simulate()`.
- Simple visualization (success rate + depletion distribution or summary stats).

**Out of Scope (this phase):**
- Full high-fidelity Monte Carlo with thousands of runs on every keystroke.
- Correlated asset classes or complex return modeling.
- Integration inside the Dynamic Optimizer.

---

## 2. Why This Now

- Sequence-of-returns risk is one of the biggest threats in early retirement.
- Users now have a strong Dynamic Optimizer — they also need to understand **how fragile** the plan is under bad markets.
- The engine is already capable; we just need better visibility and UX.
- Complements the optimizer nicely (optimize for base case, then stress test it).

---

## 3. Proposed Approach

**Two-tier experience (keep it simple):**
1. **Quick Stress Test** (default / fast): Deterministic bad scenarios (e.g., -30% crash in first 3 years, or historically bad sequences).
2. **Monte Carlo Mode** (opt-in): Run 200–500 simulations with random returns drawn from mean + volatility. Show success rate + outcome distribution.

**Key outputs:**
- Probability of success (money lasts to life expectancy).
- 5th / 50th / 95th percentile depletion year (or final wealth).
- Simple visual: success gauge + distribution chart or summary cards.
- Insight callouts: “In 12% of simulations you run out before 85” or “Median outcome leaves $X at death”.

**Performance:**
- Make Monte Carlo opt-in or run on button click (not live on every input change).
- Reuse `simulate()` with different `returnSeries`.

---

## 4. Key Tasks & Files

| Task | Description | Primary Files |
|------|-------------|---------------|
| 1 | Enhance or replace `stressTest.js` with proper MC + stress scenarios | `src/analysis/stressTest.js` |
| 2 | Add UI controls: Toggle or tab for “Stress Test” / “Monte Carlo” | `InputsPanel.jsx` or new section in results panels |
| 3 | Display results in **Retire Early** and **Maximize** panels | `EarlyPanel.jsx`, `MaximizePanel.jsx` |
| 4 | Simple visualization component (success rate + distribution) | New or existing chart component |
| 5 | Add tests for stress/MC logic | `src/__tests__/` |
| 6 | Update PRD.md and add user guidance | `PRD.md` |

---

## 5. UI & User Experience

**Placement:**
- In **Retire Early** mode: Prominent “Run Stress Test” section or tab (high priority).
- In **Maximize Portfolio** mode: Optional secondary view.

**Controls (simple):**
- Toggle: “Quick Stress Scenarios” vs “Monte Carlo (200 runs)”
- Optional inputs: Market volatility assumption, crash severity (advanced).

**Results display (keep clean):**
- Big success probability number + color indicator.
- Summary cards: Best / Median / Worst case outcomes.
- Optional expandable chart showing distribution of outcomes.
- One-sentence insight generated from results.

**Design notes:**
- Clearly label as “illustrative / not a guarantee”.
- Make it easy to compare base case vs stressed case.

---

## 6. Acceptance Criteria

- Stress Test / Monte Carlo runs without crashing and produces plausible results.
- Success probability and outcome ranges are clearly displayed.
- UI is optional and does not slow down normal use.
- Tests cover key scenarios (good market, bad early returns, MC distribution).
- Documentation explains what the numbers mean and their limitations.

---

## 7. Implementation Notes for Claude Code

**Leverage existing infrastructure:**
- `simulate()` already accepts `returnSeries`.
- Build a helper that generates return series (deterministic bad paths or random draws).

**Suggested implementation order:**
1. Backend logic in `stressTest.js` (generate scenarios + run simulations).
2. Basic UI display in Retire Early panel.
3. Add Monte Carlo option with reasonable run count.
4. Polish visualization and insights.

**Performance tip:** Run Monte Carlo only when user explicitly requests it. Cache results if inputs haven’t changed.

---

## 8. Risks & Open Questions

- How many runs feel “good enough” for users without being too slow?
- Should we show full distribution charts or keep it high-level summary cards?
- Future: Allow stress testing the Dynamic Optimizer’s recommended strategy directly.

---

This is a high-value, medium-effort feature that gives users critical insight into plan robustness after they’ve optimized it.

Ready to hand off. Let me know if you want any adjustments to scope or focus.