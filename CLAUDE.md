# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server → http://localhost:5173
npm test             # run regression suite (vitest run, CI gate)
npm run test:watch   # vitest in watch mode (interactive dev)
npm run build        # production build
```

To run a single test file: `npx vitest run src/__tests__/tax.test.js`

## Architecture

The app has three distinct layers. Code in a lower layer must never import from a higher one.

```
constants/brackets.js          ← TAX_YEAR=2026 single source of truth
engine/ (tax.js, accounts.js, simulate.js)   ← pure computation, no React
analysis/ (plan.js + five analysis routines) ← call engine; pure JS
components/ + App.jsx          ← React UI; calls analysis
```

### Engine (`src/engine/`)

`simulate()` is the crown jewel: a pure, side-effect-free month-by-month drawdown that every analysis routine calls repeatedly with varied inputs. Its draw order is a tested invariant — never change it without updating the regression tests:

1. Roth contributions → 2. Roth earnings (59.5+) → 3. Converted Roth (5-yr elapsed, ANY age — principal only; tranche growth folds into Roth earnings and stays 59.5-gated) → 4. Munis → 5. HSA (qualified medical share only) → 6. Brokerage (LTCG on gain fraction) → 7. 401k (59.5+, effective bracket) → 8. CD/cash → 9. HSA non-qualified (last resort: ordinary tax, +20% penalty pre-65)

`simulate()` returns `{ snaps, depleted, bridgeShortfall }`. `depleted` fires only when ALL funds including the unlocked 401k are exhausted; a locked-401k shortfall is counted in `bridgeShortfall` instead (Scenario B test).

Accuracy model (all opt-in via params; defaults reproduce legacy behavior, `simParamsAt` opts the app in):
- `taxIndexYears` — brackets/std deduction/FPL inflation-index from the retirement date onward (fixes bracket creep). SS provisional thresholds stay frozen (law).
- `cashReturn` / `muniYield` — per-sleeve returns in retirement; fixed under a `returnSeries` (cash doesn't crash).
- `autoLtcg` — yearly brokerage gain rate from real LTCG brackets stacked on trailing ordinary income + state + NIIT (plan default: on; `ltcgBracket` is the manual fallback).
- `autoMedicare` + `preRetirementMagi` — base Part B + income-tested IRMAA with the 2-year MAGI lookback (plan default: off — users often carry premiums in `monthlyExpense`).
- `hsaQualifiedFraction` — cap tax-free HSA draws at the medical share of spending.
- `incomeStreams` / `expenseStreams` — pension/annuity/part-time income (ordinary streams feed drawBase + MAGI, so SS taxation/ACA/IRMAA respond) and ending costs (mortgage).
- `survivorAge` / `survivorSpendFraction` — the widow's-tax transition: single filing for every subsequent lookup, larger-SS-only, householdSize−1, reduced spending.
- Negative `oneTimeExpenses` amounts are windfalls banked into cash.
- ACA is a sliding scale (Rev. Proc. 2025-25 applicable percentages) below the 400% FPL cliff; `monthlyAcaFullPremium` means the BENCHMARK silver premium.

### Analysis (`src/analysis/`)

`plan.js` is the hub: `makePlan(rawInputs)` normalizes UI state into a plan object; `projectTo(plan, yrs)` grows per-account balances forward; `runAt(plan, age)` combines both and calls `simulate()`. Every other analysis file imports from `plan.js`, not directly from the engine.

The analysis routines are each independent binary/grid searches that call `runAt` in a loop:
- `earliestRetireAge.js` — search for earliest safe exit age
- `sensitivity.js` — delta analysis for the Retire Early levers
- `marginalValue.js` — value of +$1k/yr per account type (Maximize panel)
- `dynamicOptimizer.js` — best Roth conversion bracket-fill strategy (estate objective)
- `sustainableSpend.js` — max safe monthly spend at the configured retirement age; runs the FULL `simParamsAt` pipeline (rule 55, SEPP, ACA, Medicare, RMDs, streams all price in), requires zero `bridgeShortfall`, and zeroes guardrails inside its search
- `retireByAge.js` — goal-seek: extra savings or reduced spending to hit a target age

**Already-retired mode:** `alreadyRetired: true` makes `makePlan` pin `retireAge = currentAge` and zero all accumulation flows in the NORMALIZED plan only (raw inputs preserved). The first tab becomes `RetiredPanel` (money-lasts verdict + "this year's moves"); the earliest-age machinery is skipped.

### UI (`src/components/`, `src/App.jsx`)

`App.jsx` holds all state via `useState`, derives a `plan` from it via `makePlan`, and passes results down as props. The center panel swaps by tab and life stage: `EarlyPanel` (planning), `RetiredPanel` (already retired), `MaximizeCenter`.

The input sections live in `components/panels/inputs/` — `atoms.jsx` (layout atoms, stream/one-time editors, the Simple/Expert detail-level switch `useExpertMode`), `essentials.jsx`, `finetuning.jsx` — with `InputsSidebar.jsx` as a thin shell owning the section registry (`INPUT_SECTIONS`), captions, and summaries. The mobile shell renders the same registry. Expert mode (localStorage `retire-early.expertMode` + window event) gates the deeper layer: stream editors, survivor scenario, autoLtcg/autoMedicare, HSA medical share, account minutiae; simple mode collapses zero-balance accounts behind "+ Add account".

**Never define components inside a render body.** All primitives are real top-level components in `ui.jsx` or their own files so React preserves input focus on every keystroke.

### Tax constants

All tax figures (brackets, standard deduction, contribution limits, state rates, ACA/FPL) live in `src/constants/brackets.js` under `TAX_YEAR = 2026`. The annual update is a single-file edit; verify against final IRS publications before relying on projections.

## WSL2 / Hot Reload

When running on WSL2 with the project on a Windows-mounted drive (`/mnt/d/`), inotify doesn't fire on file changes and the HMR websocket fails. Fix in `vite.config.js`:

```js
server: {
  host: true,
  hmr: { host: "localhost" },
  watch: { usePolling: true, interval: 300 },
},
```

`usePolling` makes Vite detect file changes on the Windows filesystem. `host: true` + `hmr.host: "localhost"` lets the Windows browser reach the WSL server via localhost.

## Ask agent & Ask Pro (`api/`, `src/agent/`)

The "Ask" chat is a client-side agent on Claude Haiku 4.5 (PRD
`docs/PRD_Agentic_Chat_June2026.md`). The agent loop runs in the browser and
executes the `analysis/*` routines as tools; `api/chat.js` is a stateless proxy
that injects `ANTHROPIC_API_KEY`. The whole feature is behind `isAskEnabled()`
(env/localStorage). It's the permanent right column on desktop and a sheet on
mobile.

**Tool surface (16 tools).** Reads: `run_scenario`, `find_earliest_retirement`,
`max_sustainable_spend`, `run_monte_carlo`, `optimize_roth_conversions`,
`stress_or_history`, `run_analysis` (sensitivity / marginal_value /
retire_by_age), `get_change_log`. Writes: `update_inputs` (every scalar
DEFAULTS key — the whitelist and schema are DERIVED from DEFAULTS in
`toolRegistry.js`, so new plan inputs are agent-writable automatically;
arrays, scenario/retire-age, and allocation fields excluded), `set_retire_age`,
`set_scenario`, `set_allocation` (risk profile / stock-bond-cash mix — a named
age glide or a pinned custom mix; enum + sum-to-100 validated; owns the
`allocation*`/`riskProfile`/`pinAllocation`/`equity|bond|cashPct` fields),
`route_savings` (funding-order waterfall — re-routes the SAME annual savings
across accounts in tax-optimal order: emergency cash → 401k match → HSA → Roth →
max 401k → brokerage overflow, each to its IRS cap; writes the per-account
contribution inputs; the ACCOUNT-LOCATION axis, distinct from `set_allocation`'s
stock/bond/cash mix — `analysis/fundingOrder.js`, `docs/PRD_FundingOrder_July2026.md`),
`apply_lever`, `set_view` (tab switching + MC trigger; never
staged or logged), `revert_changes` (undo-all; always staged).
`DANGEROUS_FIELDS` in `toolDispatch.js` (balances, ages, filing status,
salary, alreadyRetired) always stage for confirmation. In retired mode the
agent context leads with an ALREADY RETIRED line, `find_earliest_retirement`
short-circuits, and `set_retire_age` refuses.

**Ask Pro monetization (§10)** meters the agent: anonymous 3/day → signed-in-free
5/day (Supabase magic-link) → Ask Pro unlimited ($7/mo, Stripe). All entitlement
is **server-authoritative**:

- `api/_lib/` holds the shared, framework-free logic the functions reuse:
  `entitlement.js` (pure rules — DB-free unit tests), `gate.js` (identity +
  allow/deny + webhook write + peek), `stripe.js`, `supabase.js`, `auth.js`,
  `http.js`. A "prompt" = one **user turn**; the proxy derives the turn boundary
  from the message shape (a `tool_result` continuation is not metered), never a
  client flag.
- Functions: `api/chat.js` (gated), `api/stripe-{checkout,webhook,portal}.js`,
  `api/entitlement-status.js`, `api/plan-{get,save}.js` (account sync). Tables in
  `supabase/migrations/` — run the SQL in
  the Supabase SQL Editor; **RLS is enabled with no policies**, so only the
  secret key (server) can touch `usage`/`subscriptions`.
- Client: `src/agent/{supabaseClient,entitlement}.js` + `panels/Paywall.jsx`.
  `supabase-js` is a lazy dynamic import (separate chunk; only loaded where
  `VITE_SUPABASE_*` is set).

**Auth UI & plan sync.** `useEntitlement` is owned by `App.jsx` (not the drawer)
and passed down, so the nav-bar auth cluster and plan sync share one session. The
top-right `panels/NavAuth.jsx` shows the signed-in email + Sign out, or a proactive
"Sign in" popover (reusing `SignInForm`, extracted from `Paywall.jsx`) — sign-in is no
longer gated behind the 3-prompt wall.

**Plan sync (account-scoped).** Inputs persist to `localStorage` always (the
`retire-early.inputs` key in `App.jsx`), so a reload — including the magic-link
redirect — keeps the user's data. When **signed in**, `src/agent/planSync.js`
(`usePlanSync`) loads the plan on sign-in and autosaves (debounced) via two new
server-authoritative endpoints, `api/plan-{get,save}.js`, backed by the `plans` table
(`supabase/migrations/0002_plan_sync.sql`; same RLS-on/no-policies/secret-key-only
doctrine). Local-vs-remote conflicts surface a `panels/PlanSyncBanner.jsx` prompt
(Load saved / Keep this one) — never a silent overwrite. The reconcile logic
(`plansDiffer`/`reconcile`) is pure and unit-tested in `__tests__/planSync.test.js`.
Like the Stripe endpoints, plan sync is only live under `netlify dev`; plain
`npm run dev` falls back to localStorage-only.

**Env:** see `.env.example`. Server vars (`STRIPE_*`, `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`) never reach the bundle; only
`VITE_`-prefixed vars do.

**Dev metering:** `npm run dev` uses the Vite middleware proxy for `/api/chat`
only and has **no gate — it's unmetered**, and the Stripe/Supabase endpoints
don't exist there. Test the full §10 funnel under **`netlify dev`** (`npm i -g
netlify-cli`), which runs the real `api/` functions; pair with `stripe listen
--forward-to localhost:8888/api/stripe-webhook` for webhooks. When Supabase is
unconfigured the gate is a no-op and the chat behaves exactly as before.

## Test suite

`src/__tests__/` contains regression invariants A–E that lock in the engine's correctness. These are the M0 gate; all must pass before any engine change is merged. Tests use vitest with `environment: "node"` (no DOM).
