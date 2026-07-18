# PRD — "Invest" tab: one instrument registry, one editable list, one priority

**Status:** Approved 2026-07-18. Branch `onboarding-flow`. Builds on the Funding Order work
(`PRD_FundingOrder_July2026.md`).

## Context

The app grew a set of "where should my money go" surfaces piecemeal: account balances in the
sidebar **Money** section, a separate **Annuities** section, kids'-education inputs, and a
**Funding Order** recommendation buried in "Show details." The user wants these unified:

> *"a list of all the instruments … manipulate the inputs for them … see how much I should invest
> in them, in which priority, to maximize my return. The simplest we can make this the better.
> All instruments now or future should be able to be included."*

**The thesis:** a single **instrument registry** is the source of truth, and everything reads from
it — the editable input list *and* the priority recommendation. Adding a future instrument is **one
registry entry**; it appears in both automatically. New tab: **Invest**.

## Design

### The registry — `src/constants/instruments.js` (net-new, the single source of truth)
An ordered array of instrument descriptors. Each declares everything the UI + ranking need:

```js
{
  key, label, category,        // category ∈ retirement | safe | income | kids
  tax,                         // free | deferred | taxable | stateExempt
  whose,                       // "you" | "kid"
  balanceKey, contribKey, contribUnit,   // existing DEFAULTS keys (contribUnit: year|month); null if n/a
  rateKey,                     // plan assumption that drives its growth (stockReturn / cashDepositRate / muniReturn / mygaRate / treasuryRate)
  capKey,                      // CONTRIB_LIMITS key (age-adjusted) or null (uncapped)
  accessAge,                   // penalty-free age (0 = anytime; 59.5 = locked)
  note,                        // short tax hint for the row
}
```

Registry-derived helpers: `instrumentsByCategory`, `afterTaxRate(plan, inst)` (pure — applies the
tax character to the instrument's rate), `accessPenalty(plan, inst)` (bridge-awareness: a locked
account scores low for early retirees).

### The Invest tab — `src/components/panels/InvestPanel.jsx` (net-new), full-width, two columns
- **Left — the editable list.** Instruments grouped by category (Your accounts · Safe/fixed ·
  Annuities · Kids). Each row renders its editable inputs (balance / contribution / rate) from the
  registry via existing primitives (`NumInput`). Kids grouped under "Not your retirement money."
- **Right — the priority.** `investPriority(plan)` ranks every "you" instrument by an after-tax
  score (rate × tax advantage, minus an access penalty for locked accounts pre-retirement; employer
  match pinned first as free money), fills each to its cap, cascades the overflow. Renders the
  ranked list + one **Apply** that writes the split onto the contribution inputs. The **impact**
  (retire ~N earlier / safe spend +$X) is measured by the engine (`runMain`/`sustainableSpend`) —
  order is registry-simple + extensible, the payoff number stays engine-accurate. Kids' cost shown
  below (the diverted-goal model, unchanged).

**Extensibility:** `investPriority` and the list both iterate the registry, so a new descriptor is
picked up everywhere with no other change.

### App wiring
`TABS` gains `{ key:"invest", label:"Invest" }`; a center-swap branch renders `InvestPanel`
full-width (like docs/advice). Agent `set_view` whitelists it. Mobile: the data-driven section
registry already surfaces new tabs.

## Phasing (each ships green, committed)
1. **Registry + Invest tab + editable list** (left column). Maps existing DEFAULTS keys — **no engine
   change**. Delivers "a list of all instruments, editable."
2. **Priority panel** (right column): `investPriority` order + engine impact + Apply. Delivers "how
   much, in what priority, to maximize return." Retire the standalone Funding Order card (its logic
   moves here) so there's one recommendation.
3. **Make MYGA + Treasuries real sim sleeves** (identity defaults, `if (bal>0)` guards, **A–E
   byte-identical, tested immediately**) so their balances flow into the projection + portfolio
   chart — the one careful crown-jewel step, done alone. Income annuity → a real `incomeStream`.
4. **Retire the scattered sidebar inputs** (Money / Annuities sections fold into the Invest tab; a
   thin "edit in Invest" shortcut or removal).

## Non-goals / decisions
- **Kids' 529/ESA/Trump are never drawn down for the user's retirement** — listed + editable, shown
  as a cost, separate group. (Not the user's money.)
- Simplicity over depth: the **priority order** is a transparent registry score (extensible to any
  instrument); the **impact number** is engine-measured. One recommendation, not two.

## Verification
- `npm test` green throughout; **invariants A–E byte-identical** after Phase 3 (proves the sleeve
  guards hold). Registry-integrity test (every `balanceKey`/`contribKey` exists in DEFAULTS; every
  `capKey` in CONTRIB_LIMITS). Render smokes for `InvestPanel` (list + priority + kids group).
- `npm run dev` + headless: Invest tab renders the full list; edits flow to the plan; Apply reroutes
  contributions and the verdict moves; a new registry entry appears in both columns.
