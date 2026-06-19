// Monte Carlo results card — the full p10/p50/p90 breakdown. Lives inside the
// "Show details" collapsible of both result panels. Surfaces success
// probability, best/median/worst final-estate range, and a one-sentence
// insight. Returns null when there is no result, so callers can pass through safely.
import { fmt } from "../../format.js";

const cardStyle = {
  margin: "12px 14px 0",
  background: "#fff",
  borderRadius: 14,
  padding: "16px 20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#9db4ae",
  marginBottom: 12,
};

function colorFor(rate) {
  return rate >= 0.9 ? "#3d8c78" : rate >= 0.75 ? "#c97c1a" : "#c0392b";
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: color || "#1a2e28" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae" }}>{label}</div>
    </div>
  );
}

export function MonteCarloCard({ mcResult, plan, runs = 500 }) {
  if (!mcResult) return null;

  const { successRate, depletionRate, p10EndTotal, medianEndTotal, p90EndTotal } = mcResult;
  const successPct = Math.round(successRate * 100);
  const failPct = Math.round((depletionRate ?? 1 - successRate) * 100);
  const accent = colorFor(successRate);

  const insight =
    failPct === 0
      ? `Across ${runs} randomized return sequences your plan never runs out — the median scenario leaves ${fmt(medianEndTotal)} at age ${plan.lifeExpect}.`
      : `In ${failPct}% of ${runs} scenarios you run out before age ${plan.lifeExpect}. The median leaves ${fmt(medianEndTotal)}; the worst 10% leave ${fmt(p10EndTotal)} or less.`;

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Monte Carlo — {runs} scenarios</div>

      <div style={{ display: "flex", gap: 28, marginBottom: 12, flexWrap: "wrap" }}>
        <Stat label="Success rate" value={`${successPct}%`} color={accent} />
        <Stat label="Downside (10th pct)" value={fmt(p10EndTotal)} color={p10EndTotal > 0 ? "#1a2e28" : "#c0392b"} />
        <Stat label="Median estate (50th)" value={fmt(medianEndTotal)} />
        <Stat label="Upside (90th pct)" value={fmt(p90EndTotal)} color="#3d8c78" />
      </div>

      <div style={{ fontSize: 11, color: "#4a5e58", lineHeight: 1.6 }}>{insight}</div>
    </div>
  );
}
