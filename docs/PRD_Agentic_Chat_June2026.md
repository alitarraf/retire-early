# PRD: Agentic Chat for the Retirement Simulator ("Ask")

_June 2026 · Educational planning tool — not financial advice._

> **Revision note (June 2026):** This revision plugs gaps raised in two external
> review rounds (Grok). Round 1 — write-tool safety, change audit trail, agent
> transparency, error handling, context/token management, observability, cost
> control, feature flag, and accessibility. Round 2 (minor) — structured/queryable
> change log + reliable partial revert, summarization quality, soft per-session
> token budget, tool-description drift test, anonymized intent logging, and
> confirmation-card diffs. See **§12 Review changelog** for the full mapping.
>
> **Monetization (June 2026):** Added **§10 Business model & monetization** — the
> simulator stays free; the agent is metered via a three-step funnel (anonymous
> **3/day** → signed-in-free **5/day**, email magic-link → **Ask Pro $7/mo** via
> Stripe). Rolling-daily quota keyed on a signed device cookie.

## 1. Context

The simulator today is a pure, client-only React/Vite app. Users fill in the
left sidebar, see results in the center/rail panels, and switch between
**Retire Early**, **Maximize**, **Get advice**, and **How it works** tabs. Every
piece of analysis is a *pure JS function* (`runAt`, `earliestRetireAge`,
`sustainableSpend`, `monteCarlo`, `optimalConversion`, `dynamicOptimizer`,
`sensitivity`, `marginalValues`, `historicalSequence`, `stressTest`) that takes a
normalized `plan` and returns numbers — no React, no network.

The gap: the tool is powerful but *interrogative*. A user must already know which
lever to pull and which panel to read. We want an **agentic interaction** — after
entering their data and seeing output, the user chats with an assistant (built on
**Claude Haiku 4.5**) that can answer specific questions, reframe the situation
("what's my real risk if I retire at 57?"), run counterfactual simulations on
demand, and **drive the dashboard** — changing inputs and scenarios so the charts
update live as it explains.

This is a natural fit because the analysis routines are *already in the browser*.
The agent loop runs client-side and executes those functions directly as "tools."
A serverless proxy exists only to hold the Anthropic API key and forward requests.

**Intended outcome:** a docked, collapsible chat drawer available on every tab
that turns the simulator from a form into a conversation, while every number it
states is computed by the real engine — never by the model.

### Locked decisions
1. **Agent powers:** read + drive UI — it can run any analysis *and* mutate
   inputs / switch scenarios so panels update live.
2. **Chat surface:** persistent collapsible side drawer, available on all tabs.
3. **Proxy host:** a single Vercel/Netlify serverless function (`/api/chat`).

### Non-goals (for this version)
- Moving analysis to a server API. The engine is pure client-side JS; serverising
  it would mean re-implementing or exposing it, adding latency and complexity for
  no current benefit. Revisit only if a non-browser client (native app, public
  API) is wanted later.
- Persisting conversation *history* across sessions. Chat transcripts are
  in-memory per tab. (Note: §10 does add lightweight **accounts** for billing /
  entitlement — but not chat persistence.)
- Auto-generating financial advice or fiduciary recommendations (see §4).

---

## 2. Architecture

```
Browser (React)                          Serverless                 Anthropic
─────────────                            ──────────                 ─────────
ChatDrawer  ──messages+tools+system──▶  /api/chat  ──+API key──▶  Messages API
   │  ◀────────────── SSE stream ───────  (stateless     ◀───── SSE ──────┘
   │                                       key-injector +
   ▼                                       forwarder)
agentLoop.js (manual agentic loop)
   │  parses tool_use blocks
   ▼
toolDispatch.js ── name+args ──▶ analysis/*  ── plan ──▶ engine/*
   │ read tools  → return numbers as tool_result
   │ write tools → confirm (if gated) → call App actions → return confirmation
   ▼
feed tool_result back → loop until stop_reason === "end_turn"
```

**The agent loop runs in the browser.** This is non-negotiable, not a preference:
the analysis functions are pure browser JS. Executing tools server-side would mean
reimplementing the entire engine. The proxy is a **per-turn, stateless
key-injector / SSE forwarder** — it runs no loop and holds no conversation state.

---

## 3. Layer placement (respect the existing 3-layer rule)

The chat feature is **UI-layer**. It calls `analysis/*` (which calls `engine/*`).
Nothing new goes into `engine/`.

