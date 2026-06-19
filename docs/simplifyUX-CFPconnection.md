   Here is Claude's plan:
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
an: Simplify UX + "$7M retiree" workflow (onboarding, tooltips, CFP connect)

 Context

 The retirement model is feature-complete (pre-retirement planning + in-retirement
 optimization), but the workflow is hard to manage: the sidebar is 11 equal-weight                                                                            accordion sections that put optimization detail (Strategy, Estate, Scenario) next to
 the basics, every field's guidance is static gray text, and the Retire-Early result is a
 long undifferentiated scroll of cards. New users have no on-ramp.

 Separately, the user wants to serve the MarketWatch persona — "62, retired, $7M, doesn't                                                                    want a 0.5–1% AUM advisor but wants periodic fiduciary help." The app already solves
 this case structurally (enter balances → verdict, sustainable spend, Roth optimizer, Monte
 Carlo). The missing piece is the handoff: a way to connect the user to an advice-only /
 flat-fee CFP for confirmation, plus an exportable summary to bring to them.                                                                              
 Decisions locked with the user:
 - Input: two-tier (Essentials / Fine-tuning) + a quick-start mini-form.
 - Output: plain-language summary line + progressive disclosure (secondary cards collapsed).                                                          - CFP: informational CTA + exportable plan summary (client-side, no backend).                                                                             ↓
   - Skip the full advisor-fee-drag analysis (only a single static illustrative line is OK).
   - All inputs get hover-ⓘ tooltips sourced from the existing Docs text, plus a "not                                                                        ↓
   financial advice" disclaimer.
                                                                                                                                                             ↓
   Constraint: keep the sidebar the user likes; reuse existing primitives; never define
   components inside a render body (CLAUDE.md). No engine/analysis math changes → regression                                                                 ↓
 suite must stay green.                                                                                                                                                                                                                                                                                         ↓
 ---                                                                                                                                                  1. Hover tooltips — single source of truth                                                                                                                ↓

   New src/constants/fieldHelp.js — a map { fieldId: { context, typical? } } holding the                                                                     ↓
   per-field guidance. Seed it by extracting the text already written in
   DocsPanel.jsx (lines ~102–152, the <Field name=…> entries) so content lives once.                                                                         ↓
   Keep entries non-prescriptive (ranges/context, e.g. "S&P long-run ≈7% real; lower for
   conservative planning" — not "set 7%").                                                                                                                   ↓

   src/components/ui.jsx — add an InfoDot primitive: a small ⓘ button that shows a                                                                           ↓
   popover on hover and focus (keyboard-accessible), absolute-positioned, dismissible.
   Real top-level component.                                                                                                                                 ↓
                                                                                                                                                      src/components/panels/DocsPanel.jsx — refactor its inline <Field> reference rows to                                                                       ↓
 render from fieldHelp.js (same map), so Docs and tooltips never diverge.                                                                                                                                                                                                                                       ↓
   InputsSidebar.jsx — give the local Field atom an optional help prop that renders
   <InfoDot> beside the AccLabel; pass the matching fieldHelp id on each field.                                                                              ↓

   2. Input restructure — two-tier + quick-start                                                                                                             ↓

   InputsSidebar.jsx:                                                                                                                                        ↓
   - Group the sections under two labels:
     - ESSENTIALS: You (was Profile) · Money · Spending (was Spending & SS) · Assumptions.                                                                   ↓
     - FINE-TUNING (optional): Taxes · Strategy · Healthcare · Estate · Advanced
   · Scenario — wrapped in one collapsible group container, collapsed by default.                                                                            ↓
   - Merge Accounts + Savings → one Money section. Both already use SubTitle
   dividers; concatenate their bodies (Salary/401k/Roth + CD/Munis/Brokerage/HSA) under one                                                                  ↓
   AccSection. New summary line shows total saved + account count.
   - Add a small group-label atom (reuse AccLabel styling) and keep the existing                                                                             ↓
   one-open-at-a-time accordion behavior within both tiers.
                                                                                                                                                             ↓
 New src/components/panels/QuickStart.jsx — first-run mini-form (the chosen preview):                                                                 age · retired ▸/◂ still working (if working, ask retire age) · total saved · monthly spend.                                                               ↓
 "See my plan →" maps to inputs: currentAge, retireAge, monthlyExpense, and puts the                                                                  lump into existingBrokerage as a neutral starting bucket with a prominent note: "Split                                                                    ↓
   your accounts in Money → for accurate taxes." "Skip" dismisses.
   - App.jsx owns a showQuickStart flag (persist dismissal in localStorage so it                                                                             ↓
   doesn't nag returning users); renders <QuickStart> as an overlay above the grid.
                                                                                                                                                             ↓
   3. Output simplification — EarlyPanel (+ mirror MaximizeCenter)
                                                                                                                                                             ↓
 EarlyPanel.jsx:                                                                                                                                      - Add a plain-language summary line in the hero, composed from existing values                                                                            ↓
 (survives, endVal, sustainable vs current spend, mcResult.successRate), e.g.                                                                         "Your $7.0M lasts to 95 with ~$3k/mo of headroom — 94% of Monte Carlo runs succeed."                                                                      ↓
 - Wrap the three secondary cards (StressCard, TaxTransparency, LegacyGap) in the                                                                     existing Collapsible (ui.jsx) titled "Show details", collapsed by default. Keep                                                                           ↓
   hero + KPI chips + MonteCarloCard + chart visible.
                                                                                                                                                             ↓
   MaximizeCenter.jsx — mirror the same plain-summary + collapse-secondary-cards pattern
   for consistency.                                                                                                                                          ↓

   4. CFP connection + exportable summary (the persona handoff)                                                                                              ↓

   App.jsx — add a 4th tab { key: "advice", label: "Get advice" }; render AdvicePanel                                                                        ↓
 full-width (like Docs).                                                                                                                                                                                                                                                                                        ↓
 New src/components/panels/AdvicePanel.jsx:                                                                                                           - Explains the advice-only / flat-fee / hourly fiduciary model vs AUM %, with one                                                                         ↓
 static illustrative line computed from current portfolio (e.g. "A 1% AUM fee on your                                                                 $7.0M ≈ $70k/yr") — lightweight, not the declined fee-drag engine.                                                                                        ↓
 - Links to verified networks: NAPFA (napfa.org — fee-only fiduciary CFP directory),                                                                  XY Planning Network (xyplanningnetwork.com — flat monthly), Garrett Planning                                                                              ↓
   Network (garrettplanningnetwork.com — hourly), Wealthramp (wealthramp.com —
   aggregator across the three).                                                                                                                             ↓
   - "Export my plan summary" button → downloads a formatted markdown/text file (Blob) the
   user brings to a planner; also a "Print / Save PDF" via window.print().                                                                                   ↓
 - Disclaimer: educational tool, not financial advice.                                                                                                                                                                                                                                                          ↓
 New src/analysis/planSummary.js — pure buildPlanSummary(inputs, plan, result, extras)                                                                returning the markdown string (inputs snapshot + key results: earliest age, verdict,                                                                      ↓
 sustainable spend, estate, MC success). Analysis layer — imports nothing higher.                                                                                                                                                                                                                               ↓
 5. Disclaimer                                                                                                                                                                                                                                                                                                  ↓
   Add a one-line "Educational planning tool — not financial advice" in the sidebar bottom
   caption area and atop AdvicePanel. (Full limitations text already exists in DocsPanel.)                                                                   ↓

   ---                                                                                                                                                       ↓
   Files
                                                                                                                                                             ↓
 Create: src/constants/fieldHelp.js, src/components/panels/QuickStart.jsx,                                                                            src/components/panels/AdvicePanel.jsx, src/analysis/planSummary.js.                                                                                       ↓
   Modify: src/components/ui.jsx (InfoDot), src/components/panels/InputsSidebar.jsx
   (two-tier, Money merge, tooltips, disclaimer), src/App.jsx (quick-start + advice tab),                                                                    ↓
 src/components/panels/EarlyPanel.jsx + MaximizeCenter.jsx (summary + collapse),                                                                      src/components/panels/DocsPanel.jsx (source from fieldHelp).                                                                                              ↓
                                                                                                                                                      Verification                                                                                                                                              ↓

   - npm test — regression suite A–E + render tests stay green (no engine/analysis math                                                                      ↓
   changed; planSummary is additive). Add light tests: buildPlanSummary returns the key
   fields; QuickStart/AdvicePanel/InfoDot render without crashing (extend the existing                                                                       ↓
   src/__tests__/render.test.jsx).
   - npm run dev (WSL2 polling already configured) and manually check:                                                                                       ↓
     a. First load shows Quick-start; "See my plan" pre-fills the sidebar and dismisses; reload
   doesn't re-show it.                                                                                                                                       ↓
     b. Sidebar shows Essentials open / Fine-tuning collapsed; Money holds all accounts;
   hovering/focusing a field ⓘ shows context.                                                                                                                ↓
     c. Retire-Early result leads with the plain-language sentence; Tax/Legacy/Stress are
   behind "Show details".                                                                                                                                    ↓
   d. "Get advice" tab: fee line reflects the portfolio, network links open, "Export                                                                  summary" downloads a readable file, disclaimer present.                                                                                                   ↓
 - Load the persona (62, retired, $7M, ~$12k/mo) via Quick-start end-to-end as the acceptance                                                         case.
