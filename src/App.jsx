import { useState, useMemo } from "react";
import { DEFAULTS, makePlan, runMain, projectAtRetirement, simParamsAt } from "./analysis/plan.js";
import { earliestRetireAge } from "./analysis/earliestRetireAge.js";
import { sensitivity } from "./analysis/sensitivity.js";
import { marginalValues } from "./analysis/marginalValue.js";
import { optimalConversion } from "./analysis/optimalConversion.js";
import { sustainableSpend } from "./analysis/sustainableSpend.js";
import { monteCarlo } from "./engine/monteCarlo.js";
import { InputsSidebar } from "./components/panels/InputsSidebar.jsx";
import { EarlyPanel } from "./components/panels/EarlyPanel.jsx";
import { RightRail } from "./components/panels/RightRail.jsx";
import { MaximizeCenter } from "./components/panels/MaximizeCenter.jsx";
import { MaximizeRail } from "./components/panels/MaximizeRail.jsx";
import { DocsPanel } from "./components/panels/DocsPanel.jsx";
import { fmt } from "./format.js";

const TABS = [
  { key: "early", label: "Retire Early" },
  { key: "maximize", label: "Maximize" },
  { key: "docs", label: "How it works" },
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

  // Monte Carlo — seeded so same inputs → same result
  const mainSimParams = useMemo(() => simParamsAt(plan, plan.retireAge), [plan]);
  const mcResult = useMemo(
    () => (mode === "early" ? monteCarlo(mainSimParams, { n: 500, seed: 42 }) : null),
    [mainSimParams, mode],
  );

  // Maximize-mode analysis
  const atRetirement = useMemo(() => projectAtRetirement(plan), [plan]);
  const marginalRows = useMemo(() => (mode === "maximize" ? marginalValues(plan) : []), [plan, mode]);
  const optimal = useMemo(
    () => (mode === "maximize" ? optimalConversion(plan) : { amount: 0, endVal: 0, baseEnd: 0 }),
    [plan, mode],
  );

  // Un-gated: used in Early mode KPI chip and Maximize mode hero
  const sustainable = useMemo(() => sustainableSpend(plan), [plan]);

  const totalAtRetirement =
    atRetirement.rothContributions +
    atRetirement.rothEarnings +
    atRetirement.k401 +
    atRetirement.brokerage +
    atRetirement.cashDeposit +
    atRetirement.muniBonds +
    (atRetirement.hsaBalance ?? 0);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap'); input[type=number]::-webkit-inner-spin-button{opacity:.4} *{box-sizing:border-box}`}</style>

      {/* ── Slim header ────────────────────────────────── */}
      <div
        style={{
          background: "#1a2e28",
          height: 46,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 24,
          flexShrink: 0,
          borderBottom: "1px solid #243d36",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "#7ecfbb",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          Retirement Planner
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              style={{
                padding: "0 16px",
                height: 46,
                border: "none",
                cursor: "pointer",
                background: "transparent",
                borderBottom: mode === t.key ? "2px solid #7ecfbb" : "2px solid transparent",
                fontSize: 12,
                fontWeight: mode === t.key ? 700 : 500,
                color: mode === t.key ? "#fff" : "#5aada0",
                lineHeight: "44px",
                transition: "color 0.12s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sanity strip */}
        <div
          style={{
            fontSize: 10,
            color: "#5aada0",
            fontFamily: "'JetBrains Mono', monospace",
            display: "flex",
            gap: 18,
            flexShrink: 0,
          }}
        >
          <span>
            age {inputs.currentAge} → retire {inputs.retireAge}
          </span>
          <span style={{ color: "#7ecfbb" }}>{fmt(totalAtRetirement)}</span>
          <span>{fmt(plan.monthlyAtRetirement)}/mo</span>
        </div>
      </div>

      {/* ── 3-column grid ──────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "440px 1fr 320px",
          gap: "1px",
          background: "#dce8e4",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left: accordion inputs (always visible) */}
        <InputsSidebar inputs={inputs} set={set} plan={plan} />

        {/* Center + right: mode-dependent */}
        {mode === "docs" ? (
          <div
            style={{
              gridColumn: "2 / 4",
              background: "#f0f5f4",
              overflowY: "auto",
              padding: "28px 36px",
            }}
          >
            <DocsPanel />
          </div>
        ) : mode === "early" ? (
          <>
            <EarlyPanel
              plan={plan}
              result={result}
              earliest={earliest}
              mcResult={mcResult}
              totalAtRetirement={totalAtRetirement}
              sustainable={sustainable}
            />
            <RightRail plan={plan} result={result} sensitivityRows={sensitivityRows} />
          </>
        ) : (
          <>
            <MaximizeCenter
              plan={plan}
              result={result}
              totalAtRetirement={totalAtRetirement}
              sustainable={sustainable}
              optimal={optimal}
            />
            <MaximizeRail
              plan={plan}
              atRetirement={atRetirement}
              marginalRows={marginalRows}
            />
          </>
        )}
      </div>
    </div>
  );
}
