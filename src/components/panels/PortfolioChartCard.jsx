// Shared "Portfolio over time" card used by both result panels (Retire Early
// and Maximize), so the two stay consistent. A toggle switches between the
// stacked-composition Projection and a clean Monte Carlo Outcome-range fan;
// the fan view adds an explanation card. In Maximize, Monte Carlo is on-demand,
// so selecting the fan before it's run shows a Run button (via onRunMc).
//
// All interaction state (zoom window, hidden series, hover) lives here, not in
// StackedChart: toggling Projection↔Range conditionally remounts the chart, so
// keeping state in the card preserves it across that toggle (and across both
// panels, since they share this card).
import { useState } from "react";
import { StackedChart, GEO, colCenterX, STACK_COLORS } from "../charts/StackedChart.jsx";
import { allocationAt, RISK_PROFILES } from "../../engine/allocation.js";
import { Toggle, RangeSlider } from "../ui.jsx";
import { pct, fmt } from "../../format.js";
import { cardTitleStyle } from "../../theme.js";

const cardStyle = {
  margin: "12px 14px",
  background: "#fff",
  borderRadius: 14,
  padding: "16px 20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  flex: 1,
};

const labelStyle = cardTitleStyle;

const SERIES_LABEL = { roth: "Roth", muni: "Munis", hsa: "HSA", brokerage: "Brokerage", k401: "401k", cd: "CD", treasury: "Treasuries", myga: "MYGA" };
const TOOLTIP_ROWS = ["roth", "muni", "hsa", "brokerage", "k401", "cd", "treasury", "myga"];

// ── "Asset mix" lens (Thread 3, PRD_ConnectedCharts_July2026) ──────────────
// Display-only: the engine blends one return for the growth pool, so the lens
// applies the SAME age-based split the numbers already use. Growth accounts
// (401k / Roth / brokerage / HSA) split by allocationAt; munis are bonds,
// CDs are cash. Palette mirrors AllocationCard (stocks dark, at the bottom)
// so the projection and the allocation card read as one system.
const MIX_SERIES = [
  ["stocks", "Stocks"],
  ["bonds", "Bonds"],
  ["cash", "Cash"],
];
const MIX_COLORS = { stocks: "#1a2e28", bonds: "#7ecfbb", cash: "#c8d8d4" };
const MIX_TOOLTIP_ROWS = ["cash", "bonds", "stocks"]; // top of stack first

function toMixSnap(plan, s) {
  const growth = (s.k401 ?? 0) + (s.roth ?? 0) + (s.brokerage ?? 0) + (s.hsa ?? 0);
  const a = allocationAt(plan, s.age);
  return {
    age: s.age,
    total: s.total,
    stocks: growth * a.equity,
    bonds: growth * a.bond + (s.muni ?? 0) + (s.treasury ?? 0) + (s.myga ?? 0),
    cash: growth * a.cash + (s.cd ?? 0),
  };
}

function FanExplainCard({ mcResult, plan, runs }) {
  const successPct = Math.round(mcResult.successRate * 100);
  const color = successPct >= 90 ? "#3d8c78" : successPct >= 75 ? "#c97c1a" : "#c0392b";
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8e6" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color }}>
          {successPct}%
        </span>
        <span style={{ fontSize: 12, color: "#4a5e58" }}>
          of {runs} randomized return sequences last to age {plan.lifeExpect}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#7C9A92", lineHeight: 1.6 }}>
        The shaded band is the 10th–90th percentile of outcomes and the solid line is the median;
        the dashed line is your single deterministic projection. Each run keeps your{" "}
        {pct(plan.stockReturn)} mean return but randomizes the <em>sequence</em> — a crash at{" "}
        {plan.retireAge} vs {plan.lifeExpect} has very different consequences even at the same
        lifetime average. That spread is sequence-of-returns risk. Illustrative, not a guarantee.
      </div>
    </div>
  );
}

