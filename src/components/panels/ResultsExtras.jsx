// Shared results widgets used by both EarlyPanel and MaximizeCenter:
//  • TaxTransparency    — surfaces the SS provisional-income / marginal-rate modeling.
//  • LegacyGap          — projected estate vs the user's legacy target.
//  • ScenarioCard       — downside scenario summary (synthetic stress or historical sequence).
//  • PhaseBreakdownCard — Bridge → Early Retirement → Full SS (Retire Early details).
//  • ProjectedBalancesCard / MarginalValueCard — per-account balances + next-$1k value
//    (Maximize details). All three moved out of the rails when the chat became
//    the permanent right column.
import { useState, useMemo } from "react";
import { fmt, pct } from "../../format.js";
import { TAX_YEAR } from "../../constants/brackets.js";
import { cardTitleStyle, phase as phaseColor } from "../../theme.js";
import { Toggle } from "../ui.jsx";
import { marginalValues } from "../../analysis/marginalValue.js";

const cardStyle = {
  margin: "12px 14px 0",
  background: "#fff",
  borderRadius: 14,
  padding: "16px 20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const labelStyle = { ...cardTitleStyle, marginBottom: 12 };

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: color || "#1a2e28" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae" }}>{label}</div>
    </div>
  );
}

export function TaxTransparency({ plan, result }) {
  const ts = result.taxSummary ?? {};
  const ssPct = ts.ssTaxableFrac != null ? Math.round(ts.ssTaxableFrac * 100) : null;
  const k401 = ts.k401EffRate != null ? ts.k401EffRate * 100 : null;
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Tax transparency</div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 10 }}>
        <Stat label="SS taxable (first SS yr)" value={ssPct != null ? `${ssPct}%` : "—"} />
        <Stat label="401k effective rate" value={k401 != null ? `${k401.toFixed(1)}%` : "—"} />
        <Stat label="Filing status" value={plan.filingStatus.toUpperCase()} />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>
        Tax model: provisional-income Social Security taxation (up to 85% taxable) + marginal-rate
        traditional withdrawals on {TAX_YEAR} brackets.{" "}
        {plan.assumeStepUpBasis
          ? "Step-up in basis applied — heirs inherit brokerage with unrealized gains erased."
          : "No step-up — embedded brokerage gains are taxed at death in the estate value."}
      </div>
    </div>
  );
}

export function LegacyGap({ plan, endVal }) {
  if (!(plan.legacyTarget > 0)) return null;
  const yrs = plan.lifeExpect - plan.currentAge;
  const targetNominal = plan.legacyTarget * Math.pow(1 + plan.inflationRate / 100, yrs);
  const gap = endVal - targetNominal;
  const ok = gap >= 0;
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Legacy target</div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat label={`Projected estate at ${plan.lifeExpect}`} value={fmt(endVal)} />
        <Stat label={`Target (inflated to ${plan.lifeExpect})`} value={fmt(targetNominal)} />
        <Stat label={ok ? "Surplus" : "Shortfall"} value={`${ok ? "+" : "−"}${fmt(Math.abs(gap))}`} color={ok ? "#3d8c78" : "#c0392b"} />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>
        Your {fmt(plan.legacyTarget)} target (today's $) inflates to {fmt(targetNominal)} by age{" "}
        {plan.lifeExpect}. {ok ? "Your plan clears it." : "Reduce spending or save more to close the gap."}
      </div>
    </div>
  );
}

