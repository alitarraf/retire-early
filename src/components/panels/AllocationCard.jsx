// ─────────────────────────────────────────────────────────────
//  AllocationCard — the asset-allocation dimension woven INTO the
//  verdict (not a separate tab). The central question stays "when
//  can I retire?"; allocation is the lever that answers it.
//
//  Signature: a target-date GLIDE BAND (equity share de-risking with
//  age) + a three-profile comparison of the earliest safe retire age.
//  Empirically enabling a glide lands LATER than the legacy flat
//  return (de-risking is honest), so we never draw a before→after
//  "improvement" arrow — we compare profiles, which stays truthful
//  even when a riskier profile only ties.
//
//  Read-only display; the risk pick calls up to App via onPickRisk so
//  App owns the atomic write (enable + profile + unpin). Shown in all
//  three verdict panels (EarlyPanel / MaximizeCenter / RetiredPanel).
// ─────────────────────────────────────────────────────────────

import { allocationAt, blendedReturnAt, RISK_PROFILES, RISK_PROFILE_KEYS } from "../../engine/allocation.js";

const GREEN = "#1a2e28"; // equity
const MINT = "#7ecfbb"; // bond
const MUTE = "#9db4ae"; // cash
const INK = "#1a2e28";
const FAINT = "#9db4ae";

const cardStyle = {
  margin: "14px 14px 0",
  background: "#fff",
  borderRadius: 14,
  padding: "16px 20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};
const eyebrowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: FAINT,
  marginBottom: 8,
};

const pct = (f) => `${Math.round(f * 100)}%`;

// ── Signature: the glide band ────────────────────────────────
// Stacked area across age: equity (bottom, green) → bond (mint) →
// cash (top, mute). A pinned custom mix renders as flat bands.
// Exported so the onboarding teaching step shows the SAME signature
// the verdict card uses (one visual language across the product).
export function GlideBand({ plan }) {
  const W = 300;
  const H = 60;
  const start = Math.round(plan.currentAge ?? 40);
  const end = Math.max(start + 1, Math.min(Math.round(plan.lifeExpect ?? 90), 95));
  const ages = [];
  for (let a = start; a <= end; a++) ages.push(a);
  const x = (i) => (i / (ages.length - 1)) * W;
  const y = (frac) => H * (1 - frac);

  const splits = ages.map((a) => allocationAt(plan, a));
  // Cumulative upper edges for stacking (equity, equity+bond).
  const eqTop = splits.map((s) => s.equity);
  const bdTop = splits.map((s) => s.equity + s.bond);

  const areaBetween = (lowEdge, highEdge) => {
    // highEdge across left→right, then lowEdge right→left.
    const top = ages.map((_, i) => `${x(i)},${y(highEdge[i])}`);
    const bot = ages.map((_, i) => `${x(ages.length - 1 - i)},${y(lowEdge[ages.length - 1 - i])}`);
    return `${top.join(" ")} ${bot.join(" ")}`;
  };
  const zero = ages.map(() => 0);
  const one = ages.map(() => 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      style={{ display: "block", borderRadius: 8, marginTop: 4 }}
      aria-hidden="true"
    >
      <polygon points={areaBetween(zero, eqTop)} fill={GREEN} />
      <polygon points={areaBetween(eqTop, bdTop)} fill={MINT} />
      <polygon points={areaBetween(bdTop, one)} fill={MUTE} opacity={0.55} />
    </svg>
  );
}

function Swatch({ color, opacity = 1 }) {
  return (
    <span
      style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: color, opacity, marginRight: 5 }}
    />
  );
}

