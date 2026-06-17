# PRD: UI Wiring, Transparency & Medium Roadmap Items
**Version:** v1.2 (Post Tax Accuracy)  
**Date:** 2026-06-17  
**Status:** Ready for Claude Code  
**Focus:** Medium-priority items — UI completeness, user transparency, and next practical features

---

## 1. Executive Summary

The core tax accuracy improvements (SS provisional income, marginal-rate traditional withdrawals, RMD cash flow, step-up in basis) are now in the engine. 

**This PRD scopes the next logical medium-effort work:**
- Wire the new `assumeStepUpBasis` flag into the UI.
- Add transparency/education for the improved tax modeling (SS % taxable, effective rates, etc.).
- Wire additional high-value inputs from the original catalog.
- Introduce a lightweight Monte Carlo or stress-test preview (big credibility win).
- Expand tests and polish results panels.

These items improve usability, trust, and actionability without requiring heavy new engine logic.

---

## 2. Scope & Priority Order

**Priority 1 (Quick wins, high visibility)**
- Wire `assumeStepUpBasis` toggle + surface estate impact.
- Add tax/SS transparency in results panels (e.g., “SS taxable this year: X%”, current marginal rates used).
- Update PRD.md to document the completed tax accuracy work.

**Priority 2 (Medium effort, high user value)**
- Wire more input catalog items: one-time/lump expenses, legacy/estate target amount, birth year (for precise RMD age & FRA), phase-based spending (go-go/slow-go).
- Add a simple “Stress Test” or lightweight Monte Carlo toggle/preview in Maximize / Early modes (use existing `returnSeries` hook + bad-sequence generator).

**Priority 3 (Polish & robustness)**
- Improve marginal-rate solver robustness (better convergence or fallback).
- Tighten RMD tax cash-flow modeling (explicit tax deduction from cash when forcing shortfall).
- Expand regression tests for new tax logic + edge cases (low-income SS, RMD-heavy years, step-up on/off).
- Minor results panel polish and stronger disclaimers/education.

**Out of scope for this pass:** Full multi-year dynamic optimizer, detailed post-65 healthcare modeling, per-state exclusion tables.

---

## 3. Specific Tasks & Files

### 3.1 UI Wiring — Step-up in Basis (Priority 1)
- Add toggle in `InputsPanel.jsx` under a new or existing “Estate & Legacy” collapsible (or inside Tax Configuration).
- Default: **On**.
- Wire through `App.jsx` → plan → `simulate({ assumeStepUpBasis })`.
- In results (EarlyPanel / MaximizePanel): Show estate value and optionally a small note “Step-up in basis applied” when enabled.

### 3.2 Transparency & Education (Priority 1)
- In results panels or a new small “Tax Summary” strip:
  - Current year SS taxable % (from the new logic).
  - Effective marginal rate used for traditional withdrawals.
  - Simple “Tax model: Accurate provisional income + marginal rates” note with tooltip.
- Keep it subtle — progressive disclosure friendly.

### 3.3 Additional Input Catalog Wiring (Priority 2)
Wire these from original PRD §5 (use existing patterns: NumInput, Collapsible, conditional rendering):
- One-time / lump-sum expenses (year + amount, multiple entries possible).
- Legacy / estate target amount (affects sustainable spend or shows shortfall to target).
- Birth year (more precise than current age; drives exact RMD age and Full Retirement Age for SS).
- Phase-based spending (simple go-go / slow-go / no-go multipliers or separate monthly amounts per phase).

**Files:** `InputsPanel.jsx`, `App.jsx` (plan normalization), `plan.js` if needed.

### 3.4 Lightweight Monte Carlo / Stress Test (Priority 2)
- Add a toggle or mode: “Deterministic” vs “Stress Test” (e.g., -30% return in years 1-3, or simple Monte Carlo with 200–500 runs).
- Reuse existing `returnSeries` support in `simulate()`.
- In MaximizePanel or a new tab/section: Show success rate + range of outcomes (e.g., “92% of simulations last to life expectancy”, or “Depletes in year 27–34 (5th–95th percentile)”).
- Keep it optional and clearly labeled as illustrative.

**Files:** `simulate.js` (minor if needed), new or existing analysis helper, results panel, possibly a small new component.

### 3.5 Robustness & Test Polish (Priority 3)
- Improve the 3-iteration marginal rate solver (add a 4th iteration or simple binary search fallback for convergence).
- In RMD block: explicitly deduct the tax paid from `cd` then `bk` before/while adding net (better cash-flow modeling).
- Add regression tests for:
  - Low-provisional-income SS taxation.
  - RMD forcing with tax cash flow.
  - Step-up on vs off estate values.
  - Edge cases around `drawBase` / `yearOrdAccum`.
- Update `PRD.md` §4 (Current state) and roadmap to reflect tax accuracy completion + new items.

---

## 4. UI Guidance (Consistent with Existing Patterns)

- Use existing primitives: `Toggle`, `NumInput`, `Collapsible`, `Section`.
- Progressive disclosure: New inputs live in collapsibles, collapsed by default.
- One-screen goal: Keep primary inputs visible; advanced/estate/Monte Carlo in collapsibles or secondary panels.
- Results priority: Headline verdict → key levers/sensitivity → tax transparency strip → chart → detailed estate note.
- Mobile: Columns stack naturally; new toggles remain usable.

**Recommended new collapsible title examples:**
- “Estate & Legacy Planning”
- “Advanced Inputs” (for birth year, one-time expenses, phase spending)
- “Scenario Testing” (for Stress Test / Monte Carlo toggle)

---

## 5. Acceptance Criteria

- Step-up toggle works end-to-end and changes reported estate value.
- Results panels show useful tax/SS transparency without clutter.
- New inputs (one-time expenses, legacy target, birth year, phases) are wired and affect simulation where applicable.
- Stress Test / Monte Carlo preview runs without crashing and produces plausible output range.
- All new regression tests pass; existing invariants A–E still green.
- PRD.md is updated and accurate.
- No performance regression on repeated simulate() calls.

---

## 6. Implementation Notes for Claude Code

**Start with Priority 1** (step-up wiring + transparency) — fastest visible progress and builds user trust in the new tax model.

**Keep engine pure.** Most new work is UI + light analysis wrappers. Reuse `returnSeries` for Monte Carlo.

**Documentation:** Update PRD.md as part of this pass so future hand-offs stay in sync.

**Testing:** Add the new cases to `src/__tests__/` before or alongside feature work.

**Risks to watch:**
- Marginal rate solver convergence in extreme high-income or negative cases.
- Performance if full Monte Carlo is run on every keystroke (make it opt-in or debounced).

---

## 7. Recommended Next After This Pass

Once this medium work is done, the tool will be in a very strong position. Logical follow-ons:
- Deeper Monte Carlo visualization + probability-of-success in both modes.
- Dynamic Roth conversion optimizer (multi-year, bracket-filling).
- More complete healthcare cost modeling (post-65).
- Expanded state-tax nuance.

---

**This scoped PRD keeps momentum while delivering practical, user-facing value.** Ready to hand to Claude Code. Focus on Priority 1 first for quick wins. Let me know if you want example scenarios, wireframe sketches for the new panels, or test vectors for the new features.