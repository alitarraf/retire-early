// First-run onboarding mini-form. Collects the four numbers needed to get a
// meaningful first projection, then pre-fills the full sidebar. Shown as an
// overlay above the app; dismissal is remembered in App via localStorage.
import { useState } from "react";
import { NumInput, Toggle } from "../ui.jsx";
import { fmtK } from "../../format.js";

export function QuickStart({ onApply, onSkip }) {
  const [age, setAge] = useState(60);
  const [status, setStatus] = useState("retired"); // "retired" | "working"
  const [retireAge, setRetireAge] = useState(65);
  const [saved, setSaved] = useState(1_000_000);
  const [spend, setSpend] = useState(6000);

  const effectiveRetireAge = status === "retired" ? age : Math.max(retireAge, age + 1);

  const apply = () => {
    onApply({
      currentAge: age,
      retireAge: effectiveRetireAge,
      monthlyExpense: spend,
      // Put the lump into taxable brokerage as a neutral starting bucket and
      // zero the other balances so "total saved" isn't double-counted. The
      // user refines the real account mix in the Money section.
      existingBrokerage: saved,
      existingBrokerageBasis: saved,
      k401Today: 0,
      rothTotal: 0,
      existingRothEarnings: 0,
      cashDeposit: 0,
      muniBonds: 0,
      hsaBalance: 0,
    });
  };

  const lbl = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7C9A92", marginBottom: 6 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(26,46,40,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ background: "#fff", borderRadius: 18, padding: "28px 30px", width: 440, maxWidth: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "#3d8c78", textTransform: "uppercase", marginBottom: 6 }}>
          Start here
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2e28", marginBottom: 4 }}>
          Let's see your retirement plan
        </div>
        <div style={{ fontSize: 12, color: "#7C9A92", lineHeight: 1.5, marginBottom: 20 }}>
          Four quick numbers to get started — you can refine everything in the sidebar after.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>I am</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <NumInput value={age} onChange={setAge} min={25} max={90} width={70} />
            <span style={{ fontSize: 13, color: "#4a5e58" }}>years old and</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Toggle
              value={status}
              onChange={setStatus}
              options={[{ value: "retired", label: "Retired" }, { value: "working", label: "Still working" }]}
            />
          </div>
        </div>

        {status === "working" && (
          <div style={{ marginBottom: 16 }}>
            <div style={lbl}>I plan to retire at</div>
            <NumInput value={retireAge} onChange={setRetireAge} min={age + 1} max={80} width={70} />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={lbl}>Total saved & invested</div>
          <NumInput value={saved} onChange={setSaved} prefix="$" step={50000} width={160} />
          <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 4 }}>
            ≈ {fmtK(saved)} across all accounts. Split it by 401k / Roth / brokerage in <strong>Money →</strong> for accurate taxes.
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={lbl}>Monthly spending</div>
          <NumInput value={spend} onChange={setSpend} prefix="$" step={250} width={160} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={apply}
            style={{ flex: 1, border: "none", borderRadius: 10, cursor: "pointer", background: "#1a2e28", color: "#7ecfbb", fontSize: 13, fontWeight: 700, padding: "12px 0" }}
          >
            See my plan →
          </button>
          <button
            onClick={onSkip}
            style={{ border: "none", background: "transparent", color: "#9db4ae", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "12px 8px" }}
          >
            Skip
          </button>
        </div>
        <div style={{ fontSize: 9, color: "#b0c4be", marginTop: 14, textAlign: "center" }}>
          Educational planning tool — not financial advice.
        </div>
      </div>
    </div>
  );
}
