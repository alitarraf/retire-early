// Stacked portfolio-over-time chart with phase-shaded background.
// When `stressSnaps` is supplied (Scenario Testing in Stress mode), a red
// total-portfolio line for the stress scenario is overlaid on the bars.
// When `mcBands` is supplied ([{ age, p5, p50, p95 }] from monteCarlo), a
// shaded 5th–95th-percentile fan with a median line is drawn over the bars.
export function StackedChart({ snaps, ssAge, stressSnaps = null, mcBands = null, view = null }) {
  if (!snaps.length) return null;
  // "fan" view shows the Monte Carlo cone alone (no stacked bars, no stress line);
  // the default shows the stacked composition (optionally with an overlaid fan/stress).
  const isFan = view === "fan";
  const hasStress = !isFan && Array.isArray(stressSnaps) && stressSnaps.length > 0;
  const hasBands = Array.isArray(mcBands) && mcBands.length > 0;
  // Scale anchor: the deterministic bars, stress line, and the MC *median* — i.e. the
  // central outcome, not the extreme upper tail. The 90th-percentile band can be wildly
  // higher than the plan (a few lucky sequences compound to many multiples), which would
  // otherwise crush the bars into an unreadable sliver. We let the axis grow toward p90
  // but cap it at 2.5× the central scale; beyond that the band clips at the chart top.
  const baseMax = Math.max(
    ...snaps.map((s) => s.total),
    ...(hasStress ? stressSnaps.map((s) => s.total) : []),
    ...(hasBands ? mcBands.map((b) => b.p50) : []),
    1,
  );
  const p90Max = hasBands ? Math.max(...mcBands.map((b) => b.p90)) : 0;
  const maxVal = hasBands ? Math.min(Math.max(baseMax, p90Max), baseMax * 2.5) : baseMax;
  const bandClipped = hasBands && p90Max > maxVal * 1.01;
  const W = 460;
  const H = 160;
  const YPAD = 36;
  // Reserve a strip at the top for the phase labels so the bars (scaled into
  // plotH, below the strip) never reach them.
  const TOP = 18;
  const plotH = H - TOP;
  const barW = Math.max(2, (W - YPAD) / snaps.length - 1);
  const colors = {
    roth: "#3d8c78",
    muni: "#7ecfbb",
    hsa: "#5aada0",
    brokerage: "#a8d5c8",
    k401: "#1a2e28",
    cd: "#c8d8d4",
  };
  const niceStep = (() => {
    const raw = maxVal / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw / mag) * mag;
  })();
  const ticks = [];
  for (let v = niceStep; v <= maxVal * 1.05; v += niceStep) ticks.push(v);
  const fmtK = (v) =>
    v >= 1e6 ? `$${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1)}M` : `$${(v / 1000).toFixed(0)}k`;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 34}`} style={{ display: "block" }}>
        {ticks.map((v) => {
          const y = H - (v / maxVal) * plotH;
          return (
            <g key={v}>
              <line x1={YPAD} y1={y} x2={W} y2={y} stroke="#e8eeec" strokeWidth={1} />
              <text x={YPAD - 4} y={y + 3} fontSize={8} fill="#9db4ae" textAnchor="end">
                {fmtK(v)}
              </text>
            </g>
          );
        })}
        {snaps.map((s, i) => (
          <rect
            key={`bg${i}`}
            x={YPAD + i * (barW + 1)}
            y={0}
            width={barW}
            height={H}
            fill={s.age < 59 ? "#fffbf0" : s.age < ssAge ? "#f5fbf8" : "#f5f7ff"}
          />
        ))}
        {!isFan && snaps.map((s, i) => {
          const x = YPAD + i * (barW + 1);
          let yOff = 0;
          return [
            ["cd", s.cd],
            ["k401", s.k401],
            ["brokerage", s.brokerage],
            ["hsa", s.hsa ?? 0],
            ["muni", s.muni],
            ["roth", s.roth],
          ].map(([key, val]) => {
            const h = (val / maxVal) * plotH;
            yOff += h;
            return (
              <rect key={key} x={x} y={H - yOff} width={barW} height={h} fill={colors[key]} opacity={0.88} />
            );
          });
        })}
        {isFan && (() => {
          // Faint deterministic total line, so the user can read "my plan vs the cone".
          const xAt = (i) => YPAD + i * (barW + 1) + barW / 2;
          const yAt = (v) => H - (Math.max(0, Math.min(maxVal, v)) / maxVal) * plotH;
          const pts = snaps.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s.total).toFixed(1)}`).join(" ");
          return <polyline points={pts} fill="none" stroke="#9db4ae" strokeWidth={1.2} strokeDasharray="3 3" />;
        })()}
        {hasBands && (() => {
          const xAt = (i) => YPAD + i * (barW + 1) + barW / 2;
          const yAt = (v) => H - (Math.max(0, Math.min(maxVal, v)) / maxVal) * plotH;
          const top = mcBands.map((b, i) => `${xAt(i).toFixed(1)},${yAt(b.p90).toFixed(1)}`);
          const bottom = mcBands
            .map((b, i) => `${xAt(i).toFixed(1)},${yAt(b.p10).toFixed(1)}`)
            .reverse();
          const areaPts = [...top, ...bottom].join(" ");
          const medPts = mcBands
            .map((b, i) => `${xAt(i).toFixed(1)},${yAt(b.p50).toFixed(1)}`)
            .join(" ");
          return (
            <g>
              <polygon points={areaPts} fill="#5b7db1" opacity={0.18} />
              <polyline points={medPts} fill="none" stroke="#3a5a99" strokeWidth={1.6} strokeLinejoin="round" />
              {/* Inline top-right legend only in overlay mode; fan view has a bottom legend. */}
              {!isFan && (
                <>
                  <line x1={W - 196} y1={8} x2={W - 182} y2={8} stroke="#3a5a99" strokeWidth={1.6} />
                  <text x={W - 178} y={11} fontSize={8} fill="#3a5a99" fontWeight="700">
                    MC 10–90%{bandClipped ? " (90th ↑ off-chart)" : ""}
                  </text>
                </>
              )}
              {/* Fan view: compact clip note top-right (legend stays short to avoid overlap). */}
              {isFan && bandClipped && (
                <text x={W - 4} y={11} fontSize={8} fill="#5b7db1" fontWeight="700" textAnchor="end">
                  90th ↑ off-chart
                </text>
              )}
            </g>
          );
        })()}
        {hasStress && (() => {
          const pts = stressSnaps
            .map((s, i) => {
              const x = YPAD + i * (barW + 1) + barW / 2;
              const y = H - (Math.max(0, s.total) / maxVal) * plotH;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          // First snapshot where the stress portfolio is depleted, for an end-marker.
          const depIdx = stressSnaps.findIndex((s) => s.total < 1);
          return (
            <g>
              <polyline points={pts} fill="none" stroke="#c0392b" strokeWidth={1.8} strokeLinejoin="round" />
              {depIdx > 0 && (
                <circle cx={YPAD + depIdx * (barW + 1) + barW / 2} cy={H} r={3} fill="#c0392b" />
              )}
              <line x1={W - 86} y1={8} x2={W - 72} y2={8} stroke="#c0392b" strokeWidth={1.8} />
              <text x={W - 68} y={11} fontSize={8} fill="#c0392b" fontWeight="700">
                Stress test
              </text>
            </g>
          );
        })()}
        {snaps
          .filter((s) => s.age % 5 === 0)
          .map((s) => {
            const idx = snaps.findIndex((ss) => ss.age === s.age);
            return (
              <text
                key={s.age}
                x={YPAD + idx * (barW + 1) + barW / 2}
                y={H + 13}
                fontSize={9}
                fill="#9db4ae"
                textAnchor="middle"
              >
                {s.age}
              </text>
            );
          })}
        {(() => {
          // Phase labels (Bridge / Early / SS+). Only render phases that exist in
          // this snap range, skip any that would collide with the one before it,
          // and back each with a translucent pill so it stays readable over tall bars.
          const xAt = (i) => YPAD + i * (barW + 1) + 2;
          const i60 = snaps.findIndex((s) => s.age >= 60);
          const iSS = snaps.findIndex((s) => s.age >= ssAge);
          const candidates = [];
          if (snaps[0] && snaps[0].age < 60 && snaps[0].age < ssAge)
            candidates.push({ x: YPAD + 2, label: "Bridge", color: "#c97c1a" });
          if (i60 >= 0 && snaps[i60].age < ssAge)
            candidates.push({ x: xAt(i60), label: "Early", color: "#3d8c78" });
          if (iSS >= 0) candidates.push({ x: xAt(iSS), label: "SS+", color: "#1a2e28" });

          const drawn = [];
          let lastRight = -Infinity;
          for (const p of candidates) {
            const w = p.label.length * 4.8 + 6;
            const x = Math.min(p.x, W - w - 1);
            if (x >= lastRight + 4) {
              drawn.push({ x, w, label: p.label, color: p.color });
              lastRight = x + w;
            }
          }
          // Labels sit in the reserved top strip, above the bars — no background needed.
          return drawn.map((p) => (
            <text key={p.label} x={p.x} y={11} fontSize={8} fill={p.color} fontWeight="700">
              {p.label}
            </text>
          ));
        })()}
        {isFan
          ? [
              ["Deterministic", "#9db4ae"],
              ["MC 10–90%", "#5b7db1"],
              ["Median", "#3a5a99"],
            ].map(([label, color], i) => (
              <g key={label} transform={`translate(${YPAD + i * 100},${H + 23})`}>
                <rect width={8} height={8} fill={color} rx={2} />
                <text x={11} y={8} fontSize={9} fill="#7C9A92">
                  {label}
                </text>
              </g>
            ))
          : [
              ["roth", "Roth"],
              ["muni", "Munis"],
              ["hsa", "HSA"],
              ["brokerage", "Brokerage"],
              ["k401", "401k"],
              ["cd", "CD"],
            ].map(([key, label], i) => (
              <g key={key} transform={`translate(${YPAD + i * 70},${H + 23})`}>
                <rect width={8} height={8} fill={colors[key]} rx={2} />
                <text x={11} y={8} fontSize={9} fill="#7C9A92">
                  {label}
                </text>
              </g>
            ))}
      </svg>
    </div>
  );
}
