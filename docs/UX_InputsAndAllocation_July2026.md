# UX brief — Editable inputs, allocation viz, and one connected model

**Status:** scoping / not started. Captured 2026-07-08 from user feedback after
Phase B (asset allocation) shipped. Branch context: `onboarding-flow`.

**The throughline.** All three threads below are really one thesis: *the numbers a
user picks, the way they edit them, and every chart that shows a result should be
one connected model.* Right now they're three disconnected surfaces — a dense
input sidebar, a glide chart that lives only on the verdict, and a projection chart
that predates allocation and ignores it. Fixing them in isolation misses the point;
the win is making a change to one instrument visibly ripple through all of them.

---

## Thread 1 — Editable inputs that feel like the onboarding

**User's words:** *"I really like the onboarding flow data input and collection. It
does not feel overwhelming. Maybe we should replace the inputs on the right side we
currently have with something similar to the onboarding flow. Always accessible to
edit. Needs to think more about its scope and detail it as a UI/UX feature."*

**Problem.** The right-hand `InputsSidebar` is an accordion of dense field grids
(`essentials.jsx` / `finetuning.jsx`). It's efficient once you know the app but
overwhelming on first contact — the opposite of the onboarding, which paces the
same data into calm, one-question-at-a-time steps with plain-language framing and
guidance. We now maintain **two** input surfaces that collect the same DEFAULTS
keys with different tone and layout.

**Why it matters.** The onboarding's low-cognitive-load feel is the app's best UX
asset. Editing after onboarding drops the user off a cliff into a different idiom.
Unifying them means one tone, one set of copy, one place to maintain.

**Design directions (to compare, not yet chosen):**

- **A. Onboarding-as-editor (reuse `STEPS`).** The sidebar becomes a compact,
  always-open version of the wizard: the same step bodies (`Stage`, `Money`,
  `Saving`, `SpendSS`, `Allocate`…), but rendered as a scrollable/segmented editor
  instead of a linear paged flow. One source of truth for both first-run and edit.
  Risk: the step bodies were written for a full-width paged canvas; cramming them
  into a ~320px column may need a responsive variant of each.

  ```
  ┌─ EDIT YOUR PLAN ─────────────┐
  │ ▸ You & household            │  ← collapsed groups mirror the wizard steps
  │ ▾ Your money            edit │
  │     Guided card: "What have  │
  │     you saved — and where?"  │
  │     [401k] [Roth] [Brokerage]│
  │ ▸ Saving & income            │
  │ ▸ Spending & Social Security │
  │ ▸ How it's invested          │
  └──────────────────────────────┘
  ```

- **B. Two modes, shared components.** Keep the terse grid for power users
  (Expert), but make the *default* (Simple) sidebar a guided, onboarding-toned
  variant built from shared field components. Leverages the existing
  `useExpertMode` switch.

