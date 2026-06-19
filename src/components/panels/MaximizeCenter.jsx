// Center column for Maximize Portfolio mode.
// Hero: portfolio at retirement (big number) → KPI chips → optimal
// Roth conversion card → portfolio chart.
import { useState, useEffect } from "react";
import { PortfolioChartCard } from "./PortfolioChartCard.jsx";
import { TaxTransparency, LegacyGap, ScenarioCard } from "./ResultsExtras.jsx";
import { MonteCarloCard } from "./MonteCarloCard.jsx";
import { DetailsToggle } from "../ui.jsx";
import { fmt, fmtK, pct } from "../../format.js";
import { cardTitleStyle } from "../../theme.js";

function KpiChip({ label, value, accent }) {
  return (
    <div
      style={{
        background: accent ? "#1a2e28" : "#f0f5f4",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: accent ? "#7ecfbb" : "#9db4ae",
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
          color: accent ? "#fff" : "#1a2e28",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function heroFmt(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return fmt(n);
}

export function MaximizeCenter({ plan, result, totalAtRetirement, sustainable, dynamicOpt, onApplyOptimized, scenario, mcResult = null, onRunMc }) {
  const { snaps, estateGainTax = 0 } = result;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;

  // "Show details" pops open when something appears inside it (stress test, legacy
  // target, or switching the chart to Outcome range). Still hand-collapsible.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (plan.scenarioMode !== "deterministic" || plan.legacyTarget > 0) setDetailsOpen(true);
  }, [plan.scenarioMode, plan.legacyTarget, plan.stressDropPct, plan.stressYears, plan.historicalScenario, plan.historicalLens]);

  const opt = dynamicOpt ?? { type: "none", gain: 0, schedule: [] };
  const convBetter = opt.type === "fill" && opt.gain > 0;
  const bracketLabel = `${Math.round(opt.rate * 100)}%`;

  // Plain-language one-liner from figures already on screen.
  const plainSummary =
    `You could safely spend about ${fmtK(Math.round(sustainable))}/mo at ${plan.retireAge} and still leave ${fmt(endVal)} at ${plan.lifeExpect}.` +
    (convBetter ? ` Filling the ${bracketLabel} bracket with Roth conversions adds about ${fmtK(opt.gain)}.` : "");

  return (
    <div
      style={{
        background: "#f0f5f4",
        height: "100%",
        overflowY: "auto",
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
          Portfolio at retirement — age {plan.retireAge}
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#1a2e28",
            letterSpacing: "-0.02em",
          }}
        >
          {heroFmt(totalAtRetirement)}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginTop: 10,
            marginBottom: 22,
            color: "#3d8c78",
          }}
        >
          Monthly need at {plan.retireAge}: {fmt(Math.round(plan.monthlyAtRetirement))}/mo
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "#1a2e28",
            marginBottom: 22,
            paddingLeft: 12,
            borderLeft: "3px solid #7ecfbb",
          }}
        >
          {plainSummary}
        </div>

        {/* KPI chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <KpiChip
            label="Sustainable spend"
            value={`${fmt(Math.round(sustainable))}/mo`}
            accent
          />
          <KpiChip
            label="Roth conversion strategy"
            value={convBetter ? `Fill ${bracketLabel}` : "None"}
          />
          <KpiChip label={`Estate at ${plan.lifeExpect}`} value={fmt(endVal)} />
        </div>
      </div>

      {/* ── Optimal Roth conversion ──────────────────── */}
      <div
        style={{
          margin: "12px 14px 0",
          background: "#fff",
          borderRadius: 14,
          padding: "16px 20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ ...cardTitleStyle, marginBottom: 12 }}>
          Dynamic Roth conversion optimizer
        </div>
        {convBetter ? (
          <div
            style={{
              background: "#f0faf6",
              border: "1px solid #a3d9c7",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#3d8c78", marginBottom: 4 }}>
              RECOMMENDED STRATEGY
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a2e28", lineHeight: 1.25 }}>
              Fill to the top of the {bracketLabel} bracket
            </div>
            <div style={{ fontSize: 12, color: "#5aa88c", marginTop: 2 }}>
              each year through age {opt.endAge}
            </div>

            <div style={{ display: "flex", gap: 28, margin: "12px 0 4px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#3d8c78" }}>
                  +{fmt(Math.round(opt.gain))}
                </div>
                <div style={{ fontSize: 10, color: "#9db4ae" }}>Added estate at {plan.lifeExpect}</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#1a2e28" }}>
                  {fmtK(opt.totalConverted)}
                </div>
                <div style={{ fontSize: 10, color: "#9db4ae" }}>Total converted</div>
              </div>
              {opt.rmdReduction > 0 && (
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#1a2e28" }}>
                    −{fmtK(opt.rmdReduction)}
                  </div>
                  <div style={{ fontSize: 10, color: "#9db4ae" }}>401k at RMD age {opt.rmdAge}</div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: "#5aa88c", marginTop: 4, lineHeight: 1.5 }}>
              Estate with plan: <strong>{fmt(Math.round(opt.estateWith))}</strong> vs no conversions:{" "}
              <strong>{fmt(Math.round(opt.estateBase))}</strong>.
            </div>

            {/* Per-year schedule (nominal future $) */}
            <div style={{ marginTop: 10, borderTop: "1px solid #d6ebe2", paddingTop: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C9A92", marginBottom: 6 }}>
                Recommended schedule <span style={{ fontWeight: 400, textTransform: "none" }}>(nominal $)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {opt.schedule.slice(0, 10).map((c, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #cfe6dc", borderRadius: 6, padding: "3px 7px", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#1a2e28" }}>
                    <span style={{ color: "#9db4ae" }}>{c.age}</span> {fmtK(c.amount)}
                  </div>
                ))}
                {opt.schedule.length > 10 && (
                  <div style={{ fontSize: 10, color: "#9db4ae", alignSelf: "center" }}>+{opt.schedule.length - 10} more</div>
                )}
              </div>
            </div>

            <button
              onClick={() => onApplyOptimized?.(opt)}
              style={{ marginTop: 12, width: "100%", border: "none", borderRadius: 8, cursor: "pointer", background: "#1a2e28", color: "#7ecfbb", fontSize: 12, fontWeight: 700, padding: "9px 0" }}
            >
              Apply these conversions →
            </button>
          </div>
        ) : (
          <div
            style={{
              background: "#f0f5f4",
              borderRadius: 10,
              padding: "14px 16px",
              fontSize: 11,
              color: "#7C9A92",
              lineHeight: 1.5,
            }}
          >
            No multi-year Roth conversion strategy improves the estate in this scenario — your 401k
            withdrawals are already at a low effective rate, there isn't enough cash to pay the
            conversion tax, or the tax cost outweighs the benefit.
          </div>
        )}
      </div>

      {/* ── Chart (Projection ↔ Monte Carlo fan; MC on-demand) ─── */}
      <PortfolioChartCard
        snaps={snaps}
        ssAge={plan.ssAge}
        plan={plan}
        scenarioSnaps={scenario?.result?.snaps}
        scenarioColor={scenario?.color}
        scenarioLabel={scenario?.label}
        mcResult={mcResult}
        onRunMc={onRunMc}
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

      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.7, padding: "0 14px 14px" }}>
        Sustainable spend = max monthly draw where money lasts to age {plan.lifeExpect} (binary
        search). Conversion optimizer = multi-year "fill to top of bracket" search; conversions are
        funded from cash/brokerage and capped at what you can afford to pay tax on. Planning model only.
      </div>
    </div>
  );
}