```
src/agent/
  agentLoop.js      ← manual tool-use loop; talks to /api/chat; error handling
  toolRegistry.js   ← single source of truth for tools (schema + handler + meta)
  toolDefs.js       ← derives Anthropic tool schemas FROM toolRegistry (no drift)
  toolDispatch.js   ← pure: (toolName, args, plan, actions) → result; UNIT-TESTED
  systemPrompt.js   ← builds the system prompt (persona, rules, disclaimer)
  chatClient.js     ← fetch wrapper around /api/chat with SSE parsing
  context.js        ← plan-summary compaction + rolling history window
  telemetry.js      ← anonymized trajectory + usage logging (opt-in)
src/components/panels/
  ChatDrawer.jsx    ← docked collapsible panel, message list, input box
  ChatMessage.jsx   ← renders turns + "Actions taken" + change audit trail
api/
  chat.js           ← serverless proxy (Vercel/Netlify function)
```

---

## 4. Safety, control & trust (the core of this revision)

A hallucinated balance or a silent, unexpected change to the user's plan are the
two worst failure modes for a money tool. This section defines the rails.

### 4.1 Numbers come from tools, never the model
The system prompt **forbids the agent from doing arithmetic itself**:
- Every figure it states must come from a tool result, quoted verbatim.
- To compare options it must call `run_scenario` for each — never estimate.
- Persona is **a cautious educational assistant**, not an advisor: reuse the exact
  disclaimer line from `buildPlanSummary` (`src/analysis/planSummary.js`); no
  fiduciary-style directives ("you should buy X"), no predictions stated as
  certainty. It frames outputs as "the model projects…", surfaces assumptions,
  and defers to a fee-only fiduciary for decisions (consistent with the existing
  "Get advice" tab).

### 4.2 Write-tool safety — graduated confirmation
The locked decision is **direct mutation** ("drive UI"), but "undo alone" is not
enough protection. We reconcile this with a **graduated confirmation** model
(configurable; see §9 feature flag):

| Situation | Behavior (default) |
|---|---|
| Single, small, reversible change (e.g. retire age ±2, one scenario toggle) | Apply directly, show in audit trail. |
| Large change, or **2+ changes in one turn**, or anything crossing a threshold (e.g. spending ±>15%, conversion ceiling change) | A **"Apply these changes?"** card shows an explicit **diff per change** (field: old → new value) so the user sees exactly what will change; nothing mutates until they confirm (or confirm a subset). |
| `confirmMode: "always"` (flag) | Every write is confirmed first. `confirmMode: "never"` reverts to pure direct mutation. |

- **Write-op budget:** max **3 write operations per user turn**; beyond that the
  agent must summarize and ask the user how to proceed.
- Confirmation cards are rendered by the drawer, not the model — the model
  *requests* a change via a write tool; the dispatcher decides whether to apply
  immediately or stage it for confirmation, and returns that status as the
  tool_result so the agent narrates accurately.

### 4.3 Change audit trail + easy revert
Reuse and extend App.jsx's `leverBaseline` / `appliedLevers` / `undoLevers`:
- The drawer shows a persistent **"Changes made by Ask"** list — one row per
  change (field, old → new value, timestamp) with **per-row revert** and a single
  **"Undo all agent changes"** button.
- The control is **prominent whenever the agent has pending or applied changes**
  (badge + colored affordance), not buried.
- Baseline is snapshotted before the agent's first mutation in a session, so
  "Undo all" restores the user's original inputs in one step.

### 4.4 Conversation memory of its own changes
The agent must not lose track of what it already changed. We keep a **structured
change log** (not just the lever snapshot), independent of the React state, e.g.:

```
changeLog: [
  { id, ts, field: "monthlyExpense", from: 10000, to: 8000, scope: "input",  status: "applied" },
  { id, ts, field: "scenarioMode",   from: "deterministic", to: "stress", scope: "scenario", status: "applied" },
]
```

- A compact rendering of this log is injected into each turn's context (see §5) so
  the agent reasons against the *current* plan, not the original.
- The agent can also **query it on demand** via the `get_change_log` read tool
  (§6.1) to answer "what did you change earlier?" precisely.
- The log is the backing store for the §4.3 audit trail and powers
  **per-change revert** ("revert only the spending change" → revert the entry with
  `field: "monthlyExpense"`), so partial undo is reliable, not best-effort.

---

## 5. Context & token management

`buildPlanSummary` output is sizeable and conversations grow; unmanaged, tokens
balloon. Strategy (in `src/agent/context.js`):

