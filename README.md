# Retirement Planner

A tax-aware retirement planning tool with two modes — **Retire Early** (find your
earliest safe exit age) and **Maximize Portfolio** (optimize what you build and
leave). See [PRD.md](PRD.md) for the full product spec, roadmap, and milestones.

## Status

**M0 (Foundation) complete.** The monolithic prototype has been split into a tested,
modular codebase. The simulation engine is pure and side-effect-free; the A–E
regression invariants are locked behind a passing test suite. Tax constants target
**2026**; the household model defaults to **Married Filing Jointly** (Single / HoH
also supported); spouses are modeled as a **combined household pool**.

## Quick start

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm test         # run the regression suite (the M0 gate)
npm run build    # production build
```

## Architecture

```
src/
  constants/brackets.js     # TAX_YEAR=2026: brackets, std deduction, limits, states, ACA/FPL
  engine/
    tax.js                  # effectiveFedRate / marginalFedRate (filing-status aware)
    accounts.js             # fvAnnuity, splitRoth
    simulate.js             # pure month-by-month drawdown — the crown jewel
  analysis/
    plan.js                 # normalize inputs → plan; projectTo / runAt helpers + DEFAULTS
    earliestRetireAge.js    # earliest safe exit (same engine as the verdict)
    sensitivity.js          # Retire Early levers
    marginalValue.js        # Maximize: value of $1k/yr per account
    optimalConversion.js    # Maximize: best Roth conversion amount
    sustainableSpend.js     # Maximize: max safe monthly spend
  components/
    ui.jsx                  # reusable primitives (real top-level components)
    charts/                 # StackedChart, BracketBar
    panels/                 # InputsPanel (left), EarlyPanel / MaximizePanel (right)
  App.jsx                   # state, plan derivation, two-column layout
  __tests__/                # tax / simulate / analysis regression tests
```

### Key design rules

- **The engine is pure.** `simulate()` takes inputs and returns
  `{ snaps, depleted, bridgeShortfall }` with no side effects — every analysis
  routine calls it. This is the highest-value, highest-risk surface; it is locked
  behind tests (invariants A–E in `src/__tests__`).
- **Never define components inside a render body.** All UI primitives and panels are
  real top-level components with props, so React preserves input focus on every
  keystroke.
- **Tax constants live in one file.** `constants/brackets.js` carries `TAX_YEAR` — the
  annual update is a single-file edit.

## Roadmap

P0 RMDs → P1 ACA cliff/MAGI → P2 Rule of 55 / 72(t) → P3 Monte Carlo →
P4 guardrails → P5 backlog. Details and milestones in [PRD.md](PRD.md).

> Planning estimates, not tax advice. 2026 figures must be reconciled against final
> IRS publications before relying on them.