// Tooltip card, absolutely positioned over the SVG. Tracks the hovered column
// horizontally (same column math as the chart) and flips left of the cursor
// near the right edge so it never overflows the card.
function HoverTip({ snap, band, isFan, isMix = false, hidden, n, index }) {
  const leftPct = (colCenterX(index, n) / GEO.W) * 100;
  const flip = leftPct > 55;
  const rows = isFan
    ? [
        ["90th pct", band?.p90, "#5b7db1"],
        ["Median", band?.p50, "#3a5a99"],
        ["10th pct", band?.p10, "#5b7db1"],
      ]
    : isMix
      ? MIX_TOOLTIP_ROWS.filter((k) => !hidden.has(k)).map((k) => [
          MIX_SERIES.find(([key]) => key === k)[1],
          snap[k] ?? 0,
          MIX_COLORS[k],
        ])
      : TOOLTIP_ROWS.filter((k) => !hidden.has(k)).map((k) => [SERIES_LABEL[k], snap[k] ?? 0, STACK_COLORS[k]]);
  const total = isFan ? band?.p50 : rows.reduce((s, [, v]) => s + v, 0);

  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        left: `${leftPct}%`,
        transform: flip ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
        background: "#1a2e28",
        color: "#dceee8",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 11,
        lineHeight: 1.5,
        boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
        pointerEvents: "none",
        zIndex: 5,
        minWidth: 120,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#7ecfbb" }}>Age {snap.age}</div>
      {rows.map(([label, val, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "0 0 auto" }} />
          <span style={{ flex: 1 }}>{label}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmt(val)}</span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 5,
          paddingTop: 4,
          borderTop: "1px solid #34514a",
          fontWeight: 700,
        }}
      >
        <span>{isFan ? "Median" : "Total"}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmt(total ?? 0)}</span>
      </div>
    </div>
  );
}

