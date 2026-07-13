// The app's primary lever, a compact command card pinned at the top of the
// left sidebar (under the navbar, above Essentials). A bold "Plan to retire at
// {age}" headline where the age pops when it changes, a warm "years to go"
// sub-line, and a sparkle when you land on your earliest possible age. The
// slider sits beneath, with milestone-age ticks (Rule of 55, 59½, SS, Medicare,
// FRA) that teach as you drag — integer milestones double as click-to-jump
// targets. Drags report via onScrub (cheap live preview), commits via onCommit
// — see App.jsx for the no-lag split.
import { useState } from "react";
import { neutral } from "../../theme.js";

const MILESTONES = [
  { age: 55, name: "Rule of 55 — penalty-free 401k" },
  { age: 59.5, name: "59½ — penalty-free retirement accounts" },
  { age: 62, name: "Earliest Social Security" },
  { age: 65, name: "Medicare eligibility" },
  { age: 67, name: "Full Retirement Age" },
];

const STEP_W = 28;
const STEP_GAP = 8;

export function RetireAtControl({ value, min, max = 80, earliest = null, onScrub, onCommit }) {
  const [dragging, setDragging] = useState(false);
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v)));
  const pct = (age) => ((age - min) / (max - min)) * 100;

  const yearsAway = value - min;
  const freeYear = new Date().getFullYear() + Math.max(0, yearsAway);
  const subline =
    yearsAway <= 0
      ? "your time is now — retire whenever you like"
      : `≈ ${yearsAway} year${yearsAway === 1 ? "" : "s"} away · free in ${freeYear}`;
  const atEarliest = earliest != null && value === earliest;

  const ticks = [];
  if (earliest != null && earliest >= min && earliest <= max) ticks.push({ age: earliest, kind: "earliest" });
  for (const m of MILESTONES) {
    if (m.age >= min && m.age <= max && !ticks.some((t) => t.age === m.age)) {
      ticks.push({ age: m.age, kind: "milestone", clickable: Number.isInteger(m.age), name: m.name });
    }
  }

  // The marks must stay to scale (they sit under a native linear slider, so
  // the thumb lands exactly above its tick), but the labels can't: milestone
  // ages cluster (55·57·59½·62) and their numbers collide. So labels dodge
  // onto a second, lower row — ruler-style short/long stems — whenever the
  // gap to the previous same-row label is too tight to set both numbers.
  const LABEL_MIN_GAP = 8.5; // percent of track ≈ one "59½" label + breathing room
  ticks.sort((a, b) => a.age - b.age);
  const lastAt = [-Infinity, -Infinity]; // last label position per row
  for (const t of ticks) {
    const p = pct(t.age);
    t.row = p - lastAt[0] >= LABEL_MIN_GAP ? 0 : p - lastAt[1] >= LABEL_MIN_GAP ? 1 : 0;
    lastAt[t.row] = p;
  }
  const twoRows = ticks.some((t) => t.row === 1);

  const stepBtn = {
    width: STEP_W,
    height: STEP_W,
    flexShrink: 0,
    border: "1px solid #c4d6d0",
    background: "#fff",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 17,
    fontWeight: 700,
    color: "#1a2e28",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      style={{
        flexShrink: 0,
        background: "linear-gradient(180deg,#ffffff 0%,#f6fbf9 100%)",
        borderBottom: "1px solid #e2e8e6",
        padding: "12px 14px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Headline: Plan to retire at {age} — the age pops on change */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", flexWrap: "wrap", gap: "4px 8px" }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#1a2e28", letterSpacing: "-0.01em" }}>
          Plan to retire at
        </span>
        <span
          key={dragging ? "live" : `v${value}`}
          className="age-pop"
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1,
            display: "inline-block",
            color: neutral.ink,
            animation: "agePop 0.4s cubic-bezier(.2,.8,.3,1.25)",
          }}
        >
          {value}
        </span>
        {atEarliest && (
          <span
            key={`spark-${value}`}
            className="spark-pop"
            style={{
              animation: "sparkPop 0.45s ease-out",
              background: "#eafaf3",
              border: "1px solid #a3d9c7",
              color: "#2a6e56",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              whiteSpace: "nowrap",
            }}
          >
            ✨ earliest
          </span>
        )}
      </div>

      {/* Warm aspirational sub-line */}
      <div style={{ fontSize: 11, color: "#5aa88c", fontWeight: 600, marginTop: 4, marginBottom: 12, letterSpacing: "0.01em", textAlign: "center" }}>
        {subline}
      </div>

      {/* Slider, spanning the full sidebar width */}
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: STEP_GAP }}>
          <button
            type="button"
            aria-label="Retire one year earlier"
            onClick={() => onCommit(clamp(value - 1))}
            disabled={value <= min}
            style={{ ...stepBtn, opacity: value <= min ? 0.4 : 1 }}
          >
            −
          </button>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onPointerDown={() => setDragging(true)}
            onChange={(e) => onScrub(clamp(Number(e.target.value)))}
            onPointerUp={(e) => { setDragging(false); onCommit(clamp(Number(e.target.value))); }}
            onTouchEnd={(e) => { setDragging(false); onCommit(clamp(Number(e.target.value))); }}
            onKeyUp={(e) => onCommit(clamp(Number(e.target.value)))}
            onBlur={(e) => { setDragging(false); onCommit(clamp(Number(e.target.value))); }}
            aria-label="Retire at age"
            className="range"
            style={{ flex: 1, minWidth: 0, "--pct": `${pct(value)}%` }}
          />
          <button
            type="button"
            aria-label="Retire one year later"
            onClick={() => onCommit(clamp(value + 1))}
            disabled={value >= max}
            style={{ ...stepBtn, opacity: value >= max ? 0.4 : 1 }}
          >
            +
          </button>
        </div>

        {/* Milestone ticks — inset to align under the slider track. Marks are
            always to scale; labels on row 1 hang from longer stems. */}
        <div style={{ position: "relative", height: twoRows ? 33 : 20, margin: `6px ${STEP_W + STEP_GAP}px 0` }}>
          {ticks.map((t) => {
            const isEarliest = t.kind === "earliest";
            const active = t.age === value;
            const markColor = isEarliest ? "#3d8c78" : active ? "#1a2e28" : "#9db4ae";
            const labelColor = isEarliest ? "#3d8c78" : active ? "#1a2e28" : "#5aada0";
            const clickable = isEarliest || t.clickable;
            const label = t.age === 59.5 ? "59½" : String(t.age);
            return (
              <div
                key={isEarliest ? "earliest" : t.age}
                style={{ position: "absolute", left: `${pct(t.age)}%`, transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}
                title={isEarliest ? "Earliest age your plan supports" : t.name}
              >
                {isEarliest ? (
                  <>
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        margin: "0 auto",
                        borderLeft: "4px solid transparent",
                        borderRight: "4px solid transparent",
                        borderTop: `6px solid ${markColor}`,
                      }}
                    />
                    <div
                      style={{
                        width: 2,
                        height: t.row === 1 ? 11 : 0,
                        margin: "0 auto 2px",
                        background: markColor,
                        borderRadius: 1,
                      }}
                    />
                  </>
                ) : (
                  <div
                    style={{
                      width: 2,
                      height: t.row === 1 ? 17 : 6,
                      margin: "0 auto 2px",
                      background: markColor,
                      borderRadius: 1,
                    }}
                  />
                )}
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onCommit(clamp(t.age))}
                    aria-label={isEarliest ? `Earliest age ${t.age}` : t.name}
                    style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 10, fontWeight: 700, color: labelColor, padding: 0 }}
                  >
                    {label}
                  </button>
                ) : (
                  <span style={{ fontSize: 9.5, color: labelColor, fontWeight: 600 }}>{label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
