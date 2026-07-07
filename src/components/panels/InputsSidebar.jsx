// Two-tier accordion sidebar shell. Essentials (You · Money · Spending ·
// Assumptions) are always shown; the optimization sections live under a
// collapsed "Fine-tuning (optional)" group. One section open at a time;
// closed sections show a monospace inline summary. A caption + disclaimer
// bar is pinned at the bottom, with the Simple/Expert detail-level toggle.
//
// The section field bodies live in ./inputs/{essentials,finetuning}.jsx and
// the layout atoms in ./inputs/atoms.jsx; this file owns the registry,
// captions, summaries, and the desktop accordion. The mobile shell renders
// the same bodies from INPUT_SECTIONS — one source of truth, two layouts.
import { useState, useEffect, useRef } from "react";
import { AccSection, FineTuningHeader, GroupLabel, ExpertToggle, useExpertMode } from "./inputs/atoms.jsx";
import { YouFields, MoneyFields, SpendingFields, AssumptionsFields } from "./inputs/essentials.jsx";
import {
  TaxesFields, StrategyFields, HealthcareFields, EstateFields,
  LeversFields, AdvancedFields, ScenarioFields,
} from "./inputs/finetuning.jsx";
import { FED_BRACKETS } from "../../constants/brackets.js";
import { HISTORICAL_SCENARIOS } from "../../constants/historicalReturns.js";
import { fmtK } from "../../format.js";

// Caption text per section — pinned at sidebar bottom
const CAPTIONS = {
  you: "Filing status sets your federal tax brackets and standard deduction. Retire age and life expectancy frame the entire projection.",
  money: "Balances compound at the stock return to your retire date. Employer match is added on top. Munis and HSA draw tax-free; brokerage gains are taxed only above cost basis.",
  spending: "Monthly expenses are inflated to your retire date. Social Security adjusts for when you claim vs. your Full Retirement Age — earlier = smaller benefit.",
  assumptions: `Real return = stock − inflation. S&P 500 long-run: ~10% nominal, ~3% CPI, ~7% real. This is the biggest lever on your projections.`,
  tax: "Employment bracket applies only to interest while working. Retirement withdrawals use real brackets on the actual draw — typically far lower than your working rate.",
  strategy: "Roth conversions during the bridge fill low brackets cheaply; converted principal is spendable 5 years later at any age. Rule of 55 unlocks your 401k penalty-free if you left that employer at 55+. Guardrails auto-adjust spending.",
  healthcare: "Enter the ACA benchmark premium only if your monthly expenses don't already include health insurance. Below 400% FPL you pay a sliding share of income; at 65 Medicare replaces ACA.",
  estate: "Step-up in basis erases unrealized brokerage gains for your heirs — leave it on unless you plan to liquidate before death. Expert mode adds the survivor (widow's-tax) scenario.",
  levers: "Each lever applies one change to your inputs — more savings, lower spending, a later SS claim — and reports how many years it shaves off your earliest retirement age, all else equal. Apply writes it in; Undo all reverts.",
  advanced: "Birth year sets your exact RMD start age (73 vs 75) and Full Retirement Age. One-time entries are lump costs (negative = windfall). Phase multipliers model the go-go / slow-go / no-go spending curve.",
  scenario: "Stress Test replays a sharp early-retirement crash (sequence-of-returns risk) as an illustrative downside, separate from the headline verdict. Monte Carlo (Retire Early tab) averages 500 random paths.",
};

const ESSENTIAL_KEYS = ["you", "money", "spending", "assumptions"];
const FINE_TUNING_KEYS = ["tax", "strategy", "healthcare", "estate", "levers", "advanced", "scenario"];
const FILING_SHORT = { single: "Single", mfj: "MFJ", hoh: "HOH" };

