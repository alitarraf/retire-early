// Center column for Retire Early mode: hero verdict → KPI chips →
// Monte Carlo card → portfolio chart. Phase breakdown and sensitivity
// levers live in RightRail.jsx to the right.
import { useState, useEffect } from "react";
import { PortfolioChartCard } from "./PortfolioChartCard.jsx";
import { TaxTransparency, LegacyGap, ScenarioCard } from "./ResultsExtras.jsx";
import { MonteCarloCard } from "./MonteCarloCard.jsx";
import { DetailsToggle, InfoDot } from "../ui.jsx";
import { FIELD_HELP } from "../../constants/fieldHelp.js";
import { fmt, fmtK } from "../../format.js";

// ─── Module-scope atoms ──────────────────────────────────────

function BridgeWarning({ months }) {
  return (
    <div
      style={{
        background: "#fff8e8",
        borderLeft: "3px solid #f0c987",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#c97c1a", marginBottom: 3 }}>
        ⚠ Bridge gap: {months} months
      </div>
      <div style={{ fontSize: 11, color: "#a06010", lineHeight: 1.5 }}>
        Accessible funds run short before 59½. Add to munis or brokerage, or use the Roth conversion ladder.
      </div>
    </div>
  );
}

function KpiChip({ label, value, accent, warn }) {
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

// Goal-seek card: "to retire at your chosen Retire-at age, how much must I save
// now?" The target age IS the sidebar's Retire at — change it there and this
// card responds, so there's a single source of truth for the retirement age.
function TargetAgeCard({ plan, retireBy }) {
  if (!retireBy) return null;
  const age = plan.retireAge;
  const { runway, onTrack, feasible, extraMonthly, pctSalary, altSpendMonthlyToday } = retireBy;
  const altSpend = Math.round(altSpendMonthlyToday ?? 0);
  const showAlt = altSpend > 0;

  let body;
  if (!runway) {
    body = (
      <div style={{ fontSize: 13, color: "#a06010", lineHeight: 1.6 }}>
        Set <strong>Retire at</strong> above your current age ({plan.currentAge}) to plan ahead —
        saving more now only helps when there's time for it to grow.
      </div>
    );
  } else if (onTrack) {
    body = (
      <div style={{ fontSize: 14, color: "#3d8c78", fontWeight: 600, lineHeight: 1.6 }}>
        ✓ You're on track to retire at {age} with your current savings — no extra needed.
      </div>
    );
  } else if (feasible) {
    body = (
      <div>
        <div style={{ fontSize: 13, color: "#4a5e58", lineHeight: 1.6, marginBottom: 8 }}>
          To retire at <strong>{age}</strong> spending {fmt(plan.monthlyExpense)}/mo (today's $),
          save about
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#1a2e28", lineHeight: 1 }}>
          {fmt(Math.ceil(extraMonthly))}/mo more
        </div>
        <div style={{ fontSize: 12, color: "#9db4ae", marginTop: 4 }}>
          into a taxable brokerage account{pctSalary > 0 ? ` ≈ ${Math.round(pctSalary)}% of salary` : ""} — reachable before 59½, when your 401k is still locked.
        </div>
        {showAlt && (
          <div style={{ fontSize: 13, color: "#4a5e58", lineHeight: 1.6, marginTop: 12, paddingTop: 10, borderTop: "1px solid #e2e8e6" }}>
            Or keep saving as you are and trim retirement spending to <strong>{fmt(altSpend)}/mo</strong> (today's $).
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <div style={{ fontSize: 13, color: "#a06010", lineHeight: 1.6 }}>
        Even very large savings can't make age {age} work at {fmt(plan.monthlyExpense)}/mo.{" "}
        {showAlt
          ? <>To reach it without more savings, retirement spending would need to drop to about <strong>{fmt(altSpend)}/mo</strong> (today's $) — otherwise choose a later Retire at age.</>
          : "Choose a later Retire at age or build up accessible (non-401k) savings first."}
      </div>
    );
  }

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
      <div style={{ display: "flex", alignItems: "center", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9db4ae", marginBottom: 4 }}>
        {`Retire by age ${age}`}
        <InfoDot context={FIELD_HELP.targetRetireAge.context} />
      </div>
      <div style={{ fontSize: 11, color: "#9db4ae", marginBottom: 12 }}>
        Change <strong>Retire at</strong> in the sidebar to explore other ages.
      </div>
      {body}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────

export function EarlyPanel({ plan, result, earliest, mcResult, scenario, totalAtRetirement, sustainable, retireBy, embedded = false }) {
  const { snaps, depleted, bridgeShortfall, estateGainTax = 0 } = result;
  const survives = depleted === null;
  const onTrack = earliest !== null && earliest <= plan.retireAge;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;

  // "Show details" pops open whenever something appears inside it: a stress test,
  // a legacy target, or switching the chart to Outcome range. Still hand-collapsible.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (plan.scenarioMode !== "deterministic" || plan.legacyTarget > 0) setDetailsOpen(true);
  }, [plan.scenarioMode, plan.legacyTarget, plan.stressDropPct, plan.stressYears, plan.historicalScenario, plan.historicalLens]);

  const heroNum = earliest !== null ? String(earliest) : "75+";
  const heroOk = onTrack && survives;
  const heroWarn = !onTrack && earliest !== null;
  const heroColor = earliest === null ? "#c0392b" : onTrack ? "#1a2e28" : "#c97c1a";

  let heroStatus;
  if (earliest === null) {
    heroStatus = "Even at 75, money doesn't last — reduce spending or increase savings";
  } else if (onTrack) {
    const ahead = plan.retireAge - earliest;
    heroStatus =
      ahead > 0
        ? `✓ ${ahead} year${ahead > 1 ? "s" : ""} ahead of your target (${plan.retireAge})`
        : `✓ Right on target — money lasts to age ${plan.lifeExpect}`;
  } else {
    const need = earliest - plan.retireAge;
    heroStatus = `⚠ Need ${need} more year${need > 1 ? "s" : ""} — adjust a lever →`;
  }

  // Plain-language one-liner composed from the figures already on screen.
  const monthlyNeed = Math.round(plan.monthlyAtRetirement);
  const headroom = Math.round(sustainable - monthlyNeed);
  const mcPct = mcResult ? Math.round(mcResult.successRate * 100) : null;
  let plainSummary;
  if (earliest === null) {
    plainSummary = "Even retiring at 75, this plan runs short. Trim spending or save more to make it work.";
  } else if (survives) {
    const hr = headroom > 0
      ? `about ${fmtK(headroom)}/mo of spending headroom`
      : `${fmtK(Math.abs(headroom))}/mo less than the sustainable level`;
    plainSummary = `Your ${fmtK(totalAtRetirement)} lasts to ${plan.lifeExpect} with ${hr}${mcPct != null ? `, and ${mcPct}% of Monte Carlo runs succeed` : ""}.`;
  } else {
    plainSummary = `Retiring at ${plan.retireAge}, the money runs out around age ${Math.ceil(depleted)}. Adjust a lever to close the gap.`;
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
      {/* ── Hero ─────────────────────────────────────── */}
      <div
        style={{
          padding: "28px 24px 22px",
          background: "#fff",
          margin: "14px 14px 0",
          borderRadius: 16,
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#9db4ae",
            marginBottom: 8,
          }}
        >
          Earliest retirement
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
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginTop: 10,
            marginBottom: 12,
            color: heroOk ? "#3d8c78" : heroWarn ? "#c97c1a" : "#c0392b",
          }}
        >
          {heroStatus}
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "#1a2e28",
            marginBottom: 22,
            paddingLeft: 12,
            borderLeft: `3px solid ${heroOk ? "#7ecfbb" : heroWarn ? "#f0c987" : "#e8a99b"}`,
          }}
        >
          {plainSummary}
        </div>

        {bridgeShortfall > 0 && <BridgeWarning months={bridgeShortfall} />}

        {/* KPI chips */}
        <div style={{ display: "grid", gridTemplateColumns: embedded ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
          <KpiChip label={`Portfolio at ${plan.retireAge}`} value={fmt(totalAtRetirement)} />
          <KpiChip label="Sustainable spend" value={`${fmt(Math.round(sustainable))}/mo`} accent />
          <KpiChip
            label="MC success (500)"
            value={mcResult ? `${Math.round(mcResult.successRate * 100)}%` : "—"}
          />
          <KpiChip label={`Estate at ${plan.lifeExpect}`} value={fmt(endVal)} warn={!survives} />
        </div>
      </div>

      {/* ── Retire-by-target-age goal-seek ───────────── */}
      <TargetAgeCard plan={plan} retireBy={retireBy} />

      {/* ── Chart (Projection ↔ Monte Carlo fan) ─────── */}
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

      {/* ── Secondary detail (below the chart; auto-opens) ── */}
      {/* Flat flow: the disclosure is a hairline rule, and the cards below carry
          their own elevation, so they continue the same column as the chart. */}
      <div style={{ margin: "12px 14px 0" }}>
        <DetailsToggle
          open={detailsOpen}
          onToggle={setDetailsOpen}
          caption="Monte Carlo, tax, scenario & legacy"
        />
      </div>
      {detailsOpen && (
        <>
          <MonteCarloCard mcResult={mcResult} plan={plan} runs={500} />
          <ScenarioCard scenario={scenario} plan={plan} />
          <TaxTransparency plan={plan} result={result} />
          <LegacyGap plan={plan} endVal={endVal} />
        </>
      )}
    </div>
  );
}
