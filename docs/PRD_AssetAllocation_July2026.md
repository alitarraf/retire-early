# PRD — Asset Allocation & Risk Glide Path (Phase B), with Instrument Suite roadmap (Phase C)

## Context

**Why this exists.** The engine has no allocation or risk dimension. Every equity-type sleeve (401k, Roth, brokerage, HSA) grows at a single flat `stockReturn: 10%` in both accumulation (`projectTo`) and drawdown (`simulate`); only cash and munis carry their own fixed yields. A 30-year-old and a 64-year-old get identical returns with no de-risking. So the app cannot answer the user's core question — *"I have $100k, where do I put it given my horizon and risk tolerance?"* — because it has no notion of a stock/bond mix that shifts with age.

**The framing that drives every decision below (user's words):** the central question stays *"when can I retire comfortably?"* Asset allocation is a **tool to answer it**, not a separate destination. So allocation lives **inside the verdict panels**, not in its own tab. Risk tolerance must visibly move the retire-age answer.

**Annuity note (the prompt that started this).** The user's premise — annuities beat CDs and are tax-free — is wrong: non-qualified annuity gains are tax-*deferred* then taxed as *ordinary income* with no step-up (the least favorable treatment in the model). Annuities' legitimate role is a longevity hedge (SPIA/QLAC), already half-modeled as `incomeStreams`. That belongs in **Phase C**, not B.

**Scope of this doc.** Phase B (allocation glide-path engine + verdict-panel UI + onboarding pages) is fully specified. Phase C (new instruments) is outlined as a roadmap only.

---

## Phase B — Allocation & Glide Path

### Design decisions (settled)
- **UI home:** woven into the result panels (`EarlyPanel`, `MaximizeCenter`, `RetiredPanel`) — built once as a shared card, dropped into all three for parity (per the Early/Maximize parity rule). No new tab.
- **Glide model:** risk profile → **auto glide path** (equity share steps down with age, target-date style); expert mode can **pin a fixed mix**.
- **Backward-compatible & opt-in.** Follows the engine's established accuracy-model pattern ("defaults reproduce legacy behavior"). Default `allocationEnabled: false` → engine uses flat `stockReturn` exactly as today, so regression invariants A–E pass unchanged. Turning allocation on is what introduces bonds/glide.

### Engine work

**1. New `src/engine/allocation.js` (net-new).**
- Risk presets → glide path, e.g. `{ conservative, moderate, aggressive }`, each a `{ startEquity, endEquity, startAge, endAge }` band (moderate ≈ 90% equity young → ~40% at end).
- `equitySplitAt(age, profile)` → `{ equity, bond, cash }` shares summing to 1 (linear glide, clamped past endpoints).
- `blendedReturn({equity,bond,cash}, {stockReturn, bondReturn, cashReturn})` → weighted return.
- Pure functions, no React — belongs in the engine layer.

**2. New DEFAULTS keys in `src/analysis/plan.js` (~line 13–120), opt-in.**
- `allocationEnabled: false` — master gate (legacy behavior when false).
- `riskProfile: "moderate"` — `"conservative" | "moderate" | "aggressive" | "custom"`.
- `bondReturn: 4.5` — **new assumption** (model has `muniReturn`/`cashDepositRate` but no generic taxable-bond return).
- Expert pin: `pinAllocation: false`, `equityPct`, `bondPct`, `cashPct` (used only when `riskProfile === "custom"` or `pinAllocation`).

**3. Accumulation — `projectTo` (`plan.js:183–220`).**
- Today `r = plan.stockReturn/100` is the scalar equity rate for Roth/brokerage/401k/HSA (lines 197–218). When `allocationEnabled`, replace the scalar with a **per-year blended equity rate** from the glide path.
- `fvAnnuity` (`accounts.js:10`) takes a scalar `ratePct` and can't express a per-year rate. **Extend `fvAnnuity` to accept either a scalar or a per-year rate array/fn**; the `Math.pow(1+r, years-y+1)` term (line 16) indexes the series for years `y..years`. Existing-balance growth `Math.pow(1+r, yrs)` becomes a product of per-year glide rates. When `allocationEnabled` is false, pass the scalar and behavior is byte-identical to today.

**4. Drawdown — `simParamsAt` (`plan.js:223–297`) + `simulate` (`simulate.js`).**
- `returnSeries` is the existing hook for time-varying equity returns (re-read per year at `simulate.js:208`; already used by stress/historical/Monte-Carlo). When `allocationEnabled`, `simParamsAt` builds a glide-path `returnSeries` of length `lifeExpect − retireAge` where each year's entry is `blendedReturn(equitySplitAt(age), …)`.
- Composition with scenarios: the glide series is the **deterministic baseline mean**. Monte-Carlo (`engine/monteCarlo.js:84`) samples around the per-year glide mean instead of flat `stockReturn`; stress (`analysis/stressTest.js:25`) applies its crash to early years then reverts to the glide mean; historical replay stays as-is (fixed blend). Cash/muni sleeves keep their own yields (`simulate.js:341–342`) — the glide governs the equity `mr` only.

**5. Tests.**
- New `src/__tests__/allocation.test.js`: `blendedReturn` weighting; `equitySplitAt` monotonic de-risk and clamps; presets sum to 1.
- Extend `src/__tests__/perSleeveReturns.test.js` — the seam an equity/bond split plugs into.
- **Regression gate:** confirm invariants A–E still pass with `allocationEnabled: false` default (the whole point of the opt-in gate).

### UI work (Option 2 — woven into the verdict)

**Shared component `src/components/panels/AllocationCard.jsx` (net-new), dropped into all three panels for parity:**
- **Signature element:** the **glide-path band** — a horizontal stacked area (equity/bond/cash) across the age axis with "today" marked. This is the one memorable visual; everything around it stays quiet.
- Secondary: a small "today's mix" donut/bar; a risk selector (Conservative / Moderate / Aggressive / Custom); and the payoff — a **three-profile comparison** tying risk to the central question:

  ```
  When can you retire?
    Conservative   age 51
    Moderate       age 48
    Aggressive     age 48  ← you
  "More equity buys ~3 earlier years — at the cost of a rougher ride."
  ```

  **Why a comparison, not a single before→after arrow:** empirically (seeded sample plan) enabling the glide moves the earliest age *later* than the legacy flat-`stockReturn` baseline (47 → 48/51), because de-risking with age is more realistic than assuming 100% equity forever. An off→on arrow would read as a regression. The honest, actionable framing is profile-vs-profile: each row is `earliestRetireAge` run with `allocationEnabled:true` at that profile, current profile marked. In `RetiredPanel` the metric is money-lasts age instead. The three ages are computed **in `App.jsx`** (memoized on the allocation-relevant inputs — `earliestRetireAge` is a binary search; never run it in the card body) and passed as a prop. Copy must render gracefully when a "riskier" profile does **not** beat a safer one (ages can tie).
- **Palette:** reuse the app's existing `GREEN` / `MINT` / `MUTE` (from onboarding `parts.jsx`) — equity=green, bond=mint, cash=muted. Consistency over a new identity; no clashing scheme. No numbered markers (not a sequence). Respect `prefers-reduced-motion` — the only motion is the band reshaping on risk change.
- Wire into `EarlyPanel.jsx`, `MaximizeCenter`, `RetiredPanel.jsx`.

**Sidebar mirror — `AssumptionsFields` (`essentials.jsx:353`):** the raw inputs live here next to `stockReturn`/`inflationRate` — risk profile selector, `bondReturn`, and expert-mode custom equity/bond/cash pin (gated by `useExpertMode()`, matching the section's existing pattern). Update `sectionSummary("assumptions")` in `InputsSidebar.jsx:61`.

**Onboarding — new teaching step in `src/components/onboarding/steps.jsx`:** a top-level `Allocation` component (must be top-level for focus retention) added to the `STEPS` array (`steps.jsx:386`) after `saving`/`money`, `bar:true strip:true` so the live retire-age verdict updates as they pick a risk preset. Uses existing `OptionCard`/`WizField`/`Guide`/`CtaRow` primitives from `parts.jsx`; writes the same keys via `set`/`setMany`. Registry is data-driven — no `Onboarding.jsx`/`App.jsx` change needed since the new DEFAULTS keys round-trip automatically.

### RETI (Ask agent) integration — required, not automatic

The user requires RETI to fully interact with allocation. Exploration of the tool
surface shows the read path is free but the write path needs explicit wiring —
`update_inputs` would expose `riskProfile` as an *unvalidated free string* (accepts
`"banana"`), and the agent's plan context never mentions allocation, so the model
wouldn't know the current mix before changing it.

**Read path (free).** Every read tool — `run_scenario`, `find_earliest_retirement`,
`max_sustainable_spend`, `run_monte_carlo`, `stress_or_history`, `run_analysis` —
calls the normalized `plan` through the engine pipeline (`makePlan` →
`runAt`/`simParamsAt` → `simulate`, `toolRegistry.js:190/209/221/236/283/421`). Once
allocation threads through the engine (§B engine work), these reflect it with **zero
tool-layer change**. So "what's my earliest retire age if I go conservative?" works
for free after RETI sets the profile.

**Write path — a dedicated `set_allocation` tool** (in `src/agent/toolRegistry.js`,
modeled on `set_scenario`/`apply_lever`, `kind:"write"`, `writeKind:"inputs"` so it
inherits confirmation-staging / change-log / undo / write-budget for free):
- Schema: `enabled` (bool), `riskProfile` (string **enum** `conservative|moderate|aggressive|custom`), and custom pin `equityPct`/`bondPct`/`cashPct` (numbers).
- `buildProposal` **validates the enum** and **enforces equity+bond+cash ≈ 100** when custom/pinned (the generic `update_inputs` path does neither today — only `typeof` checks, no cross-field sum check), emitting `{ kind:"inputs", changes, payload }`.
- **Single owner:** add `riskProfile, allocationEnabled, pinAllocation, equityPct, bondPct, cashPct` to `UPDATE_EXCLUDED` (`toolRegistry.js:110`) so `set_allocation` owns them — mirroring how `retireAge`→`set_retire_age` and scenario fields→`set_scenario` are excluded from `update_inputs`. `bondReturn` stays in `update_inputs` as a return assumption alongside `stockReturn` (add a curated `FIELD_DESC` entry, `toolRegistry.js:127`).

**Agent context** (`src/agent/context.js`, `buildPlanContext`): add an allocation line
near the Assumptions line (`context.js:35`) — current risk profile, equity/bond/cash
mix, glide on/off — so the model knows the state before changing it. In retired mode,
note the glide is near its landing allocation.

**System prompt** (`src/agent/systemPrompt.js`): one line noting the agent can set
risk/allocation via `set_allocation` (parallel to the existing `set_scenario`
mention). Keep minimal.

**Docs:** bump the tool count in `CLAUDE.md` (14 → 15) and add `set_allocation` to the
write-tools list.

### Files touched (Phase B)
- Engine: `src/engine/allocation.js` (new), `src/engine/accounts.js` (`fvAnnuity` glide support), `src/analysis/plan.js` (DEFAULTS, `projectTo`, `simParamsAt`), `src/analysis/stressTest.js` + `src/engine/monteCarlo.js` (compose glide mean).
- UI: `src/components/panels/AllocationCard.jsx` (new), `EarlyPanel.jsx`, `MaximizeCenter`, `RetiredPanel.jsx`, `src/components/panels/inputs/essentials.jsx`, `src/components/panels/InputsSidebar.jsx`, `src/components/onboarding/steps.jsx`.
- Agent (RETI): `src/agent/toolRegistry.js` (`set_allocation` tool + `UPDATE_EXCLUDED` + `FIELD_DESC`), `src/agent/context.js` (allocation line), `src/agent/systemPrompt.js` (one line), `CLAUDE.md` (tool count + write-tools list).
- Tests: `src/__tests__/allocation.test.js` (new), extend `perSleeveReturns.test.js`; agent-surface tests — `toolDispatch.test.js` (reject bad `riskProfile` enum, sum-to-100, allocation fields excluded from `UPDATE_PATCH_FIELDS`), `agentContext.test.js` (allocation line present), `toolDrift.test.js` (auto-covers the new tool via the 1:1 registry mirror).

---

## Phase C — Instrument Suite (roadmap, not scoped here)

Add missing instruments as first-class sleeves, one at a time, on top of the allocation axis:
- **Taxable fixed income** — Treasuries (state-tax-exempt), TIPS, I-Bonds (inflation-linked, federal-deferred), corporate/bond funds. `bondReturn` from Phase B is the seam.
- **Traditional IRA + backdoor / mega-backdoor Roth** — deductibility phaseouts and the FIRE-crowd backdoor moves.
- **Annuity purchase as longevity hedge** — SPIA / deferred-income / QLAC (RMD deferral to 85), built on the existing `incomeStreams` payout plumbing. Model the non-qualified tax treatment honestly (ordinary income on gains, no step-up).
- **Medium:** rental real estate as an *asset* (not just income), REITs.
- **Explicitly out of scope, stated in-app with a one-liner why:** whole life / IUL (usually mis-sold), crypto, commodities, 529 (not retirement). Naming the exclusions is itself the CFA-grade advice.

---

## Verification

1. `npm test` — invariants A–E pass unchanged (proves the opt-in default is inert), plus the new `allocation.test.js` and extended `perSleeveReturns.test.js`.
2. `npm run dev` → drive the real flow:
   - Enable allocation; in the **verdict card**, switch Conservative → Aggressive and confirm the earliest-retire-age line moves (and the glide band reshapes). Repeat in **Maximize** and **Retired** panels (parity).
   - Expert mode: pin a fixed mix; confirm the glide flattens.
   - Run the **onboarding** step; confirm the live strip's retire-age updates as the risk preset changes, and the choice persists into the app after finish.
   - Sidebar `Assumptions` mirror reflects the same values two-way.
   - **RETI:** ask "set me to a conservative allocation" → confirm `set_allocation` fires, the verdict card + glide band update, and the change logs/undoes. Then ask "what's my earliest retire age now?" and confirm the read reflects the new mix (read path is free). Verify RETI knows the *current* mix ("what's my allocation?") from the context line, and that a bogus profile is rejected.
3. Sanity: with allocation on, a moderate glide should show a blended return below the flat 10% (bonds drag), and a *later* earliest-retire-age than all-equity — the honest trade-off.
