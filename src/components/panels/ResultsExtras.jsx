// Shared results widgets used by both EarlyPanel and MaximizeCenter:
//  • TaxTransparency — surfaces the new SS provisional-income / marginal-rate modeling.
//  • LegacyGap       — projected estate vs the user's legacy target.
//  • StressCard      — illustrative early-crash downside (sequence-of-returns risk).
import { fmt } from "../../format.js";
import { TAX_YEAR } from "../../constants/brackets.js";

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

export function TaxTransparency({ plan, result }) {
  const ts = result.taxSummary ?? {};
  const ssPct = ts.ssTaxableFrac != null ? Math.round(ts.ssTaxableFrac * 100) : null;
  const k401 = ts.k401EffRate != null ? ts.k401EffRate * 100 : null;
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Tax transparency</div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 10 }}>
        <Stat label="SS taxable (first SS yr)" value={ssPct != null ? `${ssPct}%` : "—"} />
        <Stat label="401k effective rate" value={k401 != null ? `${k401.toFixed(1)}%` : "—"} />
        <Stat label="Filing status" value={plan.filingStatus.toUpperCase()} />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>
        Tax model: provisional-income Social Security taxation (up to 85% taxable) + marginal-rate
        traditional withdrawals on {TAX_YEAR} brackets.{" "}
        {plan.assumeStepUpBasis
          ? "Step-up in basis applied — heirs inherit brokerage with unrealized gains erased."
          : "No step-up — embedded brokerage gains are taxed at death in the estate value."}
      </div>
    </div>
  );
}

export function LegacyGap({ plan, endVal }) {
  if (!(plan.legacyTarget > 0)) return null;
  const yrs = plan.lifeExpect - plan.currentAge;
  const targetNominal = plan.legacyTarget * Math.pow(1 + plan.inflationRate / 100, yrs);
  const gap = endVal - targetNominal;
  const ok = gap >= 0;
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Legacy target</div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat label={`Projected estate at ${plan.lifeExpect}`} value={fmt(endVal)} />
        <Stat label={`Target (inflated to ${plan.lifeExpect})`} value={fmt(targetNominal)} />
        <Stat label={ok ? "Surplus" : "Shortfall"} value={`${ok ? "+" : "−"}${fmt(Math.abs(gap))}`} color={ok ? "#3d8c78" : "#c0392b"} />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>
        Your {fmt(plan.legacyTarget)} target (today's $) inflates to {fmt(targetNominal)} by age{" "}
        {plan.lifeExpect}. {ok ? "Your plan clears it." : "Reduce spending or save more to close the gap."}
      </div>
    </div>
  );
}

export function StressCard({ stressResult, plan }) {
  if (!stressResult) return null;
  const { snaps, depleted, estateGainTax = 0 } = stressResult;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;
  const survives = depleted === null;
  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${survives ? "#c97c1a" : "#c0392b"}` }}>
      <div style={labelStyle}>
        Stress test — {plan.stressDropPct}% crash × {plan.stressYears} early year{plan.stressYears > 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat
          label="Outcome"
          value={survives ? "Survives" : `Depletes ${depleted}`}
          color={survives ? "#3d8c78" : "#c0392b"}
        />
        <Stat label={`Estate at ${plan.lifeExpect}`} value={fmt(endVal)} color={survives ? "#1a2e28" : "#c0392b"} />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>
        Illustrative downside: the market drops {plan.stressDropPct}% per year for the first{" "}
        {plan.stressYears} retirement year{plan.stressYears > 1 ? "s" : ""}, then reverts to your{" "}
        mean return. Retiring into a crash is the worst case for sequence-of-returns risk.
      </div>
    </div>
  );
}