// ── Three-profile earliest-age comparison ────────────────────
function ProfileRows({ plan, earliestByRisk, onPickRisk }) {
  const enabled = plan.allocationEnabled;
  const current = enabled && plan.riskProfile !== "custom" ? plan.riskProfile : null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#4a5e58", marginBottom: 6 }}>When can you retire?</div>
      {RISK_PROFILE_KEYS.map((key) => {
        const age = earliestByRisk?.[key];
        const you = key === current;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPickRisk?.(key)}
            style={{
              display: "flex",
              alignItems: "baseline",
              width: "100%",
              gap: 8,
              padding: "5px 8px",
              margin: "1px 0",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "left",
              background: you ? "#f0f5f4" : "transparent",
              font: "inherit",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: you ? 700 : 500, color: you ? INK : "#4a5e58", minWidth: 96 }}>
              {RISK_PROFILES[key].label}
            </span>
            <span style={{ flex: 1, borderBottom: "1px dotted #e2e8e6", transform: "translateY(-3px)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: age == null ? FAINT : INK }}>
              {age == null ? "75+" : `age ${age}`}
            </span>
            <span style={{ fontSize: 11, color: "#3d8c78", fontWeight: 600, minWidth: 34 }}>{you ? "← you" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AllocationCard({ plan, earliestByRisk = null, onPickRisk, embedded = false }) {
  const enabled = plan.allocationEnabled;
  const split = allocationAt(plan, plan.currentAge ?? plan.retireAge ?? 40);
  const blended = blendedReturnAt(plan, plan.currentAge ?? plan.retireAge ?? 40);
  const pinned = enabled && (plan.pinAllocation || plan.riskProfile === "custom");
  const con = earliestByRisk?.conservative ?? null;
  const agg = earliestByRisk?.aggressive ?? null;
  const spread = con != null && agg != null ? con - agg : null;
  // Risk unlocks a safe exit the safer profile can't reach by 75.
  const riskUnlocks = earliestByRisk && agg != null && con == null;
  // No profile reaches a safe exit by 75 — savings/spend problem, not risk.
  const allBlocked = earliestByRisk && agg == null;

  return (
    <div style={{ ...cardStyle, ...(embedded ? { margin: "14px 0 0" } : null) }}>
      <div style={eyebrowStyle}>
        <span>Asset allocation</span>
        {pinned ? <span style={{ color: MUTE, letterSpacing: 0 }}>custom mix</span> : null}
      </div>

      {/* Comparison only in planning mode (earliest ages exist); retired mode shows the mix. */}
      {earliestByRisk ? (
        <ProfileRows plan={plan} earliestByRisk={earliestByRisk} onPickRisk={onPickRisk} />
      ) : (
        <div style={{ fontSize: 13, color: "#4a5e58", marginBottom: 10 }}>
          Your mix today: <strong style={{ color: INK }}>{pct(split.equity)} stocks</strong> · {pct(split.bond)} bonds ·{" "}
          {pct(split.cash)} cash.
        </div>
      )}

      <GlideBand plan={plan} />

      {/* Legend + blended return */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 14px", fontSize: 11, color: "#4a5e58", marginTop: 8 }}>
        <span><Swatch color={GREEN} />Stocks {pct(split.equity)}</span>
        <span><Swatch color={MINT} />Bonds {pct(split.bond)}</span>
        <span><Swatch color={MUTE} opacity={0.55} />Cash {pct(split.cash)}</span>
        <span style={{ marginLeft: "auto", color: FAINT }}>
          blended{" "}
          <strong style={{ color: "#3d8c78", fontFamily: "'JetBrains Mono', monospace" }}>{blended.toFixed(1)}%</strong>
        </span>
      </div>

      {/* Caption — honest about direction; handles ties. */}
      <div style={{ fontSize: 11, color: FAINT, marginTop: 10, lineHeight: 1.5 }}>
        {!enabled ? (
          <>Not modeled yet — using a flat {plan.stockReturn}% return. Pick a profile to model a real glide path (stocks that de-risk into bonds as you age).</>
        ) : allBlocked ? (
          <>No mix reaches a safe exit by 75 at this plan — the lever here is more savings or lower spending, not risk. Equity still de-risks with age.</>
        ) : riskUnlocks ? (
          <>A conservative mix can't reach a safe exit by 75 — staying in stocks longer can. That extra return is what makes it possible here.</>
        ) : spread != null && spread > 0 ? (
          <>More stocks buys ~{spread} earlier {spread === 1 ? "year" : "years"} — at the cost of a rougher ride. Your equity share glides down with age.</>
        ) : earliestByRisk ? (
          <>At this plan the profiles land close together — your safe age is driven more by savings than risk. Equity de-risks with age.</>
        ) : (
          <>Your stock share glides down with age, converting growth into stability as you near and enter retirement.</>
        )}
      </div>
    </div>
  );
}
