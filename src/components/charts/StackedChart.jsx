// Stacked portfolio-over-time chart with phase-shaded background.
// When `stressSnaps` is supplied (Scenario Testing in Stress mode), a red
// total-portfolio line for the stress scenario is overlaid on the bars.
export function StackedChart({ snaps, ssAge, stressSnaps = null }) {
  if (!snaps.length) return null;
  const hasStress = Array.isArray(stressSnaps) && stressSnaps.length > 0;
  const maxVal = Math.max(
    ...snaps.map((s) => s.total),
    ...(hasStress ? stressSnaps.map((s) => s.total) : []),
    1,
  );
  const W = 460;
  const H = 160;
  const YPAD = 36;
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
          const y = H - (v / maxVal) * H;
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
        {snaps.map((s, i) => {
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
            const h = (val / maxVal) * H;
            yOff += h;
            return (
              <rect key={key} x={x} y={H - yOff} width={barW} height={h} fill={colors[key]} opacity={0.88} />
            );
          });
        })}
        {hasStress && (() => {
          const pts = stressSnaps
            .map((s, i) => {
              const x = YPAD + i * (barW + 1) + barW / 2;
              const y = H - (Math.max(0, s.total) / maxVal) * H;
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
          const i59 = snaps.findIndex((s) => s.age >= 60);
          const iSS = snaps.findIndex((s) => s.age >= ssAge);
          return (
            <>
              <text x={YPAD + 2} y={11} fontSize={8} fill="#c97c1a" fontWeight="700">
                Bridge
              </text>
              {i59 >= 0 && (
                <text x={YPAD + i59 * (barW + 1) + 2} y={11} fontSize={8} fill="#3d8c78" fontWeight="700">
                  Early
                </text>
              )}
              {iSS >= 0 && (
                <text x={YPAD + iSS * (barW + 1) + 2} y={11} fontSize={8} fill="#1a2e28" fontWeight="700">
                  SS+
                </text>
              )}
            </>
          );
        })()}
        {[
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
