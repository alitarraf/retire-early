// Right column for Maximize Portfolio mode. Output priority:
// key numbers → projected balances → marginal $1k value → optimal
// conversion → chart.
import { Card, Label } from "../ui.jsx";
import { StackedChart } from "../charts/StackedChart.jsx";
import { marginalFedRate } from "../../engine/tax.js";
import { fmt, pct } from "../../format.js";

export function MaximizePanel({ plan, result, atRetirement, marginalRows, optimal, sustainable }) {
  const { snaps } = result;
  const totalAtRetirement =
    atRetirement.rothContributions +
    atRetirement.rothEarnings +
    atRetirement.k401 +
    atRetirement.brokerage +
    atRetirement.cashDeposit +
    atRetirement.muniBonds +
    (atRetirement.hsaBalance ?? 0);
  const estateValue = snaps[snaps.length - 1]?.total ?? 0;
  const maxMarginal = Math.max(...marginalRows.map((m) => m.gain), 1);
  const convBetter = optimal.amount > 0 && optimal.endVal > optimal.baseEnd;

  const rows = [
    { label: "Roth contributions", val: atRetirement.rothContributions, color: "#3d8c78", note: `Existing + ${fmt(plan.rothAnnualContrib)}/yr × ${plan.yearsToRetire} yrs — always free` },
    { label: "Roth earnings", val: atRetirement.rothEarnings, color: "#7ecfbb", note: "Tax-free after 59½" },
    { label: "401k", val: atRetirement.k401, color: "#1a2e28", note: `${fmt(plan.total401kAnnual)}/yr → retirement bracket on withdrawal` },
    { label: "HSA", val: atRetirement.hsaBalance ?? 0, color: "#5aada0", note: `${plan.hsaAnnualContrib > 0 ? `${fmt(plan.hsaAnnualContrib)}/yr contributions + ` : ""}grows tax-free, draws tax-free for medical` },
    { label: "Municipal bonds", val: atRetirement.muniBonds, color: "#a8d5c8", note: plan.muniDoubleTaxFree ? `${pct(plan.muniReturn)} yield, 0% tax` : `${pct(plan.muniReturn)} yield, ${pct(plan.effectiveStateTax)} state tax` },
    { label: "Taxable brokerage", val: atRetirement.brokerage, color: "#4a8c7a", note: `Gains taxed at ${pct(plan.brokerageLtcgRate)}` },
    { label: "CD / deposit", val: atRetirement.cashDeposit, color: "#9db4ae", note: `After-tax rate: ${pct(plan.depositAfterTaxRate)}` },
  ];

  return (
    <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Key numbers */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Portfolio at retirement", val: fmt(totalAtRetirement), accent: false },
          { label: "Sustainable monthly spend", val: `${fmt(Math.round(sustainable))}/mo`, accent: true },
          { label: "Estate at death", val: fmt(estateValue), accent: false },
        ].map(({ label, val, accent }) => (
          <div
            key={label}
            style={{ flex: "1 1 140px", background: accent ? "#1a2e28" : "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent ? "#7ecfbb" : "#7C9A92", marginBottom: 5 }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: accent ? "#fff" : "#1a2e28" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Projected balances */}
      <Card>
        <Label>Projected at Retirement — Age {plan.retireAge}</Label>
        <div style={{ fontSize: 11, color: "#9db4ae", marginBottom: 10 }}>
          Monthly need:{" "}
          <strong style={{ color: "#1a2e28", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(plan.monthlyAtRetirement)}/mo</strong>
          <span style={{ color: "#9db4ae" }}>
            {" "}(today's {fmt(plan.monthlyExpense)} × (1+{pct(plan.inflationRate)})^{plan.yearsToRetire})
          </span>
        </div>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #e2e8e6" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: 99, background: r.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#4a5e58" }}>{r.label}</span>
              </div>
              <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 1, paddingLeft: 12 }}>{r.note}</div>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#1a2e28", fontSize: 12 }}>{fmt(r.val)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0 0", fontSize: 13, fontWeight: 700 }}>
          <span>Total</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#3d8c78" }}>{fmt(totalAtRetirement)}</span>
        </div>
      </Card>

      {/* Marginal value */}
      <Card>
        <Label>Where should your next $1,000/yr go?</Label>
        <div style={{ fontSize: 11, color: "#9db4ae", marginBottom: 12, lineHeight: 1.5 }}>
          Extra estate value at death from adding $1,000/yr to each account — accounting for taxes, growth, and drawdown.
        </div>
        {marginalRows.map(({ label, gain }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#4a5e58" }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "#3d8c78" }}>+{fmt(Math.round(gain))}</span>
            </div>
            <div style={{ background: "#e2e8e6", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{ width: `${(gain / maxMarginal) * 100}%`, height: "100%", background: "#3d8c78", borderRadius: 99, minWidth: gain > 0 ? 4 : 0 }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 4 }}>
          Gain shown as additional estate value at age {plan.lifeExpect}. Uses full simulation per account.
        </div>
      </Card>

      {/* Optimal conversion */}
      <Card>
        <Label>Optimal Roth Conversion Amount</Label>
        <div style={{ fontSize: 11, color: "#9db4ae", marginBottom: 12, lineHeight: 1.5 }}>
          Converts 401k → Roth during the bridge in $5k steps, runs the full simulation for each, picks the amount that maximizes estate value at age {plan.lifeExpect}.
        </div>
        {convBetter ? (
          <div style={{ background: "#f0faf6", border: "1px solid #a3d9c7", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#3d8c78", marginBottom: 4 }}>RECOMMENDED CONVERSION</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "#1a2e28" }}>{fmt(optimal.amount)}/yr</div>
            <div style={{ fontSize: 11, color: "#5aa88c", marginTop: 4 }}>
              Estate with this conversion: <strong>{fmt(Math.round(optimal.endVal))}</strong> vs no conversion:{" "}
              <strong>{fmt(Math.round(optimal.baseEnd))}</strong>
            </div>
            <div style={{ fontSize: 11, color: "#5aa88c", marginTop: 2 }}>
              Marginal tax rate on conversion:{" "}
              <strong>{pct((marginalFedRate(optimal.amount, plan.filingStatus) + plan.effectiveStateTax / 100) * 100)}</strong>
            </div>
          </div>
        ) : (
          <div style={{ background: "#f0f5f4", borderRadius: 10, padding: "14px 16px", fontSize: 11, color: "#7C9A92" }}>
            No Roth conversion improves the estate in your current scenario — likely because 401k withdrawals are already at a low effective rate, or the tax cost of converting outweighs the benefit.
          </div>
        )}
      </Card>

      {/* Chart */}
      <Card>
        <Label>Portfolio Over Time</Label>
        <StackedChart snaps={snaps} ssAge={plan.ssAge} />
      </Card>

      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.7, padding: "0 4px" }}>
        Sustainable spend = max monthly draw where money lasts to age {plan.lifeExpect} (binary search). Marginal values = extra estate from $1k/yr more
        into each account. Optimal conversion = exhaustive $0–$60k search. Planning model only.
      </div>
    </div>
  );
}