- **Compact plan summary:** a trimmed variant of `buildPlanSummary` — current
  inputs, latest headline results, and the §4.4 changes block — refreshed each
  turn and injected **after** any cache breakpoint (as a `role:"system"` message
  in `messages[]` or user-turn context), never interpolated into the system
  prompt (which would invalidate caching every turn).
- **Rolling history window:** keep the **last 4–6 turns verbatim**; older turns
  are folded into a short running recap. Poor summarization causes the agent to
  forget context or contradict itself, so the recap is **not** a free-form blob —
  it's produced by a **dedicated Haiku summarization call** constrained to a
  **strict structured format**: the user's stated goals/constraints, decisions
  reached, open questions, and a pointer to the §4.4 change log (numbers are not
  re-summarized — they live in the change log and the per-turn plan summary, which
  are authoritative). The recap is regenerated incrementally as turns age out, not
  rebuilt from scratch each time. Hard cap on total prompt tokens via a
  `count_tokens` check before each request; if exceeded, drop the oldest verbatim
  turn into the recap and re-check.
- **Prompt caching (documented decision):** do **not** architect cost savings
  around it. The stable prefix (system + tool defs) may fall *under* Haiku's
  4096-token cache minimum and silently not cache. If we cache, the volatile plan
  summary stays after the breakpoint. Treat caching as a possible bonus, not a
  dependency.

---

## 6. The tool surface (curated, ~6 tools — driven by a registry)

Haiku needs **prescriptive, "call this when…" descriptions**. Curate a small set
that maps to user intents, not a 1:1 dump of analysis functions. To avoid
**schema drift** as analysis functions evolve, tools live in a single
`toolRegistry.js` (schema + handler + display metadata in one place);
`toolDefs.js` derives the Anthropic schemas from it, and `toolDispatch.js` routes
to the handler. Adding a tool = one registry entry.

### 6.1 Read tools (counterfactual engine — reuse `overrides`)
The `overrides` parameter already on `runAt`/`simParamsAt`/`projectTo`
(`src/analysis/plan.js`) **is the counterfactual engine**. "What if I retire at
57, spend $8k, convert $30k/yr" = `runAt(plan, 57, {monthlyExpense, annualRothConversion})`
with **zero state mutation**. The primary read tool is a thin wrapper over it.

| Tool | Wraps | "Call this when…" |
|---|---|---|
| `run_scenario` | `runAt(plan, age, overrides)` + headline metrics | the user asks what happens if they change retire age, spending, conversions, SS age, etc. Pass only the fields that change as `overrides`. |
| `find_earliest_retirement` | `earliestRetireAge(plan)` | "how early can I retire?" / safe-exit questions. |
| `max_sustainable_spend` | `sustainableSpend(plan)` | "how much can I safely spend per month?" |
| `run_monte_carlo` | `monteCarlo(simParamsAt(plan,age), {n:500, seed:42})` | the user asks about probability of success / market risk. |
| `optimize_roth_conversions` | `dynamicOptimizer(plan)` / `optimalConversion(plan)` | tax-efficiency / Roth conversion questions. |
| `stress_or_history` | `stressTest` / `historicalSequence` | "what if the market crashes when I retire?" / GFC, 1970s, etc. |
| `get_change_log` | reads the §4.4 structured change log | the user asks what the agent changed, or it needs to revert a specific earlier change. Returns the structured entries (field, from→to, status). |

Each read tool returns a **compact JSON of already-computed numbers** (e.g.
`{ survives, depletionAge, endEstate, portfolioAtRetirement, successRate }`),
formatted via `format.js` where useful. Large arrays (`snaps`) are summarized,
not dumped, to control tokens.

### 6.2 Write tools (the "drive UI" choice — gated per §4.2)
App.jsx already has the lever machinery. Write tools reuse it and the §4.2/§4.3
confirmation + audit layers.

| Tool | Action (passed into dispatcher from App) | Notes |
|---|---|---|
| `update_inputs` | `setInputs(prev => ({...prev, ...patch}))` | partial patch; snapshots baseline on first call; gated by §4.2. |
| `set_scenario` | sets `scenarioMode` + scenario params | switch deterministic / stress / historical so the overlay renders. |
| `set_retire_age` | `onCommitAge(age)` | drives the Retire-at control + recompute. |

Write tools return a status (`applied` / `awaiting_confirmation` / `rejected`)
plus the resulting headline numbers so the agent narrates the real outcome.

