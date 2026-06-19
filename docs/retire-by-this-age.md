Plan: "Retire by a target age" goal-seek (required-savings solver)                                                                                        ↑

 Context                                                                                                                                                   ↑

   The app answers two questions today: "when is the earliest I can retire?" (Retire Early                                                                   ↑
   tab) and "how well / how much can I spend?" (Maximize tab). It does not answer the
   inverse, planning-forward question a younger saver actually asks: "I want to retire at 40 —                                                               ↑
   how much do I need to save now to afford that?"
                                                                                                                                                             ↑
   This adds a goal-seek: the user types a target retirement age, and the app computes the
   extra monthly savings needed to make that age work — plus the alternative lever (trim                                                                     ↑
   target spend). It mirrors the existing sustainableSpend binary-search pattern but solves for
   savings instead of spend.                                                                                                                                 ↑

   Decisions locked with the user:                                                                                                                           ↑
   - Placement: a card inside the Retire Early tab, under the "earliest age" hero — same
   question family, no 5th tab (keeps the simplification just shipped).                                                                                      ↑
   - Output: the required savings number + a target-spend trade-off line ("or trim spend
   to $Z/mo").                                                                                                                                               ↑
   - Savings bucket: taxable brokerage — uncapped (so the answer can be any size) and
   accessible before 59½, which is what a 40-year-old needs to bridge to locked accounts.                                                                    ↑

   Correctness constraint (the whole ballgame): for an early target age the 401k is locked                                                                   ↑
   until 59½, so the success oracle must require depleted === null AND bridgeShortfall === 0
   — NOT survivesAt (which is true even when money is stranded in a locked 401k). Missing this                                                               ↑
   ships confidently wrong advice.
                                                                                                                                                             ↑
   1. Engine lever — add a brokerage contribution override (analysis layer)
                                                                                                                                                             ↑
   src/analysis/plan.js → projectTo: add a brokerageAnnual override alongside the existing
   k401Annual / rothAnnual / muniAdd (used by marginalValue.js). Contributions are                                                                           ↑
   after-tax dollars, so they add to both value and basis:
                                                                                                                                                             ↑
   const brokerageExtra = overrides.brokerageAnnual ?? 0;
   brokerage:      plan.existingBrokerage * (1+r)**yrs + fvAnnuity(brokerageExtra, yrs, plan.stockReturn),                                                   ↑
   brokerageBasis: plan.existingBrokerageBasis + brokerageExtra * yrs,
                                                                                                                                                             ↑
   Additive, defaults 0 → no change to existing results or tests. simParamsAt already spreads
   ...proj, so this is the only plumbing. (This is analysis/, not engine/simulate() —                                                                        ↑
   invariants A–E are untouched.)
                                                                                                                                                             ↑
   2. New analysis routine — src/analysis/retireByAge.js
                                                                                                                                                             ↑
   retireByAge(plan, targetAge) returns everything the card needs:
   - Required savings: binary-search extra brokerageAnnual s ∈ [0, capHi] (capHi ≈ $1M/yr)                                                                   ↑
   for the minimal s where runAt(plan, targetAge, { brokerageAnnual: s }) gives
   depleted === null && bridgeShortfall === 0. Return extraAnnual, extraMonthly (/12,                                                                        ↑
   level nominal like other contributions), and pctSalary (extraAnnual / salary) as a
   reality check.                                                                                                                                            ↑
   - Trade-off (alt lever): binary-search the max today's-$ monthly spend t ∈ [0, monthlyExpense] where runAt(plan, targetAge, { monthlyExpense: t }) passes the same                                                                                                                                                  ↑
   oracle (simParamsAt inflates t to the target date automatically). Return
   altSpendMonthlyToday.                                                                                                                                     ↑
   - Context: portfolioAtTarget (projectTo total at the solution), currentMonthlySavings
   (k401AnnualContrib + rothAnnualContrib + hsaAnnualContrib, /12).                                                                                          ↑
   - Edge flags: runway:false when targetAge <= currentAge (no future saving helps — don't
   search); onTrack:true when reachable at s = 0 (extra = $0); feasible:false when capHi                                                                     ↑
   still fails (show the trade-off and a "also lower target spend" note).
                                                                                                                                                             ↑
   Reuse runAt, simParamsAt, projectTo from plan.js. Do not refactor the existing
   sustainableSpend (its inline params differ; changing it would shift Maximize/Early KPIs and                                                               ↑
   tests) — the trade-off search lives in this module.
                                                                                                                                                             ↑
   3. UI — card in Retire Early
                                                                                                                                                             ↑
   - src/App.jsx: add targetAge useState (analysis-only, not a plan input; default ≈ a
   round age below retireAge), retireBy = useMemo(() => retireByAge(plan, targetAge), [plan, targetAge]), and pass targetAge / setTargetAge / retireBy to EarlyPanel.
   - src/components/panels/EarlyPanel.jsx: new "Retire by a target age" card placed right                                                                    ↑
   after the hero (before Monte Carlo). Contains a NumInput for the target age and a
   plain-language result:                                                                                                                                    ↑
     - on-track → "You're already on track to retire by 40 — no extra saving needed."
     - feasible → "To retire at 40 spending $X/mo, save about $Y/mo more into a taxable                                                                      ↑
   brokerage account (≈N% of salary) — or keep saving as-is and trim retirement spend to
   $Z/mo." Plus a one-line why (brokerage is reachable before 59½).                                                                                          ↑
     - no runway / infeasible → the matching guidance above.
   Style consistent with existing cards (reuse KpiChip-like atoms already in the file).                                                                      ↑
   - src/constants/fieldHelp.js: add a targetRetireAge entry so the field gets the same
   InfoDot tooltip treatment as the rest.                                                                                                                    ↑

 Files                                                                                                                                                     ↑

 Create: src/analysis/retireByAge.js.
   Modify: src/analysis/plan.js (brokerageAnnual override), src/App.jsx (state + memo +
   props), src/components/panels/EarlyPanel.jsx (card), src/constants/fieldHelp.js (tooltip).

   Verification

 - Bridge oracle first (the critical check): a young all-401k plan (e.g. age 30, target 40,
 balances only in k401Today, high spend) must (a) fail at the target age with no extra
 savings — bridgeShortfall > 0 even if depleted === null — and (b) the solver's answer
 must make both depleted === null and bridgeShortfall === 0. Confirm a survival-only
   oracle would return a smaller (wrong) number than the bridge-constrained one.
   - Unit tests (src/__tests__/retireByAge.test.js): on-track → extraMonthly === 0;
rgetAge <= currentAge → runway === false; projectTo with brokerageAnnual raises
lue and basis by the contributed principal; infeasible high-spend young target →
asible === false with a finite altSpendMonthlyToday.
   - Extend src/__tests__/render.test.jsx: EarlyPanel renders the new card (no NaN) for both
 an accumulator and the already-retired persona (targetAge path with 0 runway).
 - npm test (all 163 + new green) and npm run build.
 - Manual npm run dev: in Retire Early, type target age 40 on the default plan → see a
 sensible "$/mo more" and the trade-off line update live.