export function PortfolioChartCard({ snaps, ssAge, plan, scenarioSnaps = null, scenarioColor = null, scenarioLabel = null, mcResult = null, onRunMc = null, runs = 500, initialView = "projection", onViewChange = null }) {
  const [chartView, setChartView] = useState(initialView);
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null);
  const [win, setWin] = useState(null); // { lo, hi } age window, or null = all

  const canRange = !!(mcResult || onRunMc);
  // The lens only exists when the glide is modeled; a mix view under the flat
  // stockReturn would contradict the numbers, so the option simply isn't there.
  const canMix = !!plan?.allocationEnabled;
  const showFan = chartView === "range" && canRange;
  const showMix = chartView === "instruments" && canMix && !showFan;
  const selectView = (v) => {
    setChartView(v);
    setHover(null);
    onViewChange?.(v);
  };
  const toggleHidden = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const options = [{ value: "projection", label: "Projection" }];
  if (canMix) options.push({ value: "instruments", label: "Asset mix" });
  if (canRange) options.push({ value: "range", label: "Outcome range" });

  // Zoom: slice the bars and every age-keyed overlay to the same window so they
  // stay aligned. Snaps are yearly and sorted, so a simple age filter suffices.
  const minAge = snaps.length ? snaps[0].age : 0;
  const maxAge = snaps.length ? snaps[snaps.length - 1].age : 0;
  const lo = win ? win.lo : minAge;
  const hi = win ? win.hi : maxAge;
  const inWin = (s) => s.age >= lo && s.age <= hi;
  const vSnaps = win ? snaps.filter(inWin) : snaps;
  const vScenario = scenarioSnaps && win ? scenarioSnaps.filter(inWin) : scenarioSnaps;
  const vBands = mcResult?.bands && win ? mcResult.bands.filter(inWin) : mcResult?.bands;

  // Phase chips → preset windows (clamped to the available age range).
  const clampWin = (a, b) => {
    const l = Math.max(minAge, Math.min(a, maxAge - 1));
    const h = Math.min(maxAge, Math.max(b, l + 1));
    return { lo: l, hi: h };
  };
  const presets = {
    all: null,
    bridge: clampWin(minAge, 59),
    early: clampWin(60, ssAge - 1),
    "ss+": clampWin(ssAge, maxAge),
  };
  const eq = (w) => (w == null ? win == null : win && win.lo === w.lo && win.hi === w.hi);
  const activePreset = Object.keys(presets).find((k) => eq(presets[k])) ?? "";
  const setPreset = (k) => {
    setWin(presets[k]);
    setHover(null);
  };

  const renderControls = (interactive) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#7C9A92", fontFamily: "'JetBrains Mono', monospace", flex: "0 0 auto" }}>
          {lo}–{hi}
        </span>
        <RangeSlider
          min={minAge}
          max={maxAge}
          lo={lo}
          hi={hi}
          onChange={(l, h) => {
            setWin(l === minAge && h === maxAge ? null : { lo: l, hi: h });
            setHover(null);
          }}
        />
      </div>
      {interactive && (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <Toggle
            value={activePreset}
            onChange={setPreset}
            options={[
              { value: "all", label: "All" },
              { value: "bridge", label: "Bridge" },
              { value: "early", label: "Early" },
              { value: "ss+", label: "SS+" },
            ]}
          />
        </div>
      )}
    </div>
  );

  const tipIndex = hover != null && vSnaps[hover] ? hover : null;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={labelStyle}>Portfolio over time</div>
        {(canRange || canMix) && (
          <Toggle
            value={showFan ? "range" : showMix ? "instruments" : "projection"}
            onChange={selectView}
            options={options}
          />
        )}
      </div>

      {showFan && mcResult ? (
        <>
          <div style={{ position: "relative" }}>
            <StackedChart
              snaps={vSnaps}
              ssAge={ssAge}
              mcBands={vBands}
              view="fan"
              hover={hover}
              onHover={setHover}
            />
            {tipIndex != null && (
              <HoverTip snap={vSnaps[tipIndex]} band={vBands?.[tipIndex]} isFan hidden={hidden} n={vSnaps.length} index={tipIndex} />
            )}
          </div>
          {renderControls(true)}
          <FanExplainCard mcResult={mcResult} plan={plan} runs={runs} />
        </>
      ) : showFan && onRunMc ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "28px 0" }}>
          <div style={{ fontSize: 12, color: "#7C9A92", textAlign: "center", maxWidth: 300, lineHeight: 1.5 }}>
            See the range of outcomes across {runs} randomized market sequences.
          </div>
          <button
            onClick={onRunMc}
            style={{ background: "#1a2e28", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Run {runs} Monte Carlo simulations
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: "relative" }}>
            <StackedChart
              snaps={showMix ? vSnaps.map((s) => toMixSnap(plan, s)) : vSnaps}
              ssAge={ssAge}
              series={showMix ? MIX_SERIES : undefined}
              colors={showMix ? MIX_COLORS : undefined}
              scenarioSnaps={vScenario}
              scenarioColor={scenarioColor}
              scenarioLabel={scenarioLabel}
              mcBands={null}
              hidden={hidden}
              onToggleHidden={toggleHidden}
              hover={hover}
              onHover={setHover}
            />
            {tipIndex != null && (
              <HoverTip
                snap={showMix ? toMixSnap(plan, vSnaps[tipIndex]) : vSnaps[tipIndex]}
                isFan={false}
                isMix={showMix}
                hidden={hidden}
                n={vSnaps.length}
                index={tipIndex}
              />
            )}
          </div>
          {renderControls(true)}
          {showMix && (
            <div style={{ fontSize: 11, color: "#7C9A92", lineHeight: 1.5, marginTop: 10 }}>
              What you hold, not where it sits: your 401k, Roth, brokerage and HSA follow{" "}
              {plan.pinAllocation || plan.riskProfile === "custom"
                ? "your fixed custom mix"
                : `the ${RISK_PROFILES[plan.riskProfile]?.label ?? "Moderate"} glide, so the mix shifts as you age`}
              ; munis count as bonds, CDs as cash.
            </div>
          )}
        </>
      )}
    </div>
  );
}