### 6.3 Multi-turn planning & disambiguation
- The agent **may propose a sequence** ("first lower spending to $8k, then check
  the crash scenario") but must execute steps as discrete, individually-audited
  tool calls within the §4.2 budget — not a single opaque batch.
- **Disambiguation:** when a request is ambiguous (e.g. "is it enough?" without a
  target), the system prompt directs the agent to ask one clarifying question
  rather than guess inputs.

---

## 7. Error handling & resilience

In `agentLoop.js` and the dispatcher:
- **Tool failure / malformed args:** the dispatcher validates args against the
  registry schema; on failure it returns a structured `tool_result` with
  `is_error: true` and a clear message so the agent can recover or ask, rather
  than crashing the loop.
- **Engine exceptions** (e.g. `runAt` returns `null` for age < currentAge) are
  caught and surfaced as a non-fatal tool error with guidance.
- **Loop ceiling:** ≤ 8 tool iterations per user turn. On hitting it, the loop
  stops and the agent posts a graceful "I've gathered a lot — here's what I have"
  message instead of spinning.
- **Network / proxy errors (4xx/5xx, stream drop):** chatClient surfaces a
  retryable error in the drawer ("Couldn't reach the assistant — retry?"); the
  user's typed message is preserved.
- **Partial stream:** if the SSE stream ends mid-message, render what arrived and
  mark the turn incomplete.

---

## 8. UX, transparency & accessibility

1. User fills inputs, sees results (unchanged).
2. An always-visible docked handle on the right expands the **ChatDrawer** over
   the right rail (or as an overlay) on any tab.
3. **Dynamic suggested prompts:** 3–4 starters generated from the *current*
   results (e.g. if earliest-retirement < target age, suggest "Can I retire
   sooner than 55?"; if MC success < 80%, suggest "How do I de-risk?").
4. **Transparency — "Actions taken":** each assistant turn includes a collapsible
   panel listing every tool called, with arguments and a one-line result
   ("ran *Monte Carlo* (age 57) → 86% success"). Builds trust and aids debugging.
5. **Change visibility:** the §4.3 audit trail and "Undo all agent changes" are
   prominent whenever changes exist; confirmation cards (§4.2) appear inline and
   render an explicit old → new **diff** per change. A persistent **"What
   changed?"** control expands the full audit trail on demand — even when no new
   change was just made — so the user can always review everything the agent has
   touched this session.
6. **Mobile:** full-screen sheet (reuse `useIsMobile` / `MobileShell`). Test the
   chat ↔ chart hand-off: applying a change should visibly update the chart when
   the sheet is dismissed or in a split view.
7. **Accessibility:** keyboard-operable (focus trap in drawer, Esc to close,
   Enter to send, tab order through messages/cards), ARIA live region for
   streaming assistant text, ARIA roles on the message log, screen-reader labels
   on tool chips and revert buttons, respects `prefers-reduced-motion` (already
   used in App.jsx).

Apply all of the above to **both** result-panel contexts (Early & Maximize) —
consistent with the established parity rule for this app.

---

## 9. Operations, cost control & rollout

- **Feature flag:** ship behind a flag (`featureFlags.ask` via env/localStorage)
  so the high-risk feature can be disabled instantly and rolled out gradually.
  The same config carries `confirmMode` (§4.2).
- **Observability:** `telemetry.js` captures **anonymized** agent trajectories —
  tool-call sequences, args, durations, errors, and token usage per turn — with
  **no PII / no plan numbers by default**. To improve the agent over time it also
  logs the **triggering user question** (the original intent) alongside its tool
  trajectory, anonymized and **opt-in** (gated by the same flag) — so we can see
  *which questions* produce poor tool choices, not just the calls themselves.
- **Cost / usage tracking + soft token budget:** record per-session token counts
  (from the API `usage` block) and a running cost estimate ($1/$5 per MTok).
  Enforce a **soft per-session token budget**: a non-blocking warning at ~50k
  tokens ("this conversation is getting long — consider starting fresh for best
  results") and a **graceful hard stop at ~100k** that ends the session with a
  clear message rather than silently continuing to spend. Thresholds are
  configurable via the feature flag config.
- **Proxy abuse controls (ship blocker):** `/api/chat` is a public endpoint that
  spends our budget. Required server-side: **origin allowlist** (CORS + server
  `Origin`/`Referer` check), **per-IP/session rate limit**, **server-enforced
  `max_tokens`** per turn (~1024) and **per-session message cap**, plus
  minimal **request logging without message content** for abuse detection. The
  ≤8 tool-loop ceiling is client-side; the proxy rate limit is the backstop.

---

## 10. Business model & monetization ("Ask Pro")

The **simulator stays 100% free** — anyone can enter their data, see all results,
switch scenarios, and export. **Only the agent ("Ask") is metered and monetized.**

### 10.1 Tiers — a three-step funnel

The quota is a **conversion lever, not a cost-control mechanism** (Haiku is
pennies; abuse is handled by the §9 rate limits + origin allowlist). So we use a
graduated funnel that captures an **email** before asking for money:

| Tier | Who | Agent access |
|---|---|---|
| **Anonymous** | anyone, no signup | **3 prompts / rolling 24h**, then a sign-up nudge. |
| **Signed-in free** | email magic-link, **no card** | **5 prompts / rolling 24h**, then a paywall nudge. |
| **Ask Pro** | subscriber | **unlimited** (fair-use per §9), **$7 / month** via Stripe. |

Why the middle tier: the anonymous → paid jump is a hard ask. Inserting a
free-but-signed-in step (a) captures an email — a known user we can re-market to —
and (b) is a soft, no-card ask that warms the user toward the paid step. This is
typically the single biggest lever on conversion.

- **A "prompt" = one user turn**, *not* one Anthropic API call. The agent loop
  makes several model calls + tool calls per user turn (§7); those do **not** each
  decrement the quota. Only the user's submitted message counts.
- A prompt is consumed **only on a successfully started turn** — an errored turn
  (network/proxy failure, §7) does not burn quota.
- The read-only simulator and the "Get advice" tab are never gated.
- **The 3 / 5 counts are A/B-tunable, not sacred.** 3 may be too few to reach the
  "aha" (a real question often spends a turn on clarification first). Instrument
  drop-off at the wall and tune the free counts to maximize conversion without
  scaring off genuine evaluators.

### 10.2 Architectural implication (new for this app)

This is the app's **first persistent backend state**. It requires three new pieces
the static app didn't have:

1. **Lightweight accounts** — needed so a subscription follows the user across
   devices/sessions and can be managed/cancelled. Recommend **email magic-link**
   (passwordless) to keep friction low; OAuth optional later. Anonymous users get
   their 3 free prompts **without** signing up — signup is only required to
   subscribe.
2. **Entitlement datastore** — a small DB / KV (e.g. Vercel Postgres/KV, Supabase,
   or similar). Minimal schema:
   - `users`: `id, email, stripe_customer_id, subscription_status,
     current_period_end`
   - `usage`: `key, tier, count, window_start` — the rolling-daily counter, where
     `key` is the **signed device cookie id** for anonymous/signed-in-free users
     (and the `user.id` for signed-in users so their 5/day follows them across
     devices). `window_start` drives the rolling 24h reset.
3. **Authoritative entitlement gate in the proxy** — see §10.3.

> Keep PII minimal: store email + Stripe customer id + subscription status only.
> **Stripe holds all card data (PCI scope stays with Stripe).** No card data ever
> touches our backend or client.

### 10.3 Enforcement — server-side at `/api/chat`

Client-side gating is trivially bypassable, so entitlement is enforced **in the
proxy**, which already holds secrets and brokers every agent call. The counter is
keyed on a **signed device cookie** (a server-issued, signed id — not
`sessionStorage`, which a refresh would reset), with **hashed IP as a backstop**
against trivial cookie-clearing. Window is **rolling 24h**. Per **user turn** (the
client flags turn boundaries; the proxy is the source of truth):

```
on /api/chat (new user turn):
  deviceId = verify(signed device cookie)        // issue one if absent
  ipHash   = hash(IP)                            // backstop only

  # 1. Paid?
  if user is signed in AND subscription_status == "active"
       AND current_period_end in the future:     → allow, no metering

  # 2. Determine free allowance by tier
  limit = 5 if user is signed in (free)           # 5/day, keyed on user.id
          else 3                                   # anonymous, 3/day

  # 3. Rolling-daily counter (reset window if older than 24h)
  row = usage[ signedInUser ? user.id : deviceId ]
  if now - row.window_start > 24h:  row = { count: 0, window_start: now }
  if row.count < limit:  row.count++; allow
  elif user is signed in:  respond 402 { reason: "quota_exhausted", tier: "free" }   ← paywall
  else:                    respond 401 { reason: "signup_required" }                  ← sign-up nudge
```

- **Anonymous metering is a soft nudge, not a hard wall.** Keyed on the signed
  device cookie + hashed IP; a determined user can still reset it via
  incognito/VPN. That's an accepted rounding error — Haiku is cheap and the goal
  is conversion, not airtight DRM. The §9 rate limits and origin allowlist are the
  real abuse backstop; chasing VPN resetters would cost more than it saves.
- **Signed-in-free quota follows the user** (keyed on `user.id`), so it can't be
  reset by clearing cookies — a deliberate nudge toward signing in.
- Active subscribers are subject to the §9 fair-use caps (rate limit, soft token
  budget) — at $1/$5 per MTok a typical month of use is a few cents to low
  dollars, so $7/mo carries a healthy margin while caps protect against scripts.

### 10.4 Stripe integration

Use **Stripe Checkout (`mode: "subscription"`)** + **Billing Portal** + webhooks.
Grounded in current Stripe best practices:

- **Product/price:** one recurring **Price** of **$7/mo** (use Prices, not the
  deprecated `plan` object); store the price id in env (`STRIPE_PRICE_ID`).
- **Checkout Session** (server, in a new `api/stripe-checkout.js`): create with
  `mode: "subscription"`, `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`,
  `success_url` / `cancel_url`, and the user's `customer` (or `customer_email`).
  **Never pass `payment_method_types`** — let Stripe pick dynamically. Optional
  `subscription_data.trial_period_days` if we offer a trial (see open questions).
- **Webhook** (`api/stripe-webhook.js`, signature-verified with
  `STRIPE_WEBHOOK_SECRET`, idempotent): handle
  `checkout.session.completed` → mark user active + store `stripe_customer_id`;
  `customer.subscription.updated` / `.deleted` → sync `subscription_status` +
  `current_period_end`; `invoice.payment_failed` → flag dunning. The webhook is
  the **single source of truth** for entitlement — never trust the client's
  post-checkout redirect alone.
- **Billing Portal** (`api/stripe-portal.js`): a "Manage subscription" link so
  users self-serve upgrades/cancel/payment-method updates.
- **Keys:** use a **restricted API key (`rk_`)** scoped to Checkout/Billing, not a
  full secret key. Test against a **Stripe sandbox** before go-live.
- **Tax:** enable **Stripe Tax** on the subscription if we owe sales tax/VAT/GST
  (note for go-live; not blocking the build).

### 10.5 UX & nudge

- The drawer shows a subtle **prompt counter** reflecting the user's tier
  ("2 of 3 free prompts left" anonymous; "4 of 5 left" signed-in free).
- **Two-stage nudge** (matches the funnel in §10.1):
  - Anonymous user hits the wall (`401 signup_required`) → inline **sign-up card**:
    "Sign in free to keep asking (2 more per day)" with an email magic-link field.
    Soft, no card. On verify, they become signed-in-free and continue.
  - Signed-in-free user hits the wall (`402 quota_exhausted`) → inline **paywall
    card**: "Keep asking — unlimited for $7/month", **"Subscribe"** → Checkout,
    plus a "maybe later" dismiss.
- In **both** cases the user's typed question is preserved and auto-sent the moment
  they clear the gate (signed in, or subscribed).
- After Checkout returns, the client confirms entitlement with the backend (which
  was updated by the webhook) and resumes the conversation seamlessly.
- Subscribers see a small **"Ask Pro"** badge and a **"Manage subscription"** link
  (→ Billing Portal) in the drawer header.
- Failed payment / lapsed subscription → drop back to the free tier with a gentle
  "your subscription lapsed — update payment" link to the portal.
- Gate behind the existing §9 feature flag so monetization can be toggled
  independently of the agent itself (e.g. ship the agent free first, enable
  paywall later).

### 10.6 Files & env (additions to §13)

- **Create:** `api/{stripe-checkout,stripe-webhook,stripe-portal}.js`,
  `api/auth/*` (magic-link request + verify), `src/agent/entitlement.js`
  (client-side: fetch quota/sub status, surface paywall state),
  `src/components/panels/Paywall.jsx`.
- **Env:** `STRIPE_SECRET_KEY` (restricted), `STRIPE_PRICE_ID`,
  `STRIPE_WEBHOOK_SECRET`, plus the entitlement DB connection string and an
  auth/session signing secret. All server-side only; never in the client bundle.
- The Anthropic proxy (`api/chat.js`) gains the §10.3 entitlement check before
  forwarding.

### 10.7 Testing & verification (additions)

- **Entitlement unit tests:** quota decrement only on successful user turns;
  subscriber bypasses metering; anonymous → `401 signup_required` after the 3rd
  prompt; signed-in-free → `402 quota_exhausted` after the 5th; expired
  `current_period_end` reverts to free.
- **Rolling-window tests:** counter resets after 24h; a turn at hour 25 starts a
  fresh window; clock advanced mid-window does not reset early.
- **Tier-transition tests:** anonymous device cookie that signs in inherits the
  user-keyed 5/day counter; clearing the cookie does **not** reset a signed-in
  user's quota (keyed on `user.id`).
- **Webhook tests:** signature verification, idempotent replays, each event type
  maps to the correct `subscription_status`.
- **End-to-end (Stripe sandbox / test cards):** 3 free prompts → paywall →
  Checkout with a test card → webhook flips status → 4th prompt allowed; cancel
  via Billing Portal → next period reverts to free.
- **Security check:** confirm no Stripe secret or entitlement bypass is reachable
  from the client bundle; the only authority is the server.

### 10.8 Decided

- **Funnel:** anonymous **3/day** → signed-in-free **5/day** → Ask Pro unlimited.
- **Window:** rolling 24h.
- **Counter key:** signed device cookie (+ hashed IP backstop); signed-in users
  keyed on `user.id`.
- **Login:** email magic-link (passwordless), primarily to capture email for the
  free tier.

### 10.9 Open questions (product calls, not blockers)

- **Free counts:** start at 3 / 5 but treat as A/B-tunable (§10.1) — measure
  drop-off at each wall.
- **Free trial?** e.g. 7-day Pro trial via `trial_period_days` vs. straight to paid.
- **Annual plan?** a discounted yearly price alongside $7/mo.
- **Add Google OAuth** later alongside magic-link?

---

## 11. Model & API call specifics (Haiku 4.5)

- **Model id:** `claude-haiku-4-5` (200K context, $1/$5 per MTok).
- **Keep the call surface minimal.** Haiku's params ≠ the Opus examples:
  `effort` **400s** on Haiku 4.5, and do **not** add adaptive-thinking config.
  Send only: `model`, `max_tokens`, `system`, `tools`, `messages`.
- **Streaming:** stream the response (SSE) for responsive typing in the drawer.
- **Tool loop:** manual agentic loop (client-side). On `stop_reason === "tool_use"`,
  execute every `tool_use` block, append one `user` message containing all
  `tool_result` blocks (matching `tool_use_id`), and re-request. Stop on
  `end_turn` or the §7 ceiling.
- **Proxy contract:** client POSTs `{ model, max_tokens, system, tools, messages }`;
  proxy injects `x-api-key`, calls `POST /v1/messages` with `stream: true`, and
  pipes the SSE back unchanged. The key is **never** in client code or the bundle.

---

## 12. Review changelog (Grok feedback → where addressed)

| Review item | Addressed in |
|---|---|
| Write-tool confirmation layer | §4.2 graduated confirmation + feature flag |
| Runaway changes / write budget + change summary | §4.2 write-op budget; §4.3 audit trail |
| Change audit trail + per-change revert | §4.3 |
| Conservative tone / advice guardrails | §4.1 persona + system prompt |
| Context compression / rolling history | §5 |
| Prompt-caching decision documented | §5 |
| Error handling & resilience | §7 |
| Tool transparency ("Actions taken") | §8.4 |
| Dynamic suggested prompts | §8.3 |
| Undo visibility | §4.3, §8.5 |
| Tool schema drift → registry | §3, §6 `toolRegistry.js` |
| Observability / trajectory logging | §9 telemetry |
| Cost / usage tracking | §9 |
| Golden-path agent tests | §12 |
| Conversation memory of changes | §4.4 |
| Multi-turn planning & disambiguation | §6.3 |
| Agent-level rate limiting | §9 (session cap) + proxy rate limit |
| Feature flag / gradual rollout | §9 |
| Accessibility | §8.7 |
| Keep agent loop client-side; don't serverise engine | §1 non-goals, §2 |

**Round 2 (minor) review → where addressed:**

| Review item | Addressed in |
|---|---|
| Structured change log + queryable | §4.4 + `get_change_log` tool (§6.1) |
| Reliable partial revert ("revert only spending") | §4.4 (log-backed per-change revert) |
| Summarization quality (verbatim window + strict format) | §5 |
| Soft per-session token budget (warn 50k / stop 100k) | §9 |
| Tool-description drift test | §13 |
| Log anonymized user question + intent | §9 telemetry |
| Confirmation-card diff (old → new) | §4.2, §8.5 |
| "What changed?" expandable audit trail | §8.5 |

---

## 13. Files to create / modify

**Create:** `src/agent/{agentLoop,toolRegistry,toolDefs,toolDispatch,systemPrompt,chatClient,context,telemetry}.js`,
`src/components/panels/ChatDrawer.jsx`, `src/components/panels/ChatMessage.jsx`,
`api/chat.js`, plus tests (below).

**Modify:**
- `src/App.jsx` — own chat open/closed state + `confirmMode`/flag; pass `plan`,
  `inputs`, and an `actions` object (`setInputs`, `onCommitAge`, scenario setters,
  the `leverBaseline`/`appliedLevers`/`undoLevers` snapshot + audit logic) into
  `ChatDrawer`; render in desktop and mobile shells.
- `src/components/mobile/MobileShell.jsx` — mount the drawer as a full-screen sheet.
- `package.json` — add `@anthropic-ai/sdk` **only if** used inside `api/chat.js`
  (the proxy may also just `fetch` the REST endpoint; client never imports it).
- `vite.config.js` / deploy config — wire `/api` for local dev (`vercel dev` or a
  Vite dev proxy).
- `.env` handling — `ANTHROPIC_API_KEY` as a serverless env var; document in
  `CLAUDE.md`. Never referenced in client code.

**Reuse (do not rebuild):** `runAt`/`simParamsAt`/`projectTo` with `overrides`,
`buildPlanSummary`, all `analysis/*` routines, `format.js`, and the
`leverBaseline`/`appliedLevers`/`undoLevers` machinery.

---

## 14. Testing

Consistent with the existing node-env vitest suite — **no live API key in CI**:

- **`toolDispatch` unit tests** (pure): synthetic `tool_use` blocks +
  representative `plan`s → assert correct analysis routine + expected compact
  numbers. Covers every read tool.
- **Write-tool tests:** assert gating (§4.2) — small change applies, large/multi
  change stages for confirmation, budget enforced, baseline snapshotted once,
  audit entries recorded; `update_inputs`/`set_scenario`/`set_retire_age` call the
  injected `actions` correctly.
- **`agentLoop` tests with a mocked transport:** scripted tool_use → tool_result
  → end_turn; assert termination, the ≤8 ceiling, error-path recovery
  (malformed args, engine `null`, stream drop), and that the loop never does
  arithmetic itself.
- **Golden-path regression tests:** a fixture set of common questions ("can I
  retire at 57?", "what's my crash risk?", "lower my taxes") run against a
  scripted model transcript → assert the *tools* invoked and the numbers quoted
  match a real engine run. Guards against tool/desc drift.
- **`context.js` tests:** compaction keeps token count under cap; structured
  recap follows the strict format; change block reflects the §4.4 change log.
- **Tool-description drift test:** assert every `toolRegistry` entry has a
  non-empty description and an `input_schema` whose properties match the handler's
  expected args (e.g. each declared override key is a real `DEFAULTS`/plan field),
  and that every read tool's documented return keys exist on the wrapped analysis
  routine's output for a sample run. Cheap structural guard so NL descriptions and
  schemas can't silently diverge from reality as analysis functions evolve.
- **`get_change_log` / partial-revert tests:** applying two changes then reverting
  one by field leaves the other intact and updates the log status.
- **Proxy contract test:** origin rejection + rate-limit (429) path, mocked
  upstream.
- Keep existing M0 regression invariants A–E green (engine untouched).

## 15. Verification (end-to-end)

1. `npm test` — all unit/golden tests green.
2. `npm run dev` with `vercel dev` (or equivalent) and `ANTHROPIC_API_KEY` set:
   - "Can I retire at 57 instead of 55?" → `run_scenario`, real numbers, "Actions
     taken" shows the call; small change applies with an audit entry.
   - "Lower my spending 20% and switch to a 2008 crash" → 2 changes → confirmation
     card; on confirm, panels update; per-row + "Undo all" revert works.
   - Confirm no number in any reply differs from the panel after the same change.
3. Toggle the feature flag off → drawer disappears, app unaffected.
4. Hit `/api/chat` from a disallowed origin → rejected; exceed rate limit → 429;
   `grep` the built `dist/` to confirm the API key never appears in the bundle.
5. Keyboard-only + screen-reader pass over the drawer (Esc/Enter/tab order, live
   region announces streamed text).
