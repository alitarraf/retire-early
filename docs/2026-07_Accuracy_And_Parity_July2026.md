# Accuracy & Parity Overhaul — July 2026

One sequential push (branch `accuracy-parity-overhaul`) covering four workstreams
decided after a full repo audit: engine financial accuracy, Reti agent tool
parity, an explicit already-retired mode, and UI simplification with an expert
layer. Every phase landed behind a green `npm test` gate; every engine change is
opt-in by parameter with defaults reproducing legacy numbers exactly, and
`simParamsAt` opts the app in.

## Engine accuracy fixes (Phase 1)

| Fix | What changed | Verified against |
|---|---|---|
| Bracket creep | Brackets/std deduction/FPL inflation-index via `taxIndexYears`/`indexFactor`; SS provisional thresholds stay frozen (law) | IRC §86; IRS annual adjustment practice |
| Conversion ladder | Converted principal spendable 5 years after each conversion at ANY age (was 59½-gated — the ladder couldn't bridge); growth folds into Roth earnings, still 59½-gated. **Draw-order invariant deliberately updated** | IRS Roth ordering rules |
| Per-sleeve returns | `cashReturn`/`muniYield` in retirement; fixed under `returnSeries` so cash buffers hold through crashes | — |
| LTCG stacking + NIIT | `autoLtcg` (plan default ON): yearly gain rate from LTCG brackets stacked on trailing ordinary income + state + 3.8% NIIT | Rev. Proc. 2025-32 ($49,450/$98,900/$66,200 0%-tops); IRC §1411 |
| ACA sliding scale | Applicable-percentage table (2.10–9.96%, linear within bands); 400% cliff retained per current law; `monthlyAcaFullPremium` = benchmark silver premium | Rev. Proc. 2025-25 |
| Income-tested Medicare | `autoMedicare` (default OFF — double-count risk with premiums in monthlyExpense): base Part B $202.90 + six IRMAA tiers, 2-year MAGI lookback seeded by `preRetirementMagi` | CMS 2026 |
| HSA rules | `hsaQualifiedFraction` caps tax-free draws at the medical share; non-qualified draws moved to a LAST-RESORT step (ordinary tax, +20% penalty pre-65 per IRC §223(f)(4)) | — |

## Analysis fixes (Phase 2)

- `sustainableSpend` rewritten onto the full `simParamsAt` pipeline (was a
  stripped param set omitting rule 55/SEPP/ACA/IRMAA/RMD/phases); success now
  also requires zero `bridgeShortfall`; guardrails zeroed inside the search
  (self-cutting spending makes "max sustainable" ill-defined).
- `optimalConversion.js` deleted — superseded by `dynamicOptimizer`, unused by the app.

## Coverage additions (Phase 3)

Built: `incomeStreams` (pension/annuity/part-time/rental — ordinary streams feed
drawBase and MAGI so SS taxation, ACA and IRMAA respond; excess banks to cash),
`expenseStreams` (mortgage-style ending costs, non-inflating by default),
survivor transition (`survivorAge`: single filing everywhere, larger-SS-only,
householdSize−1, `survivorSpendFraction`), windfalls (negative one-time
amounts), LTC-shock preset (UI).

Deferred, with reasons:
- **Per-spouse account split** — touches every bucket, projectTo, per-owner RMD
  clocks; an XL workstream on its own. Workaround: pooled accounts keyed to the
  primary (documented limitation).
- **Roth 401k / 457(b) / 403(b) sourcing** — approximate by allocating balances
  to the Roth/401k inputs; 457's no-penalty access can be approximated with rule55.
- **Dividend drag** — second-order vs. return assumptions; documented.
- **QCDs / inherited accounts / Joint-Life RMD table** — small model impact for
  the target user; documented limitations.
- **Pro-rata conversion rule** — documented, not modeled (assumes all-pre-tax).

## Already-retired mode (Phase 4)

`alreadyRetired` input; `makePlan` pins `retireAge = currentAge` and zeroes
accumulation flows in the normalized plan only (raw inputs preserved).
`RetiredPanel` replaces the earliest-age framing with a money-lasts verdict,
spending headroom, and "This year's moves" (RMD estimate, conversion
recommendation with apply, withdrawal-rate check). Sidebar Life-stage toggle;
QuickStart Retired path sets the flag; Reti context/tools respect it.

## Agent parity (Phase 5) — 10 → 14 tools

- `update_inputs` whitelist/schema **derived from DEFAULTS** (new inputs become
  writable automatically); excluded: retireAge, scenario fields, arrays.
- `DANGEROUS_FIELDS` (balances, ages, filing status, salary, alreadyRetired)
  always stage for confirmation.
- New: `run_analysis` (sensitivity/marginal_value/retire_by_age), `set_view`
  (never staged/logged), `apply_lever`, `revert_changes` (always staged; routed
  to the useAsk baseline restore).

## UI simplification (Phase 6)

InputsSidebar split into `inputs/{atoms,essentials,finetuning}.jsx` + thin
shell; Simple/Expert detail level (localStorage, cross-shell); "+ Add account"
collapsing for zero-balance accounts; stream editors, survivor scenario,
autoLtcg/autoMedicare, HSA medical share behind Expert; windfall + LTC preset
in Advanced; dead `MaximizePanel.jsx` deleted.

## Annual-update checklist additions

When bumping `TAX_YEAR`, now also verify: `LTCG_BRACKETS` (Rev. Proc.),
`ACA.applicablePcts` (Rev. Proc.; check whether enhanced credits return),
`MEDICARE.partBBase` + `irmaa` tiers (CMS), NIIT thresholds (statutory — fixed).
