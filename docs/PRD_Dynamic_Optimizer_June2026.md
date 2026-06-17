# PRD: Dynamic Multi-Year Roth Conversion & Withdrawal Optimizer
**Version:** v1.0  
**Date:** 2026-06-17  
**Status:** ✅ Implemented (2026-06-17) — bracket-fill engine mode, `dynamicOptimizer.js`, Maximize-panel UI, and tests shipped. See PRD.md §4.8.  
**Owner:** Ali Tarraf

---

## 1. Executive Summary & Scope

Now that the tax engine has accurate provisional-income SS taxation, marginal-rate traditional withdrawals, RMD forcing, ACA MAGI handling, and step-up basis, we can build a significantly more powerful optimizer.

**Goal:** Replace the current single-year grid-search `optimalConversion.js` with a **dynamic multi-year optimizer** that recommends the best Roth conversion strategy (and potentially withdrawal sequencing) across the retirement timeline — especially during the bridge period and into RMD years.

**In Scope (this phase):**
- Multi-year Roth conversion optimization (primarily ages 55–72, covering bridge + early RMD years).
- Optimization objective: Maximize terminal estate value (or sustainable spending) while respecting ACA cliffs, IRMAA lookbacks, future RMDs, and bracket management.
- Integration into the existing **Maximize Portfolio** mode.
- Clear output: Recommended annual conversion amounts (or a simple “convert to top of X% bracket” strategy) + projected impact vs. doing nothing.
- Reuse the now-accurate `simulate()` engine.

**Out of Scope (this phase):**
- Fully dynamic withdrawal order optimization every year (keep current draw order as baseline).
- Detailed post-65 Medicare + Medigap cost modeling.
- Per-state tax nuance beyond current `stateSsExemptRate`.
- Monte Carlo inside the optimizer (keep deterministic for speed; we can layer stochastic later).

---

## 2. Why This Now (High Leverage)

- The current single-year grid search is too simplistic given the quality of the tax engine.
- Roth conversions interact powerfully with:
  - Future RMDs (reduce them)
  - ACA MAGI cliffs (pre-65)
  - IRMAA 2-year lookback (affects Medicare premiums at 65+)
  - Bracket management over multiple years
- Users in “Maximize Portfolio” mode repeatedly ask: “How much should I convert and when?”
- This feature turns the tool from “good simulator” into a **true decision-support optimizer**.

---

## 3. Proposed Approach

**Core Idea:**
Run many simulations with different conversion strategies and pick the one that maximizes the chosen objective (estate at death or sustainable spend).

**Practical Scope for v1:**
- Optimize over a user-defined window (default: retire age → age 72).
- Strategies to consider:
  - “Fill to top of X% bracket” each year (recommended default strategy).
  - Fixed annual amount.
  - “Convert aggressively early then taper” patterns.
- Use the existing accurate tax + MAGI + RMD logic inside `simulate()`.
- Objective function: Final estate value at life expectancy (with step-up basis applied).
- Output: Recommended annual conversion schedule + delta vs. $0 conversions.

**Performance Note:**
We can keep it reasonably fast by:
- Using a smarter search (not pure brute force) — e.g., dynamic programming or iterative “fill bracket” approach per year.
- Or a modest grid + local search.
- Caching / memoization where possible.

---

## 4. Key Tasks & Files

| Task | Description | Primary Files |
|------|-------------|---------------|
| 1 | Create new analysis module `dynamicOptimizer.js` | `src/analysis/dynamicOptimizer.js` (new) |
| 2 | Implement multi-year optimization logic (bracket-filling or search) | `src/analysis/dynamicOptimizer.js` |
| 3 | Expose new inputs: optimization window (start/end age), objective (estate vs spend), strategy preference | `InputsPanel.jsx`, `App.jsx`, `plan.js` |
| 4 | Integrate into **Maximize Portfolio** panel (show recommended schedule + impact) | `MaximizePanel.jsx` |
| 5 | Add clear “Optimize Conversions” button or auto-run toggle | `MaximizePanel.jsx` |
| 6 | Update `optimalConversion.js` (or deprecate in favor of new module) | `src/analysis/optimalConversion.js` |
| 7 | Add regression / acceptance tests for the optimizer | `src/__tests__/` |
| 8 | Update PRD.md and add user-facing explanation | `PRD.md`, results UI |

---

## 5. UI & User Experience

**Inputs (in Maximize mode or new collapsible):**
- Optimization window: “From age X to age Y” (defaults: retire age → 72)
- Primary goal: Maximize estate at death (default) / Maximize sustainable spending
- Strategy style: “Fill to top of bracket each year” (recommended) / Custom annual amounts / Aggressive early

**Outputs (in MaximizePanel):**
- Recommended annual conversion amounts (table or chart)
- Projected estate value with vs. without the plan
- Key insights: “This strategy reduces future RMDs by ~$X and avoids ACA cliff in years A–B”
- Simple “Apply these conversions” button that sets the annual conversion input

**Design principles:**
- Keep it optional and clearly labeled as “advanced optimization”.
- Default behavior should still work without using the new optimizer.
- Show confidence/impact clearly (with vs. without).

---

## 6. Acceptance Criteria

- Optimizer produces a conversion schedule that improves estate value vs. $0 conversions in realistic scenarios.
- It respects ACA MAGI cliffs and IRMAA lookback where relevant.
- It accounts for future RMD reduction benefit.
- UI shows clear before/after impact.
- Performance remains acceptable (optimizer should complete in < 2–3 seconds on typical inputs).
- New tests pass and do not break existing invariants A–E.
- Documentation explains what the optimizer does and its limitations.

---

## 7. Implementation Notes for Claude Code

**Start with the engine/algorithm side** (`dynamicOptimizer.js`) before heavy UI work.

**Leverage existing strengths:**
- Use `simulate()` as the evaluation function (it’s pure and accurate now).
- Reuse `marginalFedRate`, MAGI accumulation, RMD logic, etc.

**Suggested algorithm direction (choose one or hybrid):**
- Year-by-year “fill to top of target bracket” greedy approach (fast and explainable).
- Or a modest search (e.g., dynamic programming across years with state = current conversion room + projected RMD trajectory).

**Objective function:**
Primary: Final estate value at `lifeExpect` (with step-up basis).
Secondary (optional toggle): Sustainable monthly spend.

**Keep it pragmatic:**
This v1 does **not** need to be perfect. A good bracket-filling strategy over multiple years that respects the main constraints (ACA, RMDs, IRMAA) will already be a big upgrade over the current single-year grid search.

---

## 8. Risks & Open Questions

- Performance: How many simulations can we afford per optimization run?
- Explainability: Should we show *why* certain years have higher/lower recommended conversions?
- Future extensibility: Design so we can later add withdrawal optimization or Monte Carlo evaluation inside the optimizer.

---

**This is the highest-leverage next feature** given the current state of the tax engine. It turns accurate simulation into actionable, multi-year planning intelligence.

Ready to hand off to Claude Code. Let me know if you want any section adjusted (scope, algorithm preference, UI details, etc.) before we proceed.