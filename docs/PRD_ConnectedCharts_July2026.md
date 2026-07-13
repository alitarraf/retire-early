# PRD — Connected charts: instrument lens + mix at milestones

**Date:** 2026-07-13 · **Status:** building · **Branch:** `onboarding-flow`
**Parent brief:** `UX_InputsAndAllocation_July2026.md` (Threads 2 & 3; Thread 1 —
onboarding-style editable inputs — is deliberately out of scope and gets its own
PRD later). **Baseline:** `PRD_AssetAllocation_July2026.md` (Phase B).

## Why

Phase B made allocation drive the *numbers* (blended glide feeds `projectTo` and
the drawdown `returnSeries`) but not the *pictures*. The projection chart still
plots accounts only, so picking "60% bonds" changes nothing the user can see —
the feature reads as cosmetic. And the wide `GlideBand` answers neither "how
much" nor "when". One thesis fixes both: the mix you pick and every chart that
shows a result should read as one connected model, in one palette.

## Thread 3 — "Asset mix" lens on the projection chart

**Decision: display-only slice** (the brief's open question). The engine blends
one return for the growth pool; it never holds per-sleeve balances, so "true
sleeves" would be an engine rewrite for no display gain. The lens applies the
same assumption the numbers already use — that is honesty, not approximation:

- growth pool = `k401 + roth + brokerage + hsa`, split by `allocationAt(plan, age)`
- **stocks** = growth × equity
- **bonds** = growth × bond + `muni` (munis ARE bonds)
- **cash** = growth × cash + `cd` (CDs ARE cash)

Mechanics:

- `StackedChart` gains `series`/`colors` props (default = today's account stack);
  no behavior change for existing callers.
- `PortfolioChartCard` view toggle becomes **Projection · Asset mix · Outcome
  range**; the *Asset mix* option exists only when `plan.allocationEnabled`
  (when the glide is off the chart is exactly as before — no lens that would
  contradict the flat-return model).
- Palette = the AllocationCard's GREEN/MINT/MUTE family, stocks at the bottom
  like the allocation card, so the two surfaces read as one system.
- Tooltip, legend show/hide, zoom window, scenario overlay all work in the lens.
- A one-line caption under the lens states the mapping (growth accounts follow
  your glide; munis count as bonds, CDs as cash).
- Monte-Carlo fan stays totals-only (out of scope, per brief open question).

## Thread 2 — "Mix at milestones" replaces the glide band

**Decision: direction A** (labeled milestone columns) for the card, and the
same component in the onboarding *Allocate* step — one visual language, one
implementation, exactly like `GlideBand` was shared before. The scrubber-donut
(direction C) is not built. `GlideBand` is deleted.

- Milestones: **Today** (current age) → **At \<retire age\>** → **At 75**
  (`GLIDE_END_AGE`, the glide floor), deduped when ages coincide (already
  retired, retiring past 75).
- Each column is a stacked bar labeled with real percentages; a summary line
  answers how-fast/when-it-stops: "Stocks 90% → 45% by 75, then holds."
- Pinned/custom mix: a single "Your mix" column + "holds fixed — no glide."
- Card legend drops the duplicated percentages (the columns carry the numbers);
  it stays as a color key + blended return.

## Acceptance

- Picking a risk profile visibly re-shapes the Asset-mix projection view.
- Existing account view, fan view, and all current tests unchanged when
  `allocationEnabled` is off.
- All three verdict panels (Early / Maximize / Retired) get both changes for
  free (shared cards).
- Render smoke tests updated: milestone columns (card + onboarding), instrument
  lens on/off, pinned mix.
