// Center column for Retire Early mode: hero verdict → KPI chips →
// Monte Carlo card → portfolio chart. Phase breakdown and sensitivity
// levers live in RightRail.jsx to the right.
import { StackedChart } from "../charts/StackedChart.jsx";
import { TaxTransparency, LegacyGap, StressCard } from "./ResultsExtras.jsx";
import { fmt, pct } from "../../format.js";

// ─── Module-scope atoms ──────────────────────────────────────

function BridgeWarning({ months }) {
  return (
    <div
      style={{
        background: "#fff8e8",
        border: "1px solid #f5d9a0",
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
        border: warn ? "1px solid #f5c0b0" : "none",
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

// ─── Main export ─────────────────────────────────────────────

export function EarlyPanel({ plan, result, earliest, mcResult, stressResult, totalAtRetirement, sustainable }) {
  const { snaps, depleted, bridgeShortfall, estateGainTax = 0 } = result;
  const survives = depleted === null;
  const onTrack = earliest !== null && earliest <= plan.retireAge;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;

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

  const mcColor =
    !mcResult
      ? "#9db4ae"
      : mcResult.successRate >= 0.9
      ? "#3d8c78"
      : mcResult.successRate >= 0.75
      ? "#c97c1a"
      : "#c0392b";

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
            marginBottom: 22,
            color: heroOk ? "#3d8c78" : heroWarn ? "#c97c1a" : "#c0392b",
          }}
        >
          {heroStatus}
        </div>

        {bridgeShortfall > 0 && <BridgeWarning months={bridgeShortfall} />}

        {/* KPI chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <KpiChip label={`Portfolio at ${plan.retireAge}`} value={fmt(totalAtRetirement)} />
          <KpiChip label="Sustainable spend" value={`${fmt(Math.round(sustainable))}/mo`} accent />
          <KpiChip
            label="MC success (500)"
            value={mcResult ? `${Math.round(mcResult.successRate * 100)}%` : "—"}
          />
          <KpiChip label={`Estate at ${plan.lifeExpect}`} value={fmt(endVal)} warn={!survives} />
        </div>
      </div>

      {/* ── Monte Carlo ──────────────────────────────── */}
      {mcResult && (
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
            Monte Carlo — 500 scenarios
          </div>
          <div style={{ display: "flex", gap: 28, marginBottom: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: mcColor,
                }}
              >
                {Math.round(mcResult.successRate * 100)}%
              </div>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>Success rate</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#1a2e28",
                }}
              >
                {fmt(mcResult.medianEndTotal)}
              </div>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>Median estate</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>
            Each run uses the same {pct(plan.stockReturn)} mean return but randomizes the{" "}
            <em>sequence</em> — a crash at 57 vs 75 has very different consequences even with the
            same lifetime average. The gap between the deterministic verdict above and this rate is
            your sequence-of-returns risk.
          </div>
        </div>
      )}

      {/* ── Stress test / transparency / legacy ──────── */}
      <StressCard stressResult={stressResult} plan={plan} />
      <TaxTransparency plan={plan} result={result} />
      <LegacyGap plan={plan} endVal={endVal} />

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

      {/* Footnote */}
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.7, padding: "0 14px 14px" }}>
        Draw order: Roth contributions → Roth earnings (59½+) → Converted Roth (59½+, 5-yr lock) →
        Munis → HSA → Brokerage → 401k (59½+) → CD. 401k uses 2026{" "}
        {plan.filingStatus.toUpperCase()} brackets on actual draw. Planning model only.
      </div>
    </div>
  );
}