- **C. "Review your answers" surface.** A summary-first panel: each onboarding
  group shows its current answer as a sentence ("You'll spend $6k/mo, retire at
  55"), click to expand the guided editor for that group. Closest to how people
  actually revisit a plan (skim, tweak one thing).

**Recommendation to explore first:** a hybrid of **A + C** — summary sentences that
expand into the *actual* wizard step bodies, so there's literally one implementation
of each input group. Decide after a spike on whether the step bodies survive a
narrow column.

**Open questions:**
- Desktop only, or does this also replace the mobile inputs sheet?
- Does "always accessible" mean the permanent right column, or a slide-over that any
  "edit" affordance opens?
- How does this coexist with the Ask/RETI column, which currently owns the right
  side on desktop? (Input editor vs. chat — do they share the column, tab, stack?)
- Migration: keep Expert grid as-is and only restyle Simple, or replace both?

**Rough effort:** L. This is an information-architecture change to the whole input
surface, not a restyle. Spike first.

---

## Thread 2 — A clearer allocation visualization

**User's words:** *"I don't like the asset allocation graph — it's too long left to
right and doesn't tell me useful info except that stocks go down and bonds go up,
but I'm unsure about how much and when. Maybe a different way of displaying it."*

**Problem.** The current `GlideBand` (a full-width stacked area across age) reads as
"stocks decline, bonds rise" but answers neither *how much* nor *when*. It has no
scale, no axis labels, no milestone markers — and its aspect ratio forces the eye
across a wide, low band where small percentage differences are invisible.

**What the viz should answer:**
1. What's my mix **right now**?
2. What will it be **at the moments that matter** — at retirement, and late in life?
3. **How fast** does it shift, and when does it stop (the glide floor)?

**Design directions:**

- **A. "Mix at milestones" — a few labeled columns, not a continuous band.** Show 3–4
  stacked bars at meaningful ages (Today · At retirement · 75 · Late), each labeled
  with actual percentages. Discrete, readable, and it names *when*.

  ```
   Today        At 55       At 75
  ┌──────┐    ┌──────┐    ┌──────┐
  │██████│90  │████  │60  │███   │45   ██ stocks
  │██    │ 5  │██    │30  │███   │40   ▓▓ bonds
  │▓     │ 5  │▓     │10  │▓     │15   ░░ cash
  └──────┘    └──────┘    └──────┘
        "Stocks: 90% → 45% by age 75"
  ```

- **B. Single "equity share" line with annotated inflections.** Drop bonds/cash to a
  secondary read; plot just the equity % vs age as one line, with dots + labels at
  today / retirement / floor ("holds at 45% from 75 on"). Answers how-much/when with
  one uncluttered curve. Compact vertically.

- **C. A morphing donut tied to a scrubber.** One donut of the current mix + an age
  scrubber; drag to see the mix at any age. Interactive, space-efficient, and it
  makes the glide *tangible*. Pairs naturally with the age slider the app already has.

**Recommendation to explore first:** **A** for the static verdict card (a glance
answers all three questions with real numbers), and consider **C** for the
onboarding teaching step (interaction teaches the concept). Retire the wide
continuous band.

**Open questions:**
- Which milestone ages are meaningful per user — retirement age + a fixed 75, or
  derived (retirement, +10, life expectancy)?
- Keep any time-continuous view at all, or is milestone-discrete strictly better here?

**Rough effort:** M. Contained to `AllocationCard` + the onboarding step; the
`allocationAt(plan, age)` engine API already returns everything needed.

---

## Thread 3 — The projection chart must include bonds (one connected model)

**User's words:** *"The portfolio-over-time chart doesn't seem to include bonds. It
feels disconnected from the instruments we're selecting in asset allocation. All of
the data and display should be interconnected."*

**Problem.** `PortfolioChartCard` predates Phase B. It plots balances by **account
type** (401k / Roth / brokerage / cash…) but has no concept of the stock/bond/cash
*allocation within* those accounts. So a user who just set "60% bonds" sees a
projection that visually looks 100%-equity — the allocation choice and the outcome
chart are two disconnected stories.

**Why it matters.** This is the crux of the user's whole note. If choosing an
allocation doesn't visibly change the portfolio chart, the feature feels cosmetic.
The engine *does* already use the glide (blended return feeds `projectTo` and the
drawdown `returnSeries`) — so the numbers are connected; only the **display** is not.

**Design directions:**

- **A. Add a sleeve view toggle.** Let the chart switch between "by account"
  (today's view) and "by instrument" (stocks / bonds / cash bands), the latter driven
  by `allocationAt(plan, age)` applied to the projected total. Same chart, a lens
  that matches the allocation card's colors (GREEN/MINT/MUTE) so the two read as one
  system.
- **B. Always-on instrument shading.** Keep the account breakdown but shade/pattern
  each series by its stock/bond/cash composition — richer but likely too busy.
- **C. A second small "what you hold" area chart** beneath the projection, stacked by
  instrument, sharing the x-axis — an explicit companion to the allocation card.

**Recommendation to explore first:** **A** — one chart, a lens toggle, reusing the
allocation palette so selecting a profile visibly re-colors and re-shapes the
projection. Verify the engine can surface per-sleeve balances (it currently blends to
a single return; may need to track sleeve balances through `simulate`/`projectTo`, or
approximate by applying `allocationAt` to the total each year).

**Open questions:**
- Do we need *true* per-sleeve balances (rebalancing, different draw order by sleeve)
  or is applying the age-appropriate mix to the total each year an honest-enough
  display? (First is an engine change; second is display-only.)
- Should Monte-Carlo / stress views also gain the instrument lens for consistency?

**Rough effort:** S–M if display-only (apply `allocationAt` to projected totals);
L if we track real per-sleeve balances through the engine. **Answer the "true
sleeves vs. display approximation" question first — it sets the size.**

---

## Suggested sequencing

1. **Thread 3 first** (or its display-only slice) — it's the credibility fix: it
   makes Phase B feel real by connecting the allocation choice to the outcome chart.
2. **Thread 2** — small, self-contained, immediately improves the shipped card.
3. **Thread 1** — largest; do the spike, then scope properly as its own PRD.

Each should be detailed into its own PRD before building. See
`PRD_AssetAllocation_July2026.md` for the Phase B baseline these build on.
