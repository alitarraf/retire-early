// Right rail for Maximize Portfolio mode.
// TOP: Projected balances at retirement (per account).
// BOTTOM: Marginal value — where should your next $1,000/yr go?
import { fmt, pct } from "../../format.js";

const ROWS = [
  { key: "rothContributions", label: "Roth contributions", color: "#3d8c78", note: "Always tax-free" },
  { key: "rothEarnings",      label: "Roth earnings",      color: "#7ecfbb", note: "Tax-free after 59½" },
  { key: "k401",              label: "401k",                color: "#1a2e28", note: "Taxed at retirement bracket" },
  { key: "hsaBalance",        label: "HSA",                 color: "#5aada0", note: "Tax-free for medical" },
  { key: "muniBonds",         label: "Munis",               color: "#a8d5c8", note: null },
  { key: "brokerage",         label: "Brokerage",           color: "#4a8c7a", note: null },
  { key: "cashDeposit",       label: "CD / cash",           color: "#9db4ae", note: null },
];

export function MaximizeRail({ plan, atRetirement, marginalRows, embedded = false }) {
  const total =
    (atRetirement.rothContributions ?? 0) +
    (atRetirement.rothEarnings ?? 0) +
    (atRetirement.k401 ?? 0) +
    (atRetirement.hsaBalance ?? 0) +
    (atRetirement.muniBonds ?? 0) +
    (atRetirement.brokerage ?? 0) +
    (atRetirement.cashDeposit ?? 0);

  const maxGain = Math.max(...marginalRows.map((m) => m.gain), 1);

  return (
    <div
      style={{
        background: "#fafcfc",
        height: embedded ? "auto" : "100%",
        overflowY: embedded ? "visible" : "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Projected balances TOP ───────────────────── */}
      <div style={{ padding: "16px", borderBottom: "1px solid #e2e8e6" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#7C9A92",
            marginBottom: 12,
          }}
        >
          Projected at retirement — age {plan.retireAge}
        </div>

        {ROWS.map(({ key, label, color, note }) => {
          const val = key === "hsaBalance" ? (atRetirement.hsaBalance ?? 0) : (atRetirement[key] ?? 0);
          const dynamicNote =
            key === "muniBonds"
              ? `${pct(plan.muniReturn)} yield`
              : key === "brokerage"
              ? `LTCG ${pct(plan.brokerageLtcgRate)}`
              : key === "cashDeposit"
              ? `After-tax ${pct(plan.depositAfterTaxRate)}`
              : note;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "6px 0",
                borderBottom: "1px solid #e2e8e6",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 99,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#4a5e58" }}>{label}</span>
                </div>
                {dynamicNote && (
                  <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 1, paddingLeft: 12 }}>
                    {dynamicNote}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: "#1a2e28",
                  fontSize: 11,
                }}
              >
                {fmt(val)}
              </span>
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 0 0",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span>Total</span>
          <span
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3d8c78" }}
          >
            {fmt(total)}
          </span>
        </div>
      </div>

      {/* ── Marginal value BOTTOM ────────────────────── */}
      <div style={{ padding: "16px", flex: 1 }}>
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
          Where should your next $1,000/yr go?
        </div>
        <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 14, lineHeight: 1.5 }}>
          Extra estate value at death from adding $1k/yr to each account — after taxes, growth, and
          drawdown.
        </div>

        {marginalRows.map(({ label, gain }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: "#4a5e58" }}>{label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#3d8c78",
                }}
              >
                +{fmt(Math.round(gain))}
              </span>
            </div>
            <div
              style={{
                background: "#e2e8e6",
                borderRadius: 99,
                height: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(gain / maxGain) * 100}%`,
                  height: "100%",
                  background: "#3d8c78",
                  borderRadius: 99,
                  minWidth: gain > 0 ? 4 : 0,
                }}
              />
            </div>
          </div>
        ))}

        <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.5, marginTop: 4 }}>
          Gain = additional estate at age {plan.lifeExpect}. Full simulation per account.
        </div>
      </div>
    </div>
  );
}
