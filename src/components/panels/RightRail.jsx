// Right rail for Retire Early mode.
// TOP: Phase breakdown (Bridge → Early Retirement → Full SS).
// BOTTOM: Sensitivity levers (what moves your retirement date?).
import { fmt, pct } from "../../format.js";

export function RightRail({ plan, result, sensitivityRows }) {
  const { snaps } = result;
  const snap59 = snaps.find((s) => s.age === 59) || snaps[0];
  const snapSS = snaps.find((s) => s.age === plan.ssAge) || snaps[0];

  const phases = [
    {
      color: "#f0a500",
      title: "Bridge",
      ages: `${plan.retireAge}→59½`,
      desc:
        `Roth contribs free → Munis → Brokerage (${pct(plan.brokerageLtcgRate)} LTCG). 401k locked.` +
        (plan.annualRothConversion > 0 ? ` Converting ${fmt(plan.annualRothConversion)}/yr → Roth.` : ""),
      balance: snap59?.total ?? null,
    },
    {
      color: "#3d8c78",
      title: "Early Retirement",
      ages: `59½→${plan.ssAge}`,
      desc: `Roth earnings free. 401k at retirement bracket — not ${plan.employmentBracket}%. No SS.`,
      balance: snapSS?.total ?? null,
    },
    {
      color: "#1a2e28",
      title: "Full SS",
      ages: `${plan.ssAge}+`,
      desc:
        `SS ${fmt(plan.ssBenefit)}/mo` +
        (plan.ss2Benefit > 0 ? ` + spouse ${fmt(plan.ss2Benefit)}/mo` : "") +
        ` offsets spend. 401k covers the gap.`,
      balance: null,
    },
  ];

  return (
    <div
      style={{
        background: "#fafcfc",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Phases TOP ──────────────────────────────── */}
      <div style={{ padding: "16px 16px", borderBottom: "1px solid #dce8e4" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#7C9A92",
            marginBottom: 14,
          }}
        >
          Phase breakdown
        </div>
        {phases.map((ph) => (
          <div
            key={ph.title}
            style={{ borderLeft: `3px solid ${ph.color}`, paddingLeft: 11, marginBottom: 16 }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: ph.color }}>
              {ph.title}{" "}
              <span style={{ fontWeight: 400, color: "#9db4ae", fontSize: 11 }}>Age {ph.ages}</span>
            </div>
            <div style={{ fontSize: 11, color: "#4a5e58", lineHeight: 1.5, marginTop: 3 }}>
              {ph.desc}
            </div>
            {ph.balance != null && (
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#1a2e28",
                  marginTop: 3,
                  fontWeight: 600,
                }}
              >
                {fmt(ph.balance)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Levers BOTTOM ───────────────────────────── */}
      <div style={{ padding: "16px 16px", flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#7C9A92",
            marginBottom: 6,
          }}
        >
          Try a lever
        </div>
        <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 14, lineHeight: 1.5 }}>
          Each changes one thing and re-runs the full simulation. All else equal.
        </div>

        {sensitivityRows.map(({ label, newEarliest, delta }) => {
          const noChange = delta === null || delta === 0;
          return (
            <div
              key={label}
              style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eef2f1" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 11, color: "#4a5e58" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {newEarliest != null && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#9db4ae",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      → {newEarliest}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      minWidth: 44,
                      textAlign: "right",
                      color: delta > 0 ? "#3d8c78" : noChange ? "#b0c4be" : "#c0392b",
                    }}
                  >
                    {delta > 0
                      ? `−${delta}yr`
                      : noChange
                      ? "—"
                      : `+${Math.abs(delta ?? 0)}yr`}
                  </span>
                </div>
              </div>
              {delta > 0 && (
                <div
                  style={{
                    background: "#eef2f1",
                    borderRadius: 99,
                    height: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (delta / 10) * 100)}%`,
                      height: "100%",
                      background: "#3d8c78",
                      borderRadius: 99,
                      minWidth: 4,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div style={{ fontSize: 10, color: "#b0c4be", lineHeight: 1.5, marginTop: 4 }}>
          Bar = years gained (max 10). Full simulation per row — taxes, SS, inflation, draw order.
        </div>
      </div>
    </div>
  );
}
