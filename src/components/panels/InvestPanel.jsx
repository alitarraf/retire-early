// ─────────────────────────────────────────────────────────────
//  Invest tab (PRD_InvestTab_July2026) — one place to see every
//  instrument, edit it, and see the priority to maximize return.
//  Both columns read from the instrument REGISTRY, so a new
//  descriptor in constants/instruments.js shows up here automatically.
//
//  Left  — the editable list, grouped by category (from the registry).
//  Right — the priority recommendation (the Funding Order card, reused).
// ─────────────────────────────────────────────────────────────

import { NumInput } from "../ui.jsx";
import { instrumentsByCategory } from "../../constants/instruments.js";
import { FundingOrderCard } from "./FundingOrderCard.jsx";
import { fmtK } from "../../format.js";

const INK = "#1a2e28";
const FAINT = "#9db4ae";
// Only instrument-specific rates are editable per-row; equity/cash use the global
// assumptions (edited in the sidebar), so we don't duplicate them here.
const RATE_EDITABLE = new Set(["muniReturn", "mygaRate", "treasuryRate", "annuityRate"]);
const TAX_COLOR = { free: "#3d8c78", deferred: "#7ecfbb", stateExempt: "#7ecfbb", taxable: "#9db4ae" };
const TAX_LABEL = { free: "tax-free", deferred: "tax-deferred", stateExempt: "state-tax-free", taxable: "taxable" };

function InstrumentRow({ inst, inputs, set }) {
  const rateEditable = RATE_EDITABLE.has(inst.rateKey);
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid #eef4f2" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: TAX_COLOR[inst.tax] ?? FAINT, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{inst.label}</span>
        <span style={{ fontSize: 10.5, color: FAINT }}>{TAX_LABEL[inst.tax]}</span>
        {!inst.simModeled && <span style={{ fontSize: 9.5, color: "#c97c1a", background: "#fff3e8", borderRadius: 5, padding: "1px 5px" }}>recommendation</span>}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingLeft: 17 }}>
        {inst.balanceKey && (
          <Labeled label="Balance">
            <NumInput value={inputs[inst.balanceKey]} onChange={set(inst.balanceKey)} prefix="$" step={1000} width={110} />
          </Labeled>
        )}
        {inst.contribKey && (
          <Labeled label={`Contribution /${inst.contribUnit === "month" ? "mo" : "yr"}`}>
            <NumInput value={inputs[inst.contribKey]} onChange={set(inst.contribKey)} prefix="$" step={inst.contribUnit === "month" ? 100 : 500} width={100} />
          </Labeled>
        )}
        {rateEditable && (
          <Labeled label="Rate">
            <NumInput value={inputs[inst.rateKey]} onChange={set(inst.rateKey)} suffix="%" step={0.1} width={66} />
          </Labeled>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: FAINT, paddingLeft: 17, marginTop: 4 }}>{inst.note}</div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

const cardStyle = { background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const eyebrow = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: FAINT, marginBottom: 10 };

export function InvestPanel({ inputs, set, plan, funding, embedded = false }) {
  const groups = instrumentsByCategory();
  return (
    <div style={{ background: "#f0f5f4", height: embedded ? "auto" : "100%", overflowY: embedded ? "visible" : "auto", padding: "14px", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: embedded ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        {/* ── Left: the editable list ── */}
        <div style={cardStyle}>
          <div style={eyebrow}>Your instruments</div>
          {groups.map((g) => (
            <div key={g.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: g.key === "kids" ? "#c97c1a" : INK, marginBottom: 2 }}>{g.label}</div>
              {g.items.map((inst) => (
                <InstrumentRow key={inst.key} inst={inst} inputs={inputs} set={set} />
              ))}
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: FAINT, marginTop: 6, lineHeight: 1.5 }}>
            Balances &amp; equity/cash return assumptions also live in the sidebar. Kids' accounts are your child's money — they're
            shown as a cost, never drawn for your own retirement.
          </div>
        </div>

        {/* ── Right: the priority to maximize return ── */}
        <FundingOrderCard plan={plan} onApply={funding?.onApply} embedded />
      </div>
    </div>
  );
}
