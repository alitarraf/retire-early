import { useState, useMemo } from "react";
import { DEFAULTS, makePlan, runMain, projectAtRetirement } from "./analysis/plan.js";
import { earliestRetireAge } from "./analysis/earliestRetireAge.js";
import { sensitivity } from "./analysis/sensitivity.js";
import { marginalValues } from "./analysis/marginalValue.js";
import { optimalConversion } from "./analysis/optimalConversion.js";
import { sustainableSpend } from "./analysis/sustainableSpend.js";
import { InputsPanel } from "./components/panels/InputsPanel.jsx";
import { EarlyPanel } from "./components/panels/EarlyPanel.jsx";
import { MaximizePanel } from "./components/panels/MaximizePanel.jsx";
import { fmt } from "./format.js";

const TABS = [
  { key: "early", icon: "⏱", label: "Retire Early", sub: "Find your earliest exit" },
  { key: "maximize", icon: "📈", label: "Maximize Portfolio", sub: "Optimize what you build & leave" },
];

export default function App() {
  const [mode, setMode] = useState("early");
  const [inputs, setInputs] = useState(DEFAULTS);
  const set = (key) => (val) => setInputs((prev) => ({ ...prev, [key]: val }));

  const plan = useMemo(() => makePlan(inputs), [inputs]);
  const result = useMemo(() => runMain(plan), [plan]);

  // Early-mode analysis
  const earliest = useMemo(() => earliestRetireAge(plan), [plan]);
  const sensitivityRows = useMemo(() => (mode === "early" ? sensitivity(plan) : []), [plan, mode]);

  // Maximize-mode analysis
  const atRetirement = useMemo(() => projectAtRetirement(plan), [plan]);
  const marginalRows = useMemo(() => (mode === "maximize" ? marginalValues(plan) : []), [plan, mode]);
  const optimal = useMemo(() => (mode === "maximize" ? optimalConversion(plan) : { amount: 0, endVal: 0, baseEnd: 0 }), [plan, mode]);
  const sustainable = useMemo(() => (mode === "maximize" ? sustainableSpend(plan) : 0), [plan, mode]);

  const totalAtRetirement =
    atRetirement.rothContributions + atRetirement.rothEarnings + atRetirement.k401 +
    atRetirement.brokerage + atRetirement.cashDeposit + atRetirement.muniBonds;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f0f5f4", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap'); input[type=number]::-webkit-inner-spin-button{opacity:.4}`}</style>

      {/* Tab bar */}
      <div style={{ background: "#1a2e28", paddingTop: 24, paddingBottom: 0, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#7ecfbb", textTransform: "uppercase", marginBottom: 12 }}>
            Retirement Planner
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "10px 10px 0 0",
                  border: "none",
                  cursor: "pointer",
                  background: mode === t.key ? "#f0f5f4" : "transparent",
                  transition: "all 0.15s",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: mode === t.key ? "#1a2e28" : "#7ecfbb" }}>
                  {t.icon} {t.label}
                </div>
                <div style={{ fontSize: 10, color: mode === t.key ? "#7C9A92" : "#3d8c78", marginTop: 2 }}>{t.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sanity strip */}
      <div style={{ background: "#eef2f1", borderBottom: "1px solid #dce8e4", padding: "8px 20px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", fontSize: 11, color: "#7C9A92", display: "flex", gap: 20, flexWrap: "wrap", fontFamily: "'JetBrains Mono',monospace" }}>
          <span>Age {inputs.currentAge} → retire {inputs.retireAge} ({plan.yearsToRetire} yrs)</span>
          <span>Portfolio at {inputs.retireAge}: <strong style={{ color: "#1a2e28" }}>{fmt(totalAtRetirement)}</strong></span>
          <span>Monthly need: <strong style={{ color: "#1a2e28" }}>{fmt(plan.monthlyAtRetirement)}/mo</strong></span>
          <span>401k/yr: <strong style={{ color: "#1a2e28" }}>{fmt(plan.total401kAnnual)}</strong> · Roth/yr: <strong style={{ color: "#1a2e28" }}>{fmt(inputs.rothAnnualContrib)}</strong></span>
        </div>
      </div>

      {/* Two-column layout: inputs left, outputs right */}
      <div style={{ padding: "20px 20px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <InputsPanel inputs={inputs} set={set} plan={plan} />
          {mode === "early" ? (
            <EarlyPanel plan={plan} result={result} earliest={earliest} sensitivityRows={sensitivityRows} />
          ) : (
            <MaximizePanel
              plan={plan}
              result={result}
              atRetirement={atRetirement}
              marginalRows={marginalRows}
              optimal={optimal}
              sustainable={sustainable}
            />
          )}
        </div>
      </div>
    </div>
  );
}
