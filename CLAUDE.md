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

1. Roth contributions → 2. Roth earnings (59.5+) → 3. Converted Roth (5-yr elapsed, ANY age — principal only; tranche growth folds into Roth earnings and stays 59.5-gated) → 4. Munis → 5. HSA → 6. Brokerage (LTCG on gain fraction) → 7. 401k (59.5+, effective bracket) → 8. CD/cash

`simulate()` returns `{ snaps, depleted, bridgeShortfall }`. `depleted` fires only when ALL funds including the unlocked 401k are exhausted; a locked-401k shortfall is counted in `bridgeShortfall` instead (Scenario B test).

### Analysis (`src/analysis/`)

`plan.js` is the hub: `makePlan(rawInputs)` normalizes UI state into a plan object; `projectTo(plan, yrs)` grows per-account balances forward; `runAt(plan, age)` combines both and calls `simulate()`. Every other analysis file imports from `plan.js`, not directly from the engine.

The five analysis routines are each independent binary/grid searches that call `runAt` in a loop:
- `earliestRetireAge.js` — binary search for earliest safe exit age
- `sensitivity.js` — delta analysis for the Retire Early levers
- `marginalValue.js` — value of +$1k/yr per account type (Maximize panel)
- `optimalConversion.js` — best annual Roth conversion amount
- `sustainableSpend.js` — max safe monthly spend at the configured retirement age

### UI (`src/components/`, `src/App.jsx`)

`App.jsx` holds all state via `useState`, derives a `plan` from it via `makePlan`, and passes results down as props. Two right-panel variants (`EarlyPanel`, `MaximizePanel`) swap based on a mode toggle.

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
