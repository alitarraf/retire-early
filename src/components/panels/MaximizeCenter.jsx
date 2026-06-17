// Center column for Maximize Portfolio mode.
// Hero: portfolio at retirement (big number) → KPI chips → optimal
// Roth conversion card → portfolio chart.
import { StackedChart } from "../charts/StackedChart.jsx";
import { fmt, pct } from "../../format.js";

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

export function MaximizeCenter({ plan, result, totalAtRetirement, sustainable, optimal }) {
  const { snaps, estateGainTax = 0 } = result;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;
  const convBetter = optimal.amount > 0 && optimal.endVal > optimal.baseEnd;

  return (
    <div
      style={{
        background: "#f0f5f4",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
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

        {/* KPI chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <KpiChip
            label="Sustainable spend"
            value={`${fmt(Math.round(sustainable))}/mo`}
            accent
          />
          <KpiChip
            label="Optimal Roth conversion"
            value={convBetter ? `${fmt(optimal.amount)}/yr` : "None"}
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
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#9db4ae",
            marginBottom: 12,
          }}
        >
          Optimal Roth conversion
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
              RECOMMENDED
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#1a2e28",
              }}
            >
              {fmt(optimal.amount)}/yr
            </div>
            <div style={{ fontSize: 11, color: "#5aa88c", marginTop: 6, lineHeight: 1.5 }}>
              Estate with conversion:{" "}
              <strong>{fmt(Math.round(optimal.endVal))}</strong> vs no conversion:{" "}
              <strong>{fmt(Math.round(optimal.baseEnd))}</strong>
            </div>
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
            No Roth conversion improves the estate in this scenario — 401k withdrawals are already
            at a low effective rate, or the tax cost outweighs the benefit.
          </div>
        )}
      </div>

      {/* ── Chart ────────────────────────────────────── */}
      <div
        style={{
          margin: "12px 14px",
          background: "#fff",
          borderRadius: 14,
          padding: "16px 20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#9db4ae",
            marginBottom: 12,
          }}
        >
          Portfolio over time
        </div>
        <StackedChart snaps={snaps} ssAge={plan.ssAge} />
      </div>

      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.7, padding: "0 14px 14px" }}>
        Sustainable spend = max monthly draw where money lasts to age {plan.lifeExpect} (binary
        search). Optimal conversion = exhaustive $0–$60k search in $5k steps. Planning model only.
      </div>
    </div>
  );
}
