// Shared "Portfolio over time" card used by both result panels (Retire Early
// and Maximize), so the two stay consistent. A toggle switches between the
// stacked-composition Projection and a clean Monte Carlo Outcome-range fan;
// the fan view adds an explanation card. In Maximize, Monte Carlo is on-demand,
// so selecting the fan before it's run shows a Run button (via onRunMc).
import { useState } from "react";
import { StackedChart } from "../charts/StackedChart.jsx";
import { Toggle } from "../ui.jsx";
import { pct } from "../../format.js";

const cardStyle = {
  margin: "12px 14px",
  background: "#fff",
  borderRadius: 14,
  padding: "16px 20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  flex: 1,
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#9db4ae",
};

function FanExplainCard({ mcResult, plan, runs }) {
  const successPct = Math.round(mcResult.successRate * 100);
  const color = successPct >= 90 ? "#3d8c78" : successPct >= 75 ? "#c97c1a" : "#c0392b";
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f1" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color }}>
          {successPct}%
        </span>
        <span style={{ fontSize: 12, color: "#4a5e58" }}>
          of {runs} randomized return sequences last to age {plan.lifeExpect}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#7C9A92", lineHeight: 1.6 }}>
        The shaded band is the 10th–90th percentile of outcomes and the solid line is the median;
        the dashed line is your single deterministic projection. Each run keeps your{" "}
        {pct(plan.stockReturn)} mean return but randomizes the <em>sequence</em> — a crash at{" "}
        {plan.retireAge} vs {plan.lifeExpect} has very different consequences even at the same
        lifetime average. That spread is sequence-of-returns risk. Illustrative, not a guarantee.
      </div>
    </div>
  );
}

export function PortfolioChartCard({ snaps, ssAge, plan, stressSnaps = null, mcResult = null, onRunMc = null, runs = 500, initialView = "projection", onViewChange = null }) {
  const [chartView, setChartView] = useState(initialView);
  const canRange = !!(mcResult || onRunMc);
  const showFan = chartView === "range" && canRange;
  const selectView = (v) => {
    setChartView(v);
    onViewChange?.(v);
  };

  const options = [{ value: "projection", label: "Projection" }];
  if (canRange) options.push({ value: "range", label: "Outcome range" });

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={labelStyle}>Portfolio over time</div>
        {canRange && (
          <Toggle value={showFan ? "range" : "projection"} onChange={selectView} options={options} />
        )}
      </div>

      {showFan && mcResult ? (
        <>
          <StackedChart snaps={snaps} ssAge={ssAge} mcBands={mcResult.bands} view="fan" />
          <FanExplainCard mcResult={mcResult} plan={plan} runs={runs} />
        </>
      ) : showFan && onRunMc ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "28px 0" }}>
          <div style={{ fontSize: 12, color: "#7C9A92", textAlign: "center", maxWidth: 300, lineHeight: 1.5 }}>
            See the range of outcomes across {runs} randomized market sequences.
          </div>
          <button
            onClick={onRunMc}
            style={{ background: "#1a2e28", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Run {runs} Monte Carlo simulations
          </button>
        </div>
      ) : (
        <StackedChart snaps={snaps} ssAge={ssAge} stressSnaps={stressSnaps} mcBands={null} />
      )}
    </div>
  );
}