// Section registry — { title, Body }. The desktop accordion and the mobile
// single-section view both render from this, so fields live in one place.
const INPUT_SECTIONS = {
  you: { title: "You", Body: YouFields },
  money: { title: "Money", Body: MoneyFields },
  spending: { title: "Spending", Body: SpendingFields },
  assumptions: { title: "Assumptions", Body: AssumptionsFields },
  tax: { title: "Taxes", Body: TaxesFields },
  strategy: { title: "Strategy", Body: StrategyFields },
  healthcare: { title: "Healthcare", Body: HealthcareFields },
  estate: { title: "Estate", Body: EstateFields },
  levers: { title: "Levers", Body: LeversFields },
  advanced: { title: "Advanced", Body: AdvancedFields },
  scenario: { title: "Scenario", Body: ScenarioFields },
};

export { INPUT_SECTIONS, ESSENTIAL_KEYS, FINE_TUNING_KEYS, CAPTIONS };

// Per-section summary string for the closed accordion rows (desktop) and the
// mobile bottom-nav blurbs. Depends on derived plan values, so it's a function.
export function sectionSummary(key, inputs, plan) {
  switch (key) {
    case "you":
      return plan.alreadyRetired
        ? `${FILING_SHORT[inputs.filingStatus]} · retired at ${inputs.currentAge}`
        : `${FILING_SHORT[inputs.filingStatus]} · age ${inputs.currentAge} · retire ${plan.retireAge}`;
    case "money": {
      const totalSaved =
        inputs.k401Today + inputs.rothTotal + inputs.cashDeposit + inputs.muniBonds +
        inputs.existingBrokerage + (inputs.hsaBalance ?? 0);
      const acctCount = [inputs.k401Today, inputs.rothTotal, inputs.cashDeposit, inputs.muniBonds, inputs.existingBrokerage, inputs.hsaBalance]
        .filter((v) => v > 0).length;
      return `${fmtK(totalSaved)} · ${acctCount} account${acctCount === 1 ? "" : "s"}`;
    }
    case "spending": {
      const streams = (inputs.incomeStreams?.length ?? 0) + (inputs.expenseStreams?.length ?? 0);
      return `${fmtK(inputs.monthlyExpense)}/mo · SS ${fmtK(plan.ssBenefit)}@${inputs.ssAge}${streams > 0 ? ` · ${streams} stream${streams === 1 ? "" : "s"}` : ""}`;
    }
    case "assumptions":
      return `Stock ${inputs.stockReturn}% · CPI ${inputs.inflationRate}% · CD ${inputs.cashDepositRate}%`;
    case "tax":
      return `${inputs.employmentBracket}% / LTCG ${inputs.autoLtcg ? "auto" : `${inputs.ltcgBracket}%`} / state ${plan.effectiveStateTax > 0 ? plan.effectiveStateTax + "%" : "none"}`;
    case "strategy":
      return `Roth ${
        inputs.conversionCeiling > 0
          ? `fill ${Math.round((FED_BRACKETS[inputs.filingStatus]?.find((b) => b.upTo === inputs.conversionCeiling)?.rate ?? 0) * 100)}%`
          : `${fmtK(inputs.annualRothConversion)}/yr`
      } · R55 ${inputs.rule55 ? "on" : "off"} · SEPP ${fmtK(inputs.annualSepp)}/yr · GK ${inputs.guardrailUpper > 0 ? "on" : "off"}`;
    case "healthcare":
      return `ACA ${fmtK(inputs.monthlyAcaFullPremium)}/mo · Medicare ${inputs.autoMedicare ? "auto" : `${fmtK(inputs.monthlyIrmaaSurcharge)}/mo`}`;
    case "estate":
      return `Step-up ${inputs.assumeStepUpBasis ? "on" : "off"} · target ${inputs.legacyTarget > 0 ? fmtK(inputs.legacyTarget) : "none"}${inputs.survivorAge > 0 ? ` · survivor@${inputs.survivorAge}` : ""}`;
    case "levers":
      return "what moves your date";
    case "advanced":
      return `b.${plan.birthYear} · ${inputs.oneTimeExpenses?.length ?? 0} lump · phase ${inputs.goGoMult}/${inputs.slowGoMult}/${inputs.noGoMult}`;
    case "scenario":
      return inputs.scenarioMode === "stress"
        ? `Stress −${inputs.stressDropPct}% × ${inputs.stressYears}y`
        : inputs.scenarioMode === "historical"
        ? `Historical: ${HISTORICAL_SCENARIOS.find((s) => s.key === inputs.historicalScenario)?.startYear ?? ""} · ${inputs.historicalLens === "sp" ? "S&P 500" : "60/40"}`
        : "Deterministic";
    default:
      return "";
  }
}

