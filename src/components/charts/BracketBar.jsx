// Federal bracket bar: visualizes effective/marginal rate on a
// withdrawal at the chosen filing status.
import { effectiveFedRate, marginalFedRate } from "../../engine/tax.js";
import { STD_DEDUCTION, FED_BRACKETS } from "../../constants/brackets.js";
import { fmt, pct } from "../../format.js";

export function BracketBar({ annual, stateTaxRate, filingStatus }) {
  const stdDed = STD_DEDUCTION[filingStatus] ?? STD_DEDUCTION.mfj;
  const brackets = FED_BRACKETS[filingStatus] ?? FED_BRACKETS.mfj;
  const taxable = Math.max(0, annual - stdDed);
  const effFed = effectiveFedRate(annual, filingStatus);
  const effTotal = Math.min(0.9, effFed + stateTaxRate / 100);
  const marginal = marginalFedRate(annual, filingStatus);
  return (
    <div style={{ background: "#f7faf9", borderRadius: 8, padding: "10px 12px", fontSize: 11 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
        {[
          ["Effective fed", pct(effFed * 100), "#1a2e28"],
          ["+ State = total", pct(effTotal * 100), "#c97c1a"],
          ["Marginal bracket", pct(marginal * 100), "#1a2e28"],
        ].map(([l, v, c]) => (
          <div key={l}>
            <div style={{ fontSize: 10, color: "#7C9A92", marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono',monospace" }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 4 }}>
        Standard deduction ({fmt(stdDed)}) applied. Taxable: {fmt(taxable)}
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", gap: 1 }}>
        {brackets.slice(0, 5).map(({ upTo }, i) => {
          const prev = i === 0 ? 0 : brackets[i - 1].upTo;
          const inB = Math.max(0, Math.min(taxable, upTo) - prev);
          const w = taxable > 0 ? (inB / taxable) * 100 : 0;
          const cols = ["#e8f5f0", "#b8e0d0", "#7ecfbb", "#3d8c78", "#2a6e5a"];
          return w > 0 ? <div key={i} style={{ width: `${w}%`, background: cols[i], minWidth: 2 }} /> : null;
        })}
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 4 }}>← 0% · 10% · 12% · 22% · 24% →</div>
    </div>
  );
}
