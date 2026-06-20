# DEVLOG: Retirement Planner

A tax-aware, month-by-month retirement drawdown simulator (React + Vite, pure-JS engine).

---

## Quick reference (read this first on a fresh start)

**Run it**
- `npm run dev` → dev server (WSL2: case-insensitive FS, HMR needs polling — already set in `vite.config.js`; after edits, **restart server + hard-refresh** Ctrl+Shift+R or you'll see stale UI).
- `npm test` → vitest (CI gate). `npm run build` → prod build.

**Architecture (3 layers, never import upward)**
```
constants/brackets.js   TAX_YEAR=2026, brackets, limits, FPL/ACA, RMD table — single source of truth
engine/                 pure, no React: simulate.js (crown jewel), tax.js, accounts.js, rmd.js,
                        socialSecurity.js, monteCarlo.js
analysis/               plan.js (hub) + earliestRetireAge, sensitivity, marginalValue,
                        optimalConversion, sustainableSpend, stressTest, dynamicOptimizer
components/ + App.jsx    React UI
```

**Key facts that save time**
- **Live sidebar is `InputsSidebar.jsx`** (accordion). `MaximizePanel.jsx` is **DEAD CODE** — not imported by App. Don't edit it. (`InputsPanel.jsx` + the `Row` primitive were deleted 2026-06-18.)
- **Design tokens live in `src/theme.js`** (`neutral`/`status`/`phase`/`slider` + `eyebrowStyle`/`cardTitleStyle`); `src/index.css` themes the native range slider. Status hues (green/amber/red) are reserved for **verdicts**; phases use a separate cool **slate** ramp. Use tokens, don't reintroduce raw grays.
- `App.jsx` holds all state via `useState(DEFAULTS)`, derives `plan = makePlan(inputs)`, passes results down. **Four tabs:** Retire Early (`EarlyPanel`), Maximize (`MaximizeCenter`), **Get advice** (`AdvicePanel`), How it works (`DocsPanel`). **Col 3 is the permanent Ask chat on all tabs** (`ChatDrawer variant="rail"`, behind `isAskEnabled()`). The old `RightRail`/`MaximizeRail` are **deleted** (2026-06-19): Phase breakdown / Projected balances / next-$1k are now "Show details" cards in `ResultsExtras.jsx`; the "Try a lever" panel is the **Levers** section in the sidebar Fine-tuning group.
- **"Retire at" is a full-width command band** (`RetireAtControl.jsx`) at the top of the center results column, not a sidebar field. **No-lag scrubbing:** a slider drag updates `dragAge` ONLY (never `setInputs`), so `inputs`/`plan` stay referentially stable and every expensive memo is frozen for free; a cheap `livePlan`/`liveResult` (1 sim) tracks the drag; commit on release/discrete action triggers the full recompute. Don't "fix" this with `useTransition`.
- **Per-field help is single-sourced** in `constants/fieldHelp.js` (`FIELD_HELP` + `FIELD_HELP_GROUPS`) — feeds both the sidebar `InfoDot` tooltips and the DocsPanel inputs reference. Add a field's help once, there.
- **`survivesAt` (plan.js) is bridge-aware**: `depleted === null && bridgeShortfall === 0`. So `earliestRetireAge`/`sensitivity`/`retireByAge` all refuse ages where money is stranded in a locked 401k. Invariant D holds by construction (the verdict *is* `survivesAt`).
- **`simulate()` contract:** pure month-by-month drawdown. Returns `{ snaps, depleted, bridgeShortfall, estateGainTax, taxSummary, conversions }`. Draw order is a tested invariant.
- **`simParamsAt()` in plan.js is THE chokepoint** — every new sim field must route through it so all 5 analysis routines (which call `runAt → simParamsAt`) inherit it. Bypassing it makes analyses diverge from the verdict.
- **Tests are the gate.** Invariants A–E in `simulate.test.js` + others. When adding engine params, use **identity defaults** (off = byte-identical output) and re-run the full suite after every engine edit.
- Tax year is 2026, MFJ default. Annual update = single-file edit in `constants/brackets.js`.

**Test suite: 311 passing, 31 files** (194 before the Ask chat; +51 for Ask Pro §10). Ask agent + Ask Pro architecture is in `CLAUDE.md` (api/_lib shared logic, RLS-enabled tables, lazy supabase chunk, metered-dev note). Test §10 on **`netlify dev` :8888**, not Vite :5173.

---

## Session: 2026-06-19 (cont.) — Ask chat permanent + Ask Pro (§10) monetization

Big session on `historical-sequence`. Committed the agentic chat, made it a
permanent column, relocated the rails, and built + **verified live** the entire
§10 paywall funnel. Test count **256 → 311**, green + build clean throughout.
Every non-trivial step advisor-reviewed; committed in stages. Commits: `ecb5fa6`,
`d4e6797`, `74f13b5`, `e2618d6`, `ef42d49`, `5940fa0`, `2568cf4`, `7177502`,
`690611e`, `4cc44bd`.

### 1. Ask chat committed + "Start fresh" (`ecb5fa6`)
- Committed the previously-uncommitted agentic "Ask" chat (PRD §1–9, §11): client
  agent on Haiku 4.5, `src/agent/*`, `api/chat.js` proxy, behind `isAskEnabled()`.
- Fixed the §9 token-budget dead-end: `useAsk.reset()` clears transcript + token
  counter **in place** (no reload), keeps applied plan changes + audit trail, and
  rejects orphaned `awaiting_confirmation` log entries (would otherwise leak into
  the next conversation via `get_change_log`). Surfaced as a "New chat" button +
  actionable warning/hard-stop notices.

### 2. Chat is the permanent right column; rails dismantled (`d4e6797`)
- Desktop grid `400px 1fr 340px` — **col 3 is the always-on chat on every tab**
  (one mount; transcript survives tab switches). `ChatDrawer variant="rail"`:
  always open, no launcher/close/Esc. Collapses to 2 cols when `isAskEnabled()` is
  off (the §9 kill switch — not a user-facing collapse). Mobile stays a sheet.
- **`RightRail.jsx` + `MaximizeRail.jsx` deleted.** Their content relocated into
  "Show details" cards in `ResultsExtras.jsx`: Phase breakdown (Early), Projected
  balances + next-$1k (Maximize). The **"Try a lever"** sensitivity panel moved to
  a new **Levers** section in the sidebar Fine-tuning group (between Estate and
  Advanced; contextual note outside Retire Early). 5 sidebar touch-points + mobile
  sub-tab plumbing wired.
- Added direct SSR render tests for the three relocated cards (they sit behind a
  collapsed-by-default toggle, so nothing else mounted them).

### 3. Maximize live balances reconciliation (`74f13b5`)
- `ProjectedBalancesCard` read committed `atRetirement` while the hero used live
  `liveAtRetirement` → mismatch mid-drag, now that they share a column. Fed the
  card `liveAtRetirement` (the cheap, no-sim tier) so rows + Total track the slider
  in lockstep; dropped the dead committed memo. `marginalValues` stays frozen.

### 4. Ask Pro monetization — §10, built in 5 stages (`e2618d6`→`7177502`)
Server-authoritative metering funnel: anon 3/day → signed-in-free 5/day
(Supabase magic-link) → Ask Pro unlimited ($7/mo, Stripe). Decisions: Supabase
(Postgres + built-in auth), no trial, monthly-only.
- **`api/_lib/`** shared framework-free logic: `entitlement.js` (pure rules,
  DB-free unit tests), `gate.js` (identity + allow/deny + webhook write + peek),
  `stripe.js`, `supabase.js`, `auth.js`, `http.js`.
- **Functions:** `chat.js` gated, `stripe-{checkout,webhook,portal}.js`,
  `entitlement-status.js`. Migration `supabase/migrations/0001_entitlement.sql`
  (RLS enabled, no policies — server secret key only).
- **Client:** `supabaseClient.js` (lazy dynamic import → supabase-js is a split
  213KB chunk, main bundle ~346KB), `entitlement.js` hook, `Paywall.jsx`; wired
  into `useAsk`/`ChatDrawer` (Bearer token, 401/402 → paywall, counter, Pro badge,
  pending-question stash across redirect).
- **Key correctness:** a "prompt" = one **user turn**; the proxy derives the turn
  boundary from message shape (a `tool_result` continuation is not metered), never
  a client flag a paying user could forge. Quota commits only **after** a
  successful upstream start (errored turns don't burn). Gate **fails open**.
  Webhook is the single source of truth, idempotent by `user_id` from subscription
  metadata.
- **Tests added:** entitlement(17), gate(13), stripe(12), proxyGate(6), Paywall
  render(2), agentLoop seam(1). §10.7 secret check: no server secret in `dist/`.

### 5. Live verification under `netlify dev` + Stripe sandbox (`4cc44bd`)
- Full funnel passed on **http://localhost:8888**: anon 3/3 → signup wall →
  signed-in-free 5/5 → paywall → Checkout (test card) → webhook → **Ask Pro badge
  + Manage**. DB confirmed: `subscriptions` status=active (customer+user mapped);
  `usage` anon=3, free=5.
- **Two live-only fixes:** (a) supabase-js eagerly builds its Realtime client →
  throws on Node<22 (no native WebSocket); we only use REST+auth, so hand it the
  `ws` transport in `getServiceClient`. (b) SQL-editor table creation missed the
  `service_role` grant → "permission denied for table" (42501, not an RLS filter);
  migration now `grant ... to service_role`. Verified the publishable (client) key
  is still RLS-blocked from both tables.

### Decisions
- Chat is "permanent" = no user-facing collapse; `isAskEnabled()` remains the
  deploy kill switch (grid drops to 2 cols when off).
- Levers in non-Early tabs show a contextual note rather than computing sensitivity
  (no extra cost); kept gated to Early mode.
- Metering fails **open** (availability over DRM — it's a conversion nudge, §10.3).
- Pending question restored to the input on redirect return (not auto-sent) so a
  turn is never spent without an explicit press.
- **Gotcha pinned:** test §10 on **8888** (netlify dev, gated functions), NOT
  Vite's 5173/5174 (unmetered middleware, no `/api` functions).

### Tomorrow's starting point
- Branch `historical-sequence` is **not pushed / no PR** (9+ commits). Decide:
  push + PR.
- **Go-live (production):** deploy to Netlify; set all env vars in the Netlify
  dashboard (switch `STRIPE_*` to LIVE + live Price id); create a PRODUCTION
  Stripe webhook → `https://DOMAIN/api/stripe-webhook` (events:
  checkout.session.completed, customer.subscription.created/updated/deleted) and
  put its `whsec_` in Netlify; add the prod domain to Supabase Auth redirect URLs;
  set `APP_URL` to the prod domain. Optionally `ASK_ALLOWED_ORIGINS` + Stripe Tax.
- Optional: A/B the free counts (`LIMITS` in `api/_lib/entitlement.js`, now 3/5).

---

## Session: 2026-06-19 — Retire-at into sidebar, mobile-responsive layout

Feature work on the `historical-sequence` branch. Test count **192 → 194**, green +
build clean throughout. Each non-trivial item was planned (EnterPlanMode) and
advisor-reviewed. Commits: `f766315` (Retire-at move + padding), `ad4f224` (mobile).

### 1. Retire-at control back into the left sidebar (`f766315`)
- Moved `RetireAtControl` from the top of the center results column to the top of
  the **left sidebar** (under the navbar, above Essentials) and shrank it to fit the
  440px column (headline 25→16px, age 24→22px, steppers 34→28px, ticks/labels
  smaller, full-width slider, dropped the top accent border). Same no-lag
  scrub/commit wiring.
- `App.jsx`: sidebar column is now a flex wrapper with the accordion in a
  `flex:1 / minHeight:0` box so its pinned bottom caption isn't pushed off-screen
  (advisor catch). Empty-state microcopy updated to point at the sidebar slider.
- Added 40px bottom padding to both result panels so the trailing detail cards
  clear the bottom of the viewport.

### 2. Mobile-responsive layout (`ad4f224`) — **new `src/components/mobile/MobileShell.jsx`**
- Below **767px** the app renders a dedicated single-column shell instead of the
  3-column desktop grid; **desktop is untouched**, gated by new `src/useIsMobile.js`
  (`matchMedia`, returns `false` in SSR/tests so the desktop tree + existing
  assertions hold).
- **Mobile IA** (designed with the user, frontend-design skill consulted): top bar
  with a ☰ burger for the 4 page tabs; the Retire-at slider pinned as a hero; a
  scrolling results middle (right-rail content folds in); a **bottom nav** of input
  sections (You/Money/Spending/Assumptions/Fine-tune) that open an editor in place
  (tap-again / Done returns to results; Fine-tune opens a sub-tab strip over the 6
  optional sections). Get advice / How it works are content-only (no hero/bottom
  nav). Shell is a **`100dvh`** flex column (top bar / hero / middle = the only
  scroller / bottom nav as a flex sibling) so the bottom nav clears the iOS Safari
  toolbar.
- **`InputsSidebar` refactor**: each section's fields extracted into body components
  (`YouFields`, `MoneyFields`, …) keyed in an exported **`INPUT_SECTIONS`** map +
  `sectionSummary()`; the desktop accordion and the mobile single-section view both
  render from it — one source of truth, no redundant nav. Desktop output unchanged.
  The 401k withdrawal-preview state is owned by the sidebar (not `TaxesFields`) so it
  survives section switches (advisor catch — would have reset on desktop).
- **`embedded` prop** on `EarlyPanel` / `MaximizeCenter` / `RightRail` /
  `MaximizeRail`: drops the nested `height:100%`/`overflowY:auto` so they stack in one
  page scroll, and KPI grids go 2-up. Identity default → desktop byte-identical
  (gated, not a non-gated `auto-fit`, which would have reflowed narrow desktop —
  advisor catch).
- `ui.jsx`: `maxWidth:100%` on `NumInput` so fixed widths don't overflow narrow
  screens. Added 2 `MobileShell` render tests (early renders hero+nav+folded
  results; content tabs hide hero+nav).
- **Not yet verified in a real browser** (tests gate the mobile branch off, so 194
  green only proves desktop unchanged + the shell renders): real-device `100dvh`
  bottom-nav clearance, burger z-index over hero, sticky editor header, 360px
  overflow. Minor accepted: mobile Fine-tune sub-tab switch resets the 401k preview.

---

## Session: 2026-06-18 (cont.) — Interactive chart, design-system pass, Historical Sequence Testing

Continuation, all feedback-driven. Test count **185 → 192**, green + build clean throughout.
Each item was planned (EnterPlanMode) and advisor-reviewed where the advisor was available.
Merged via PRs #1 (interactive chart) and #2 (design-issues); `historical-sequence` branch open.

### 1. Interactive portfolio chart (`StackedChart.jsx`, `PortfolioChartCard.jsx`)
- **Hover** any year → composition tooltip (per-account $ + total) via full-height SVG hit-rects
  (no pointer→SVG coordinate mapping). **Legend click** show/hides an account type (axis rescales).
  **Zoom** via a dual-handle age `RangeSlider` (new in `ui.jsx`) + phase chips; the MC fan and the
  scenario line get the same age-window filter so overlays stay aligned.
- All interaction state lives in `PortfolioChartCard` (survives the Projection↔Range remount; both
  panels share it). Presentation-only — engine untouched.

### 2. Elevation language + flat "Show details" (`docs/on-elevation-show-details.md`)
- One elevation rule: floating = shadow only, grouping = flat tint, accent = a single left bar for
  status. Dropped warn borders (Card/KpiChip/BridgeWarning). `Collapsible` "Show details" → flat
  hairline disclosure (`DetailsToggle`); detail cards now flow in the same column. Draw-order
  footnote moved into the Phase-breakdown rail.

### 3. Design-issues pass (`docs/design-issues.md`, all 7) — **new `src/theme.js` + `src/index.css`**
- Solid age numbers (dropped gradient text; kept agePop + ✨); slider headline 48→24px so the 88px
  hero is the single answer. Phase vs status color split (slate phases). Native + custom sliders
  unified on shared slider tokens. Card titles → sentence-case; caps eyebrows reserved for section
  starts. ~10 grays collapsed to a 4–5 step neutral scale.
- **Clickable sensitivity levers** (`RightRail.jsx`): each lever has an explicit **Apply** button;
  `sensitivity.js` carries an input-namespace `apply` patch (distinct from the engine-override
  `ov` — caught a Max-Roth bug where apply could *lower* an above-7.5k contribution, guarded with
  `max(current, 7500)`). One-time apply (no silent stacking), an **Applied (N)** summary, and
  **Undo all** to the pre-lever baseline (state in `App.jsx`). Test: apply==preview earliest age.

### 4. Feature 5 — Historical Sequence Testing (`historical-sequence` branch)
- Third Scenario-testing mode: replay real bad markets (retire into 2000 / 2007 / 2022 / 1973).
  **No engine change** — reuses `simulate()`'s `returnSeries` hook (same as `stressTest`/`monteCarlo`).
- New `constants/historicalReturns.js` (`HISTORICAL_RETURNS` 1973–2024 with **two lenses** per year:
  all-equity S&P 500 and a 60/40 blend; `HISTORICAL_SCENARIOS`). New `analysis/historicalSequence.js`
  builds the series and **reverts to the user's mean** once recorded history ends.
- **Generalized the Stress overlay into one "scenario" path:** App builds a `{ result, color, label,
  blurb }` descriptor (stress = red, historical = violet); `stressSnaps`→`scenarioSnaps` (+color/label)
  through `PortfolioChartCard`→`StackedChart`; `StressCard`→`ScenarioCard`. Both result panels.
- ⚠️ **Historical return figures are representative (from memory) — flagged in the file header for
  verification against an authoritative source (NYU Stern / Bloomberg Agg) before relying on them.**
- Tests: `historicalSequence.test.js` (series build + revert-to-mean, early-years crash bite,
  S&P-harsher-than-blend, scenario coverage) + render tests for the overlay line + `ScenarioCard`.

### Decisions / notes
- Sequence-of-returns truth that bit a test: with a low withdrawal rate, a *bad start* can still end
  with **more** final wealth (the post-crash boom compounds), so the honest invariant is the
  **early-years** portfolio value, not final wealth. Tests assert the early dip, not the ending.
- Historical returns are **nominal** applied to the whole portfolio (engine has no per-bucket return
  in drawdown); the 60/40 lens makes that far less wrong than all-equity. 1973's high inflation is
  **not** separately modeled — only the market sequence (noted in the card copy).

### Tomorrow's Starting Point
- Push `historical-sequence` and open its PR (user confirmed it renders fine in-browser).
- **Verify the historical return data** against a real source before trusting projections.
- Possible follow-ups: blended-return realism (per-bucket returns in drawdown), or historizing
  inflation for the stagflation scenario.

---

## Session: 2026-06-18 — UX overhaul, goal-seek, contributions, MC chart, the "Retire at" lever

Long session driven by live user feedback. Test count 156 → 185. Green, build clean throughout.
**No engine math changes** except additive `projectTo` contribution levers + a deliberate
`survivesAt` semantics change (below). Each item was planned (EnterPlanMode) and advisor-reviewed.

### 1. UX simplification + "$7M retiree" CFP workflow
- **Two-tier sidebar** (`InputsSidebar.jsx`): **Essentials** (You · Money · Spending · Assumptions) always shown; **Fine-tuning (optional)** group (Taxes · Strategy · Healthcare · Estate · Advanced · Scenario) collapsed. Merged old Accounts+Savings into one **Money** section.
- **Quick-start onboarding** (`QuickStart.jsx`, new) — first-run mini-form (age · retired/working · total saved · monthly spend) pre-fills the sidebar; dismissal persisted in `localStorage`.
- **Hover tooltips** — new `InfoDot` primitive in `ui.jsx`; content single-sourced from new `constants/fieldHelp.js`, which `DocsPanel` now also renders from.
- **Progressive-disclosure output** — plain-language verdict line in the hero; secondary cards tucked behind a "Show details" `Collapsible` (Early + Maximize).
- **"Get advice" tab** (`AdvicePanel.jsx`, new) — advice-only/flat-fee fiduciary explainer, static AUM-fee illustration, links to NAPFA/XYPN/Garrett/Wealthramp, and an **export** of the plan summary (`analysis/planSummary.js`, new, pure). Disclaimers throughout (educational, not advice).

### 2. "Retire by a target age" goal-seek (`analysis/retireByAge.js`, new)
- Binary-searches the **extra monthly brokerage savings** needed to retire at a target age, plus the **trim-spend trade-off**. Oracle requires **`depleted === null` AND `bridgeShortfall === 0`** (a survival-only oracle understates savings for a young all-401k plan — verified: it'd say "$0" while `bridgeShortfall:234`).
- New `projectTo` override `brokerageAnnual` (additive, defaults 0): contributed principal adds to **both value and cost basis** (after-tax dollars → no phantom LTCG). Goal-seek override stacks on top of the user's input.
- Card displays `Math.ceil(extraMonthly)` so **following the recommendation always clears the bar** (round-down would leave a $1 residual). Integration test proves the loop closes.

### 3. Per-account contributions + one-click Max (`InputsSidebar.jsx`, `plan.js`)
- New **monthly** contribution inputs for **brokerage / CD / munis** (`×12 → fvAnnuity` at each account's rate; brokerage adds to basis). 401k/Roth/HSA keep annual inputs and gain a **Max** chip (fills the 2026 IRS limit). Single **"You save $X/mo ($Y/yr · N% of salary)"** readout at the top of Money.
- `retireByAge` `currentMonthlySavings` updated to include the new contributions (excl. employer match).

### 4. Monte Carlo chart restructure (both panels — parity)
- New shared **`PortfolioChartCard.jsx`**: a toggle between **Projection** (stacked composition) and **Outcome range** (a clean MC fan — `StackedChart view="fan"`: band + median + faint deterministic line, no bars). Fan view shows a Monte Carlo explanation card.
- **MC stats card moved into "Show details"; histogram removed** from the UI (`McDistChart` + `buildHistogram` retained, still unit-tested, just unused in-app). Maximize's on-demand MC folds into the toggle (Run button when not yet run).

### 5. Unify the target age
- Removed the separate "target age" textbox; the goal-seek card now keys to `plan.retireAge` (single source of truth) per user ("two age inputs is confusing").

### 6. The "Retire at" lever — elevated, no-lag, then made beautiful
- `RetireAtControl.jsx` (new): big slider + −/+ steppers + quick-target chips. **No-lag architecture** added in `App.jsx`: `dragAge` state + `livePlan`/`liveResult`; heavy memos stay on the committed `plan` and freeze during a drag via referential stability (see Quick reference). Confirmed ~1 sim/tick vs ~800.
- Iterated on placement per feedback: pinned-in-sidebar → full-width band → **center-column command band** (between sidebar and right rail, via grid restructure). Removed the duplicate sidebar "Retire at" field and the redundant header strip.
- **"Playful" treatment** (chosen over Horizon/Ticket/Glow options): the age **pops** on commit (keyed so it's smooth mid-drag), gradient text, a warm **"≈ N years away · free in YYYY"** sub-line, and a **"✨ your earliest"** sparkle when you land on the earliest feasible age. Milestone-age ticks (55 / 59½ / 62 / 65 / 67) on the track that teach + click-to-jump. Keyframes in App's global `<style>`; `prefers-reduced-motion` respected.

### 7. "Show details" → below the chart + auto-open
- `Collapsible` (`ui.jsx`) made optionally **controlled** (`open`/`onToggle`). Each panel auto-opens details when content appears there: a **stress test**, a **legacy-target change**, or switching the chart to **Outcome range** (`PortfolioChartCard` gained `onViewChange`). Still hand-collapsible; retire-age drags don't trigger it.

### 8. Chart phase labels (`StackedChart.jsx`)
- Fixed Bridge/Early/SS+ **overlap** (existence checks + left-to-right collision skip) and **over-bars** readability — labels now sit in a reserved **top strip** (bars scale into `plotH = H − 18`, so they can't reach the labels). No pill.

### Bugs fixed (advisor catches)
- **`earliestRetireAge` floored at `currentAge + 1`** → returned 63 for an already-retired 62-yo ($7M persona). Floored at `currentAge`. Regression test added (the suite never exercised `retireAge == currentAge`).
- **`survivesAt` was bridge-blind** → `earliest = 30` for an all-401k 30-yo (money stranded in a locked account). Made bridge-aware (semantics change; invariant D holds by construction since its verdict *is* `survivesAt`; full suite stayed green).
- **`InfoDot` popover clipped** by the sidebar's `overflow:auto` → rewritten to viewport-fixed + edge-clamped.
- **Fan view dupes**: duplicate "MC 10–90%" label and doubled MC explanation paragraph → deduped (inline legend suppressed in fan; clip note moved to a compact top-right tag; `MonteCarloCard` paragraph dropped).
- **Fan legend overlap** ("90th ↑ off-chart" ran into "Median") → short labels + clip note relocated top-right.
- **SSR comment-split** in adjacent static+dynamic text (`Earliest {age}`, `Retire by age {age}`) broke substring tests → template literals.

### Decisions
- **Early/Maximize parity**: output/UX changes go to *both* result panels (user corrected an Early-only scoping). Shared components where possible (`PortfolioChartCard`). Saved to memory.
- Goal-seek savings bucket is **taxable brokerage** (uncapped, reachable pre-59½ — what an early target needs). Brokerage/CD/muni contributions are **monthly** (paycheck-style, matches the goal-seek's "$/mo" answer); 401k/Roth/HSA stay **annual** (IRS framing). "Max" uses base limits (no 50+/55+ catch-up beyond HSA's) — noted, not a regression.
- CFP feature is **informational CTA + client-side export**, no backend; networks verified via web search.
- No-lag lever: **don't** reach for `useTransition` — the freeze is structural (don't mutate `inputs` during a scrub).

### Tomorrow's Starting Point
- **Manual browser pass** of everything SSR/tests can't see (this is the standing gap each round): the slider **drag feel** + the **playful animations** (pop/gradient/sparkle, reduced-motion), the command-band **fit** in the center column + milestone-tick alignment, the **auto-open** triggers (stress / legacy / Outcome range), the phase-label **top-strip** positioning across a near-60 retire age and tall-bars scenarios, and the **Quick-start → export** flows.
- New files this session: `constants/fieldHelp.js`, `analysis/planSummary.js`, `analysis/retireByAge.js`, `components/panels/{QuickStart,AdvicePanel,PortfolioChartCard,RetireAtControl}.jsx`.

---

## Session: 2026-06-17 (cont.) — Enhanced Stress Test & Monte Carlo

Implemented `PRD_Enhanced_Stress_Test_MonteCarlo_June2026`. Test count 136 → 156. Green, build clean.

### Completed
- **Engine (`monteCarlo.js`)** — enriched the return shape *additively* (backward-compat preserved, RNG draw order untouched): `p5/p50/p95EndTotal`, `depletionRate`, 12-bin `histogram`, plus exported pure helpers `percentile`, `buildHistogram`, `pctDepletedBefore`. Outcome range is ranked by **final estate**, not depletion age (every run has a final balance; depletion age is undefined for survivors).
- **`MonteCarloCard.jsx`** (new) — success rate + Worst/Median/Best (5th/median/95th) estate + one-sentence insight + expandable distribution. Returns `null` on missing result so callers pass through safely (no NaN).
- **`McDistChart.jsx`** (new) — final-estate histogram; depleted runs in the red leftmost bin; 5th/median/95th markers.
- **Retire Early**: replaced the inline MC block with `<MonteCarloCard>` (live). **Maximize**: MC is **opt-in** behind a *Run Monte Carlo* button (`maxMcOn` state in App; memo re-caches on input change) so optimizing stays fast — honors PRD's "optional secondary view" + performance asks.
- **Tests**: +12 in `monteCarlo.test.js` (percentile/histogram/pctDepletedBefore helpers + enriched-output ordering/sum/back-compat), +4 render guards (Maximize MC card + Run button, `McDistChart` normal + all-depleted). **Docs**: DocsPanel MC section (percentiles, distribution, on-demand-in-Maximize) + PRD marked Implemented.

### Follow-up: percentile fan on the portfolio chart (user request)
- `monteCarlo()` now also returns `bands: [{ age, p5, p50, p95 }]` — per-year percentiles of total portfolio value across all runs (exported helper `percentileBands`). All runs share the horizon and the engine pushes a yearly snapshot ($0 after depletion), so trajectories align by index; ~zero extra compute beyond the runs already executing.
- `StackedChart` gained an `mcBands` prop: a shaded 5–95% area + blue median line over the existing deterministic bars (kept). Wired in both panels via `mcResult?.bands`. Histogram retained per user ("keep the histogram for now").
- Tests: `percentileBands` unit tests + bands-shape/ordering assertions + a `StackedChart` fan render guard. **156 passing.**
- Note: snapshots are end-of-year, so bands run `retireAge+1 … lifeExpect` (aligns index-for-index with the deterministic snaps).
- **Scale fix (user feedback):** the raw upper band (a few lucky sequences → tens of $M) was driving the y-axis up and crushing the bars to an unreadable sliver. `StackedChart` now anchors `maxVal` to the central outcome (deterministic + stress + p50) and caps it at **2.5× baseMax**; when the upper band exceeds that it clips and the legend appends "90th ↑ off-chart". Full upper tail still visible in the histogram. Well-funded plans show the band uncapped.
- **10th/90th instead of 5th/95th (user feedback):** the whole MC surface (fan band, card stats, histogram markers) now uses a **10–90 cone** — tighter and more representative on the right-skewed distribution. Engine end-totals renamed `p5/p95EndTotal` → `p10/p90EndTotal`. Card labels: Downside (10th) / **Median estate (50th)** / Upside (90th). Clarified for the user: the median estate **is** p50 — `p50EndTotal === medianEndTotal` (added a test asserting it).

### Post-review fixes (advisor)
- **Maximize gate was one-shot**: `maxMcOn` never reset, so after the first *Run* every keystroke recomputed 500 runs live. Added `useEffect(reset, [mainSimParams])` → genuinely on-demand; button reappears after each edit.
- **Histogram "red = depleted" was a lie**: equal-width bin 0 swept low-but-surviving outcomes in with the $0 runs. `buildHistogram` now reserves bin 0 for *exactly* depleted runs (`depleted:true`) and spreads survivors over the rest. Chart colors by the flag.
- **`McDistChart` had no render coverage** (the one SVG outside the NaN net, since the card defaults to collapsed): added direct render tests.

### Decisions
- Initially shipped histogram-only (cheap; reuses sorted `endTotals`). **User then asked for a percentile fan on the portfolio chart** → added `bands` + `StackedChart` overlay, kept the histogram. Trajectory retention is cheap in practice (the 500 runs already execute live; we just keep each run's yearly totals), so the earlier perf worry didn't bite.
- Kept `engine/monteCarlo` and `analysis/stressTest` separate (layer rule) despite PRD Task 1's "enhance or replace" wording — enriched in place.

### Tomorrow's Starting Point
- **Manual browser click-through** of the two new stateful interactions SSR can't cover: the MC card's *Show/Hide outcome distribution* toggle, and Maximize's *Run Monte Carlo* button → card appears.

---

## Session: 2026-06-17

Big day — implemented three PRDs end-to-end. Test count 94 → 136. All green, build clean.

### Completed

**1. Medium Roadmap PRD** (`docs/PRD_Next_Medium_Roadmap_June2026.md`)
- New sidebar sections in `InputsSidebar.jsx`: **Estate**, **Advanced**, **Scenario** (accordion, collapsed by default, at the bottom after Healthcare; each has a `summary` chip + `CAPTIONS` entry).
- **Moved** the step-up-in-basis toggle out of the Tax section → **Estate** section (single source; this is why it "disappeared" from Tax).
- New inputs wired: `legacyTarget`, `birthYear` (override), `oneTimeExpenses` (add/remove repeater), phase spending (`goGoMult`/`slowGoMult`/`noGoMult` + `slowGoAge`/`noGoAge`), `scenarioMode` (deterministic/stress) + `stressDropPct`/`stressYears`.
- Engine (`simulate.js`): added one-time expenses, phase-spending multipliers, and a `taxSummary` output (`ssTaxableFrac`, `k401EffRate`). All identity-defaulted.
- `plan.js`: `birthYear` (when set) is authoritative for RMD start age; FRA stays manual with an SSA-derived hint (`fraForBirthYear` added to `socialSecurity.js`). All new fields routed through `simParamsAt`.
- `analysis/stressTest.js`: deterministic early-crash bad-sequence run (reuses `returnSeries`).
- Results: new `components/panels/ResultsExtras.jsx` — `TaxTransparency` (SS taxable %, 401k eff rate, step-up note), `LegacyGap` (estate vs inflated target), `StressCard` — shown in both `EarlyPanel` and `MaximizeCenter`.
- Tests: `roadmap.test.js`. Docs: `DocsPanel.jsx` + `PRD.md §4.7`.

**2. Priority 3 robustness** (PRD §3.5)
- **Marginal-rate solver → bisection** (`grossUpMonthly`, exported from `simulate.js`). Converges even across a bracket boundary; identical to old fixed-point except on straddling draws (where bisection is more accurate).
- **RMD tax cash-flow**: a forced RMD now reinvests the **full gross** into brokerage and pays the tax explicitly from cash (`cd`) then brokerage (`bk`). Degenerates to old behavior when `cd=0`.
- Tests: `priority3.test.js` (solver convergence, RMD with `cd>0`, step-up on/off, low-income SS). Docs disclaimers added.

**3. Stress test: verified + red chart overlay**
- Confirmed numerically the stress test is accurate: crash applied to early years then reverts to mean; "-30%" is a nominal annual rate compounded monthly (≈ -26% realized) — same convention as every other return in the engine. It's a deterministic worst-case, not a forecast.
- Added a **red stress-projection line** to `StackedChart.jsx` (only when Stress mode active), wired via `stressSnaps` in both panels.

**4. Dynamic Roth conversion optimizer** (`docs/PRD_Dynamic_Optimizer_June2026.md` — now marked Implemented)
- Engine: conversion ladder gained **bracket-fill mode** (`conversionCeiling` = taxable-income top to fill to) + configurable `conversionEndAge` (default 59.5; optimizer raises to ~72 for RMD-prep years) + `conversions[]` output.
- **Critical correctness fix:** conversion tax is funded from `cd`→`bk` AND the conversion is **capped at what that liquid can pay tax on**. Closes an artifact where a big bracket-fill with little cash was silently tax-free (which would have made the optimizer recommend a fictitious strategy).
- `analysis/dynamicOptimizer.js`: runs baseline + 10/12/22/24% bracket ceilings (~5 sims), picks max net estate, returns recommended bracket, per-year schedule, total converted, RMD reduction.
- UI: `MaximizeCenter.jsx` optimizer card with **Apply these conversions** button; `InputsSidebar.jsx` Strategy section shows active strategy + **Clear** (visible/reversible).
- Tests: `dynamicOptimizer.test.js` (incl. artifact guard) + new `render.test.jsx` (SSR render smoke tests via `react-dom/server` — no new deps; catches render crashes/NaN).
- `optimalConversion.js` kept (still unit-tested) but no longer used in the live UI.

### Bugs / Issues Discovered (fixed)
- **White-screen crash** typing in the retire-age field: `runMain` returns `null` when `retireAge < currentAge` (transient while typing), panels did `const { snaps } = result` → crash. Fixed with a null-result guard in `App.jsx` (renders a "Check the retirement age" card instead). Pre-existing latent bug.
- **Conversion under-taxing artifact**: conversion tax was capped at `cd`, so an unbounded bracket-fill could be tax-free → fixed with the affordability cap (see optimizer note above).

### Decisions Made
- `birthYear` drives **RMD age only**; FRA stays manual (avoid two controls writing the same value).
- `legacyTarget` is **display-only** (gap vs estate); does not constrain sustainable-spend. (MVP choice.)
- Phase multipliers default **1.0** (identity); stress test is a **separate illustrative card**, never the headline verdict.
- Optimizer objective is **estate-max only**. ACA/IRMAA respected **implicitly** via the objective (conversions feed MAGI → premium cost → lower estate), not as hard constraints — documented in `PRD.md §4.8`.
- Kept `optimalConversion.js` for its test; not used in UI.
- Engine changes always identity-defaulted; full suite re-run after each.

### Tomorrow's Starting Point
- **Manual browser click-through** of the optimizer Apply → Clear → re-Apply cycle. Render tests cover both *states* but not the click *transition* (SSR can't fire events). This is the one thing not yet visually verified.
- Then pick from TODO.md — strongest next candidate is deeper Monte Carlo visualization (percentile bands) or the sustainable-spend objective for the optimizer.