// ─── Main export (desktop accordion) ─────────────────────────

export function InputsSidebar({ inputs, set, plan, levers = {}, defaultFineTuningOpen = false, defaultOpenSection = "you" }) {
  const [open, setOpen] = useState(defaultOpenSection);
  const [ftOpen, setFtOpen] = useState(defaultFineTuningOpen);

  // Switching to Expert reveals fields buried in the (collapsed) Fine-tuning
  // group, so pop it open on that transition for a visible cue. Only fires on
  // the simple→expert edge — the user can still close it again while in Expert.
  const expert = useExpertMode();
  const prevExpert = useRef(expert);
  useEffect(() => {
    if (expert && !prevExpert.current) setFtOpen(true);
    prevExpert.current = expert;
  }, [expert]);
  // Owned here (not inside TaxesFields) so the 401k-withdrawal preview persists
  // across opening/closing sections — TaxesFields only mounts while Taxes is open.
  const [previewWithdrawal, setPreviewWithdrawal] = useState(50000);

  const toggle = (key) => setOpen((prev) => (prev === key ? null : key));
  const captionVisible = open && (ftOpen || ESSENTIAL_KEYS.includes(open));
  const caption = captionVisible ? CAPTIONS[open] : "Select a section to edit inputs. Closed sections show current values at a glance.";

  const appliedCount = levers.appliedLevers?.length ?? 0;

  const renderSection = (key) => {
    const { title, Body } = INPUT_SECTIONS[key];
    const extra =
      key === "tax" ? { previewWithdrawal, setPreviewWithdrawal } : key === "levers" ? levers : {};
    const summary =
      key === "levers" && appliedCount > 0 ? `${appliedCount} applied` : sectionSummary(key, inputs, plan);
    return (
      <AccSection
        title={title}
        summary={summary}
        isOpen={open === key}
        onToggle={() => toggle(key)}
      >
        <Body inputs={inputs} set={set} plan={plan} {...extra} />
      </AccSection>
    );
  };

  return (
    <div style={{ background: "#fafcfc", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Scrollable accordion list */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        <GroupLabel>Essentials</GroupLabel>
        {ESSENTIAL_KEYS.map((key) => <div key={key}>{renderSection(key)}</div>)}

        {/* ── Fine-tuning (optional) ───────────────────── */}
        <FineTuningHeader isOpen={ftOpen} onToggle={() => setFtOpen((v) => !v)} />
        {ftOpen && FINE_TUNING_KEYS.map((key) => <div key={key}>{renderSection(key)}</div>)}

      </div>

      {/* Detail level + caption + disclaimer pinned at bottom */}
      <div
        style={{
          background: "#f0f5f4",
          borderTop: "1px solid #e2e8e6",
          flexShrink: 0,
        }}
      >
        <ExpertToggle />
        <div style={{ padding: "0 16px 11px" }}>
          <div style={{ fontSize: 11, color: "#7C9A92", lineHeight: 1.55, minHeight: 50 }}>
            {caption}
          </div>
          <div style={{ fontSize: 9, color: "#a9bdb6", marginTop: 8, letterSpacing: "0.02em" }}>
            Educational planning tool — not financial advice.
          </div>
        </div>
      </div>
    </div>
  );
}
