// Monte Carlo outcome distribution: a histogram of final-wealth outcomes across
// all simulated return sequences. Depleted/near-zero outcomes pile into the
// leftmost (red) bin; survivors spread across the green bins to the right.
// Vertical markers flag the 10th-percentile (downside), median (p50) and
// 90th-percentile (upside) estates.
import { fmtK } from "../../format.js";

export function McDistChart({ histogram, p10, p50, p90 }) {
  if (!Array.isArray(histogram) || histogram.length === 0) return null;

  const W = 460;
  const H = 130;
  const YPAD = 30;
  const maxCount = Math.max(...histogram.map((b) => b.count), 1);
  const maxVal = histogram[histogram.length - 1].x1 || 1;
  const plotW = W - YPAD;
  const barW = Math.max(2, plotW / histogram.length - 2);

  // x in chart space for a dollar value.
  const xFor = (v) => YPAD + (Math.max(0, Math.min(maxVal, v)) / maxVal) * plotW;

  const countTicks = [];
  const step = Math.ceil(maxCount / 3 / 5) * 5 || 1;
  for (let c = step; c <= maxCount; c += step) countTicks.push(c);

  const markers = [
    { v: p10, color: "#c0392b", label: "10th" },
    { v: p50, color: "#1a2e28", label: "Median" },
    { v: p90, color: "#3d8c78", label: "90th" },
  ].filter((m) => m.v != null);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 30}`} style={{ display: "block" }}>
        {countTicks.map((c) => {
          const y = H - (c / maxCount) * H;
          return (
            <g key={c}>
              <line x1={YPAD} y1={y} x2={W} y2={y} stroke="#e8eeec" strokeWidth={1} />
              <text x={YPAD - 4} y={y + 3} fontSize={8} fill="#9db4ae" textAnchor="end">
                {c}
              </text>
            </g>
          );
        })}

        {histogram.map((b, i) => {
          const h = (b.count / maxCount) * H;
          const x = YPAD + i * (plotW / histogram.length) + 1;
          // Bin 0 holds exactly the depleted ($0) runs → flag in red.
          const isFail = b.depleted === true;
          return (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={barW}
              height={h}
              fill={isFail ? "#c0392b" : "#7ecfbb"}
              opacity={0.88}
            />
          );
        })}

        {markers.map((m) => {
          const x = xFor(m.v);
          return (
            <g key={m.label}>
              <line x1={x} y1={0} x2={x} y2={H} stroke={m.color} strokeWidth={1.2} strokeDasharray="3 2" />
              <text x={x} y={H + 11} fontSize={8} fill={m.color} fontWeight="700" textAnchor="middle">
                {m.label}
              </text>
              <text x={x} y={H + 21} fontSize={8} fill="#9db4ae" textAnchor="middle">
                {fmtK(m.v)}
              </text>
            </g>
          );
        })}

        <text x={YPAD} y={H + 11} fontSize={8} fill="#9db4ae" textAnchor="start">
          $0
        </text>
        <text x={W} y={H + 11} fontSize={8} fill="#9db4ae" textAnchor="end">
          {fmtK(maxVal)}
        </text>
      </svg>
      <div style={{ fontSize: 9, color: "#9db4ae", textAlign: "center", marginTop: 2 }}>
        Final estate at life expectancy — count of scenarios per bucket (red = depleted)
      </div>
    </div>
  );
}
