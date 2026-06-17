// Right column for Retire Early mode. Output priority: earliest-age
// headline → verdict → sensitivity levers → phase breakdown → chart.
import { Card, Label, BigNum } from "../ui.jsx";
import { StackedChart } from "../charts/StackedChart.jsx";
import { fmt, pct } from "../../format.js";

export function EarlyPanel({ plan, result, earliest, sensitivityRows, mcResult }) {
  const { snaps, depleted, bridgeShortfall } = result;
  const survives = depleted === null;
  const onTrack = earliest !== null && earliest <= plan.retireAge;
  const snap59 = snaps.find((s) => s.age === 59) || snaps[0];
  const snapSS = snaps.find((s) => s.age === plan.ssAge) || snaps[0];
  const endVal = snaps[snaps.length - 1]?.total || 0;

  return (
    <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Earliest age */}
      <Card
        accent={onTrack}
        warn={!onTrack && earliest !== null}
        style={{
          border: !onTrack && earliest !== null ? "1.5px solid #f5d9a0" : "none",
          background: !onTrack && earliest !== null ? "#fffbf0" : onTrack ? "#1a2e28" : "#fff3f0",
        }}
      >
        <Label accent={onTrack} warn={!onTrack && earliest === null}>
          Earliest you can retire
        </Label>
        <BigNum accent={onTrack} warn={!onTrack && earliest === null}>
          {earliest !== null ? `Age ${earliest}` : "> Age 75"}
        </BigNum>
        <div style={{ fontSize: 11, marginTop: 4, color: onTrack ? "#7ecfbb" : earliest !== null ? "#c97c1a" : "#c0392b" }}>
          {earliest === null
            ? "Even at 75, money doesn't last — reduce spending or increase savings"
            : onTrack
            ? plan.retireAge - earliest > 0
              ? `✓ ${plan.retireAge - earliest} year${plan.retireAge - earliest > 1 ? "s" : ""} earlier than your target of ${plan.retireAge}`
              : `✓ Right on target — money lasts to age ${plan.lifeExpect}`
            : `Need ${earliest - plan.retireAge} more year${earliest - plan.retireAge > 1 ? "s" : ""}. Adjust a lever below.`}
        </div>
      </Card>

      {/* Verdict */}
      <Card accent={survives} warn={!survives}>
        <Label accent={survives} warn={!survives}>
          {survives ? `✓ Retiring at ${plan.retireAge} works` : `⚠ Retiring at ${plan.retireAge} — runs out`}
        </Label>
        <BigNum accent={survives} warn={!survives}>
          {survives ? `Lasts to age ${plan.lifeExpect}` : `At age ${depleted?.toFixed(1)}`}
        </BigNum>
        <div style={{ fontSize: 11, marginTop: 4, color: survives ? "#7ecfbb" : "#e07060" }}>
          {survives
            ? `Remaining at ${plan.lifeExpect}: ${fmt(endVal)}`
            : earliest
            ? `Retire at ${earliest} instead — see levers below`
            : "Increase savings or reduce spending"}
        </div>
        {survives && bridgeShortfall > 0 && (
          <div style={{ marginTop: 10, background: "#fff8e8", border: "1px solid #f5d9a0", borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#c97c1a", marginBottom: 2 }}>
              ⚠ Bridge gap: {bridgeShortfall} months
            </div>
            <div style={{ fontSize: 10, color: "#a06010", lineHeight: 1.5 }}>
              Accessible funds short before 59½. Add to munis or brokerage, or use the Roth conversion ladder.
            </div>
          </div>
        )}
      </Card>

      {/* Sensitivity */}
      <Card>
        <Label>What moves your retirement age?</Label>
        <div style={{ fontSize: 11, color: "#9db4ae", marginBottom: 12, lineHeight: 1.5 }}>
          Each row changes one thing and re-runs the full simulation. Green = earlier retirement. All else equal.
        </div>
        {sensitivityRows.map(({ label, newEarliest, delta }) => {
          const noChange = delta === null || delta === 0;
          return (
            <div key={label} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eef2f1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#4a5e58" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {newEarliest && (
                    <span style={{ fontSize: 11, color: "#9db4ae", fontFamily: "'JetBrains Mono',monospace" }}>→ age {newEarliest}</span>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono',monospace",
                      minWidth: 70,
                      textAlign: "right",
                      color: delta > 0 ? "#3d8c78" : noChange ? "#b0c4be" : "#c0392b",
                    }}
                  >
                    {delta > 0 ? `−${delta} yr${delta > 1 ? "s" : ""}` : noChange ? "no change" : `+${Math.abs(delta ?? 0)} yr`}
                  </span>
                </div>
              </div>
              {delta > 0 && (
                <div style={{ background: "#eef2f1", borderRadius: 99, height: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (delta / 10) * 100)}%`, height: "100%", background: "#3d8c78", borderRadius: 99, minWidth: 6 }} />
                </div>
              )}
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: "#b0c4be", lineHeight: 1.5 }}>
          Bar = years gained (max 10). Full simulation — taxes, SS, inflation, draw order.
        </div>
      </Card>

      {/* Phase breakdown */}
      <Card>
        <Label>Phase Breakdown</Label>
        {[
          {
            color: "#f0a500",
            age: `${plan.retireAge}→59½`,
            title: "Bridge",
            balance: snap59,
            desc: `Roth contributions (free) → Munis → Brokerage (${pct(plan.brokerageLtcgRate)} LTCG). 401k locked.${
              plan.annualRothConversion > 0 ? ` Converting ${fmt(plan.annualRothConversion)}/yr → Roth.` : ""
            }`,
          },
          {
            color: "#3d8c78",
            age: `59½→${plan.ssAge}`,
            title: "Early Retirement",
            balance: snapSS,
            desc: `Roth earnings free. 401k at retirement bracket (not ${plan.employmentBracket}%). No SS.`,
          },
          {
            color: "#1a2e28",
            age: `${plan.ssAge}+`,
            title: "Full SS",
            desc: `SS ${fmt(plan.ssBenefit)}/mo${plan.ss2Benefit > 0 ? ` + spouse ${fmt(plan.ss2Benefit)}/mo` : ""} offsets spend. 401k covers the gap.`,
          },
        ].map((ph) => (
          <div key={ph.title} style={{ borderLeft: `3px solid ${ph.color}`, paddingLeft: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ph.color }}>
              {ph.title} <span style={{ fontWeight: 400, color: "#9db4ae" }}>Age {ph.age}</span>
            </div>
            <div style={{ fontSize: 11, color: "#4a5e58", lineHeight: 1.5, marginTop: 2 }}>{ph.desc}</div>
            {ph.balance && (
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#1a2e28", marginTop: 3 }}>
                Portfolio: {fmt(ph.balance.total)}
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Monte Carlo */}
      {mcResult && (
        <Card>
          <Label>Monte Carlo — 500 Scenarios</Label>
          <div style={{ display: "flex", gap: 24, marginBottom: 10 }}>
            <div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono',monospace",
                  color:
                    mcResult.successRate >= 0.9 ? "#3d8c78"
                    : mcResult.successRate >= 0.75 ? "#c97c1a"
                    : "#c0392b",
                }}
              >
                {Math.round(mcResult.successRate * 100)}%
              </div>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>Success rate</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "#1a2e28" }}>
                {fmt(mcResult.medianEndTotal)}
              </div>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>Median estate</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6, marginTop: 4 }}>
            <strong style={{ color: "#4a5e58" }}>What this measures:</strong> each of 500 runs uses the same{" "}
            {pct(plan.stockReturn)} mean return but randomizes the <em>sequence</em> — a crash at 57 vs. 75 has very
            different consequences even with the same lifetime average. The gap between the deterministic verdict above
            and this success rate is your sequence-of-returns risk.
          </div>
          <div style={{ fontSize: 10, color: "#b0c4be", lineHeight: 1.5, marginTop: 6 }}>
            Returns drawn from N({pct(plan.stockReturn)}, σ=12%) per year. Success = money lasts to age {plan.lifeExpect}.
            Higher return assumption → higher success rate by design (the mean shifts, not just the spread).
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <Label>Portfolio Over Time</Label>
        <StackedChart snaps={snaps} ssAge={plan.ssAge} />
      </Card>

      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.7, padding: "0 4px" }}>
        Draw order: Roth contributions → Roth earnings (59½+) → Converted Roth (59½+) → Munis → HSA → Brokerage → 401k
        (59½+) → CD. 401k withdrawals use 2026 {plan.filingStatus.toUpperCase()} brackets on the actual amount drawn.
        Planning model only.
      </div>
    </div>
  );
}