// Downside scenario summary — drives off the `scenario` descriptor from App
// ({ result, color, label, blurb }), so it renders identically for the synthetic
// Stress Test and a real Historical Sequence.
export function ScenarioCard({ scenario, plan }) {
  if (!scenario?.result) return null;
  const { snaps, depleted, estateGainTax = 0 } = scenario.result;
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - estateGainTax;
  const survives = depleted === null;
  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${scenario.color}` }}>
      <div style={labelStyle}>{scenario.label}</div>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat
          label="Outcome"
          value={survives ? "Survives" : `Depletes by ${Math.ceil(depleted)}`}
          color={survives ? "#3d8c78" : "#c0392b"}
        />
        <Stat label={`Estate at ${plan.lifeExpect}`} value={fmt(endVal)} color={survives ? "#1a2e28" : "#c0392b"} />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6 }}>{scenario.blurb}</div>
    </div>
  );
}

// Phase breakdown — the three drawdown chapters (Bridge → Early Retirement →
// Full SS). Moved here from the old right rail; shown in Retire Early "details".
export function PhaseBreakdownCard({ plan, result }) {
  const { snaps } = result;
  const snap59 = snaps.find((s) => s.age === 59) || snaps[0];
  const snapSS = snaps.find((s) => s.age === plan.ssAge) || snaps[0];

  const phases = [
    {
      color: phaseColor.bridge,
      title: "Bridge",
      ages: `${plan.retireAge}→59½`,
      desc:
        `Roth contribs free → Munis → Brokerage (${pct(plan.brokerageLtcgRate)} LTCG). 401k locked.` +
        (plan.annualRothConversion > 0 ? ` Converting ${fmt(plan.annualRothConversion)}/yr → Roth.` : ""),
      balance: snap59?.total ?? null,
    },
    {
      color: phaseColor.early,
      title: "Early Retirement",
      ages: `59½→${plan.ssAge}`,
      desc: `Roth earnings free. 401k at retirement bracket — not ${plan.employmentBracket}%. No SS.`,
      balance: snapSS?.total ?? null,
    },
    {
      color: phaseColor.full,
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
    <div style={cardStyle}>
      <div style={labelStyle}>Phase breakdown</div>
      {phases.map((ph) => (
        <div key={ph.title} style={{ borderLeft: `3px solid ${ph.color}`, paddingLeft: 11, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ph.color }}>
              {ph.title}{" "}
              <span style={{ fontWeight: 400, color: "#9db4ae", fontSize: 11 }}>Age {ph.ages}</span>
            </div>
            {ph.balance != null && (
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#1a2e28", fontWeight: 600, whiteSpace: "nowrap" }}>
                {fmt(ph.balance)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#4a5e58", lineHeight: 1.5, marginTop: 3 }}>{ph.desc}</div>
        </div>
      ))}
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6, marginTop: 4, paddingTop: 10, borderTop: "1px solid #e2e8e6" }}>
        Draw order: Roth contributions → Roth earnings (59½+) → Converted Roth (59½+, 5-yr lock) →
        Munis → HSA → Brokerage → 401k (59½+) → CD. 401k uses {TAX_YEAR}{" "}
        {plan.filingStatus.toUpperCase()} brackets on the actual draw. Planning model only.
      </div>
    </div>
  );
}

// Per-account balances projected to the retirement date. Moved here from the old
// Maximize rail; shown in Maximize "details".
const PROJ_ROWS = [
  { key: "rothContributions", label: "Roth contributions", color: "#3d8c78", note: "Always tax-free" },
  { key: "rothEarnings",      label: "Roth earnings",      color: "#7ecfbb", note: "Tax-free after 59½" },
  { key: "k401",              label: "401k",                color: "#1a2e28", note: "Taxed at retirement bracket" },
  { key: "hsaBalance",        label: "HSA",                 color: "#5aada0", note: "Tax-free for medical" },
  { key: "muniBonds",         label: "Munis",               color: "#a8d5c8", note: null },
  { key: "treasuryBalance",   label: "Treasuries",          color: "#9db4ae", note: "State-tax-free" },
  { key: "mygaBalance",       label: "MYGA",                color: "#b8c9c3", note: "Tax-deferred" },
  { key: "brokerage",         label: "Brokerage",           color: "#4a8c7a", note: null },
  { key: "cashDeposit",       label: "CD / cash",           color: "#9db4ae", note: null },
];

export function ProjectedBalancesCard({ plan, atRetirement }) {
  if (!atRetirement) return null;
  const total = PROJ_ROWS.reduce((sum, { key }) => sum + (atRetirement[key] ?? 0), 0);

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Projected at retirement — age {plan.retireAge}</div>
      {PROJ_ROWS.map(({ key, label, color, note }) => {
        const val = atRetirement[key] ?? 0;
        const dynamicNote =
          key === "muniBonds" ? `${pct(plan.muniReturn)} yield`
          : key === "brokerage" ? `LTCG ${pct(plan.brokerageLtcgRate)}`
          : key === "cashDeposit" ? `After-tax ${pct(plan.depositAfterTaxRate)}`
          : note;
        return (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #e2e8e6" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: 99, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#4a5e58" }}>{label}</span>
              </div>
              {dynamicNote && (
                <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 1, paddingLeft: 12 }}>{dynamicNote}</div>
              )}
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#1a2e28", fontSize: 11 }}>
              {fmt(val)}
            </span>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontSize: 12, fontWeight: 700 }}>
        <span>Total</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3d8c78" }}>{fmt(total)}</span>
      </div>
    </div>
  );
}

// Marginal value — extra value from adding $1k/yr to each account, under a lens
// the user toggles: "While alive" = sustainable monthly spend (shares the Funding
// Order card's objective, so they agree); "Leave behind" = estate at death. The
// two can rank accounts differently — a locked 401k is strong for estate, weak for
// early-retirement spending — which is exactly why both lenses are offered.
// Shown in Maximize "details". `marginalRows` is the spend lens (memoized in App);
// the estate lens is computed lazily only when selected.
export function MarginalValueCard({ plan }) {
  const [lens, setLens] = useState("spend");
  // Computed here (not in App) and keyed on the lens, so the marginal searches
  // only run while this card is mounted (Maximize "details", collapsed by
  // default) — keeping the retire-age slider snappy.
  const rows = useMemo(() => marginalValues(plan, { objective: lens }), [plan, lens]);
  if (!rows?.length) return null;

  const maxGain = Math.max(...rows.map((m) => m.gain), 1);
  const spend = lens === "spend";
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={labelStyle}>Where should your next $1,000/yr go?</div>
        <Toggle
          value={lens}
          onChange={setLens}
          options={[
            { value: "spend", label: "While alive" },
            { value: "estate", label: "Leave behind" },
          ]}
        />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 14, lineHeight: 1.5 }}>
        {spend
          ? "Ranked by the extra safe monthly spending each adds — maximize what you can spend while alive. Bridge-aware: a 401k you can't touch until 59½ scores low if you retire early."
          : "Ranked by the extra estate each adds at death — maximize what you leave behind. A sleeve you never spend can rank higher here than under “While alive.”"}
      </div>
      {rows.map(({ label, gain }) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#4a5e58" }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#3d8c78" }}>
              +{fmt(Math.round(gain))}{spend ? "/mo" : ""}
            </span>
          </div>
          <div style={{ background: "#e2e8e6", borderRadius: 99, height: 4, overflow: "hidden" }}>
            <div style={{ width: `${(gain / maxGain) * 100}%`, height: "100%", background: "#3d8c78", borderRadius: 99, minWidth: gain > 0 ? 4 : 0 }} />
          </div>
        </div>
      ))}
      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.5, marginTop: 4 }}>
        {spend
          ? `Gain = extra safe monthly spend. Full simulation per account.`
          : `Gain = extra estate at age ${plan.lifeExpect}. Full simulation per account.`}
      </div>
    </div>
  );
}
