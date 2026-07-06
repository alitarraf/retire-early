// Center column for users who are ALREADY RETIRED: the earliest-age framing
// of EarlyPanel is meaningless here. Hero = does the money last + spending
// headroom; then "This year's moves" (RMD status, Roth conversion
// recommendation, withdrawal-rate guardrail), then the shared chart and
// detail cards.
import { useState, useEffect } from "react";
import { PortfolioChartCard } from "./PortfolioChartCard.jsx";
import { TaxTransparency, LegacyGap, ScenarioCard, PhaseBreakdownCard } from "./ResultsExtras.jsx";
import { MonteCarloCard } from "./MonteCarloCard.jsx";
import { DetailsToggle } from "../ui.jsx";
import { rmdFactor } from "../../engine/rmd.js";
import { fmt, fmtK } from "../../format.js";

function Chip({ label, value, accent, warn }) {
  return (
    <div
      style={{
        background: accent ? "#1a2e28" : warn ? "#fff3f0" : "#f0f5f4",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: accent ? "#7ecfbb" : warn ? "#c0392b" : "#9db4ae",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: accent ? "#fff" : warn ? "#c0392b" : "#1a2e28",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MoveRow({ title, tone = "info", children }) {
  const colors = { ok: "#3d8c78", warn: "#c97c1a", info: "#4a5e58" };
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid #eef3f2" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors[tone], marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

// This-year action items derived from the plan: RMDs, conversions, guardrail.
function ThisYearCard({ plan, totalToday, dynamicOpt, onApplyOptimized }) {
  const age = plan.currentAge;
  const rmdDue = plan.rmdAge > 0 && age >= plan.rmdAge;
  const k401Now = plan.k401Today ?? 0;
  const estRmd = rmdDue && k401Now > 0 ? k401Now / rmdFactor(Math.floor(age)) : 0;

  const annualSpend = plan.monthlyExpense * 12;
  const wr = totalToday > 0 ? annualSpend / totalToday : 0;
  const guardrailsOn = plan.guardrailUpper > 0 || plan.guardrailLower > 0;
  const wrTone = wr > 0.05 ? "warn" : "ok";

  const showConversion = dynamicOpt && dynamicOpt.gain > 0 && dynamicOpt.ceiling > 0;

  return (
    <div
      style={{
        margin: "14px 14px 0",
        background: "#fff",
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9db4ae", marginBottom: 6 }}>
        This year's moves
      </div>

      <MoveRow title={rmdDue ? `Required Minimum Distribution — due this year` : `RMDs begin at ${plan.rmdAge}`} tone={rmdDue ? "warn" : "info"}>
        {rmdDue ? (
          <>Estimated RMD on your {fmtK(k401Now)} 401k: <strong>{fmt(Math.round(estRmd))}</strong> this year. Withdrawals you already take count toward it.</>
        ) : (
          <>{plan.rmdAge - Math.floor(age)} years away. Roth conversions before then shrink the 401k balance RMDs are computed on.</>
        )}
      </MoveRow>

      {showConversion && (
        <MoveRow title="Roth conversion opportunity" tone="ok">
          Converting up to the <strong>{dynamicOpt.rate}% bracket</strong> (≈{fmtK(dynamicOpt.ceiling)} taxable) through age {dynamicOpt.endAge} adds about <strong>{fmtK(dynamicOpt.gain)}</strong> to your estate.
          {onApplyOptimized && (
            <div style={{ marginTop: 6 }}>
              <button
                onClick={() => onApplyOptimized(dynamicOpt)}
                style={{ border: "none", borderRadius: 8, cursor: "pointer", background: "#1a2e28", color: "#7ecfbb", fontSize: 11, fontWeight: 700, padding: "7px 12px" }}
              >
                Apply these conversions →
              </button>
            </div>
          )}
        </MoveRow>
      )}

      <MoveRow title="Withdrawal rate" tone={wrTone}>
        You're drawing about <strong>{(wr * 100).toFixed(1)}%</strong> of the portfolio per year
        {guardrailsOn
          ? <> — guardrails active at {(plan.guardrailUpper * 100).toFixed(1)}% / {(plan.guardrailLower * 100).toFixed(1)}%.</>
          : wr > 0.05
            ? " — above the classic 4–5% comfort band. Consider guardrails (Fine-tuning → Strategy)."
            : " — inside the classic 4–5% comfort band."}
      </MoveRow>
    </div>
  );
}

export function RetiredPanel({ plan, result, mcResult, scenario, totalAtRetirement, sustainable, dynamicOpt, onApplyOptimized, embedded = false }) {
  const { snaps, depleted, estateGainTax = 0 } = result;
  const survives = depleted === null;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;

  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (plan.scenarioMode !== "deterministic" || plan.legacyTarget > 0) setDetailsOpen(true);
  }, [plan.scenarioMode, plan.legacyTarget, plan.stressDropPct, plan.stressYears, plan.historicalScenario, plan.historicalLens]);

  const monthlyNeed = Math.round(plan.monthlyExpense);
  const headroom = Math.round(sustainable - monthlyNeed);
  const mcPct = mcResult ? Math.round(mcResult.successRate * 100) : null;

  const heroNum = survives ? String(plan.lifeExpect) : String(Math.ceil(depleted));
  const heroColor = survives ? "#1a2e28" : "#c0392b";
  const heroStatus = survives
    ? `✓ Money lasts to your planning horizon (${plan.lifeExpect})`
    : `⚠ Money runs out around age ${Math.ceil(depleted)}`;

  let plainSummary;
  if (survives) {
    const hr = headroom >= 0
      ? `about ${fmtK(headroom)}/mo of spending headroom`
      : `${fmtK(Math.abs(headroom))}/mo above the sustainable level`;
    plainSummary = `Spending ${fmt(monthlyNeed)}/mo, your ${fmtK(totalAtRetirement)} lasts to ${plan.lifeExpect} with ${hr}${mcPct != null ? `, and ${mcPct}% of Monte Carlo runs succeed` : ""}.`;
  } else {
    plainSummary = `At ${fmt(monthlyNeed)}/mo the money runs out around ${Math.ceil(depleted)}. The sustainable level is about ${fmt(Math.round(sustainable))}/mo.`;
  }

  return (
    <div
      style={{
        background: "#f0f5f4",
        height: embedded ? "auto" : "100%",
        overflowY: embedded ? "visible" : "auto",
        display: "flex",
        flexDirection: "column",
        paddingBottom: 40,
      }}
    >
      {/* ── Hero: does the money last? ─────────────────── */}
      <div
        style={{
          padding: "28px 24px 22px",
          background: "#fff",
          margin: "14px 14px 0",
          borderRadius: 16,
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9db4ae", marginBottom: 8 }}>
          {survives ? "Money lasts to" : "Money runs out at"}
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: "'JetBrains Mono', monospace",
            color: heroColor,
            letterSpacing: "-0.02em",
          }}
        >
          {heroNum}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 12, color: survives ? "#3d8c78" : "#c0392b" }}>
          {heroStatus}
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "#1a2e28",
            marginBottom: 22,
            paddingLeft: 12,
            borderLeft: `3px solid ${survives ? "#7ecfbb" : "#e8a99b"}`,
          }}
        >
          {plainSummary}
        </div>

        {/* KPI chips */}
        <div style={{ display: "grid", gridTemplateColumns: embedded ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
          <Chip label="Portfolio today" value={fmt(totalAtRetirement)} />
          <Chip label="Sustainable spend" value={`${fmt(Math.round(sustainable))}/mo`} accent />
          <Chip label="MC success (500)" value={mcPct != null ? `${mcPct}%` : "—"} />
          <Chip label={`Estate at ${plan.lifeExpect}`} value={fmt(endVal)} warn={!survives} />
        </div>
      </div>

      {/* ── This year's moves ──────────────────────────── */}
      <ThisYearCard
        plan={plan}
        totalToday={totalAtRetirement}
        dynamicOpt={dynamicOpt}
        onApplyOptimized={onApplyOptimized}
      />

      {/* ── Chart ──────────────────────────────────────── */}
      <PortfolioChartCard
        snaps={snaps}
        ssAge={plan.ssAge}
        plan={plan}
        scenarioSnaps={scenario?.result?.snaps}
        scenarioColor={scenario?.color}
        scenarioLabel={scenario?.label}
        mcResult={mcResult}
        runs={500}
        onViewChange={(v) => v === "range" && setDetailsOpen(true)}
      />

      {/* ── Secondary detail ───────────────────────────── */}
      <div style={{ margin: "12px 14px 0" }}>
        <DetailsToggle
          open={detailsOpen}
          onToggle={setDetailsOpen}
          caption="Phases, Monte Carlo, tax, scenario & legacy"
        />
      </div>
      {detailsOpen && (
        <>
          <PhaseBreakdownCard plan={plan} result={result} />
          <MonteCarloCard mcResult={mcResult} plan={plan} runs={500} />
          <ScenarioCard scenario={scenario} plan={plan} />
          <TaxTransparency plan={plan} result={result} />
          <LegacyGap plan={plan} endVal={endVal} />
        </>
      )}
    </div>
  );
}
