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

import { allocationAt, blendedReturnAt, RISK_PROFILES, RISK_PROFILE_KEYS, GLIDE_END_AGE } from "../../engine/allocation.js";

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

// ── Signature: the mix at the moments that matter ────────────
// A few labeled stacked columns (Today → at retirement → at the glide
// floor) instead of a continuous band: each answers "how much" with a
// real percentage, the ages answer "when", and the summary line names
// where the de-risking stops. A pinned custom mix collapses to a
// single "Your mix" column. Exported so the onboarding teaching step
// shows the SAME signature the verdict card uses (one visual language
// across the product).
export function MixMilestones({ plan }) {
  const cur = Math.round(plan.currentAge ?? 40);
  const ret = Math.round(plan.retireAge ?? cur);
  const pinned = plan.riskProfile === "custom" || plan.pinAllocation;

  const stops = pinned
    ? [{ age: cur, label: "Your mix" }]
    : [
        { age: cur, label: "Today" },
        { age: ret, label: `Retire · ${ret}` },
        { age: GLIDE_END_AGE, label: `At ${GLIDE_END_AGE}` },
      ].filter((m, i, arr) => i === 0 || m.age > arr[i - 1].age);

  const cols = stops.map((m) => ({ ...m, split: allocationAt(plan, m.age) }));
  const first = cols[0].split;
  const last = cols[cols.length - 1].split;

  const BAR_H = 108;
  const segs = (s) => [
    { key: "cash", frac: s.cash, bg: MUTE, fg: INK, opacity: 0.55 },
    { key: "bond", frac: s.bond, bg: MINT, fg: INK, opacity: 1 },
    { key: "equity", frac: s.equity, bg: GREEN, fg: "#dceee8", opacity: 1 },
  ];

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 18, justifyContent: "flex-start" }}>
        {cols.map((c) => (
          <div key={c.label} style={{ width: 72, textAlign: "center" }}>
            <div style={{ height: BAR_H, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden" }}>
              {segs(c.split).map((g) => (
                <div
                  key={g.key}
                  style={{
                    height: `${g.frac * 100}%`,
                    background: g.bg,
                    opacity: g.opacity,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: g.fg,
                  }}
                >
                  {/* Label only segments tall enough to hold the number. */}
                  {g.frac * BAR_H >= 13 ? pct(g.frac) : ""}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: "#4a5e58", fontWeight: 600, marginTop: 6, whiteSpace: "nowrap" }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#4a5e58", marginTop: 8 }}>
        {pinned ? (
          <>Holds fixed at {pct(first.equity)} stocks — no glide.</>
        ) : first.equity === last.equity ? (
          <>Holds at {pct(first.equity)} stocks — the glide floor from age {GLIDE_END_AGE} on.</>
        ) : (
          <>
            Stocks {pct(first.equity)} → <strong style={{ color: INK }}>{pct(last.equity)}</strong> by age{" "}
            {GLIDE_END_AGE}, then holds.
          </>
        )}
      </div>
    </div>
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

      <MixMilestones plan={plan} />

      {/* Color key + blended return (the columns carry the numbers). */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 14px", fontSize: 11, color: "#4a5e58", marginTop: 10 }}>
        <span><Swatch color={GREEN} />Stocks</span>
        <span><Swatch color={MINT} />Bonds</span>
        <span><Swatch color={MUTE} opacity={0.55} />Cash</span>
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
