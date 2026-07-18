// Mobile layout (≤767px). A single-column, app-like shell that re-lays-out the
// same panels the desktop grid uses — engine/analysis/state all live in App.jsx
// and arrive here as props. Structure (iOS-safe `100dvh` flex column so the
// bottom nav never hides under the Safari toolbar):
//
//   top bar (burger → page tabs)   ← shrink
//   hero (RetireAtControl)         ← shrink   (early/maximize only)
//   middle: results OR an input    ← the only scroller
//   bottom nav (input sections)    ← shrink   (early/maximize only)
//
// Tapping a bottom-nav section opens its editor in the middle; tapping the
// active one again (or Done) returns to results. Get-advice / How-it-works are
// content-only: hero + bottom nav are hidden there.
import { useState } from "react";
import { RetireAtControl } from "../panels/RetireAtControl.jsx";
import { EarlyPanel } from "../panels/EarlyPanel.jsx";
import { RetiredPanel } from "../panels/RetiredPanel.jsx";
import { MaximizeCenter } from "../panels/MaximizeCenter.jsx";
import { AdvicePanel } from "../panels/AdvicePanel.jsx";
import { DocsPanel } from "../panels/DocsPanel.jsx";
import { INPUT_SECTIONS, FINE_TUNING_KEYS } from "../panels/InputsSidebar.jsx";
import { ExpertToggle } from "../panels/inputs/atoms.jsx";

const NAV = [
  { key: "you", label: "You" },
  { key: "money", label: "Money" },
  { key: "spending", label: "Spending" },
  { key: "assumptions", label: "Assumptions" },
  { key: "finetuning", label: "Fine-tune" },
];

// Tabs that use the live inputs (hero slider + bottom-nav editors).
const INPUT_TABS = new Set(["early", "maximize"]);

export function MobileShell(props) {
  const { mode, setMode, tabs, inputs, set, plan, earliest, onScrubAge, onCommitAge, result } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // null = results view
  const [ftSub, setFtSub] = useState(FINE_TUNING_KEYS[0]);

  const usesInputs = INPUT_TABS.has(mode);
  const activeTabLabel = tabs.find((t) => t.key === mode)?.label ?? "";

  const goToTab = (key) => {
    setMode(key);
    setMenuOpen(false);
    setActiveSection(null);
  };

  const tapSection = (key) => setActiveSection((cur) => (cur === key ? null : key));

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#f0f5f4",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap'); input[type=number]::-webkit-inner-spin-button{opacity:.4} *{box-sizing:border-box}
        @keyframes agePop { 0%{transform:scale(1.28)} 55%{transform:scale(.94)} 100%{transform:scale(1)} }
        @keyframes sparkPop { 0%{transform:scale(.5);opacity:0} 45%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
        @media (prefers-reduced-motion: reduce){ .age-pop,.spark-pop{animation:none !important} }`}</style>

      {/* ── Top bar ─────────────────────────────────── */}
      <div
        style={{
          background: "#1a2e28",
          height: 50,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 14px",
          borderBottom: "1px solid #243d36",
        }}
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          style={{
            border: "none",
            background: "transparent",
            color: "#7ecfbb",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            padding: 6,
            flexShrink: 0,
          }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "#5aada0", textTransform: "uppercase" }}>
            Retirement Planner
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeTabLabel}
          </span>
        </div>
      </div>

      {/* ── Burger menu overlay (page tabs) ───────────── */}
      {menuOpen && (
        <div style={{ position: "relative", flexShrink: 0, zIndex: 20 }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              background: "#1a2e28",
              borderBottom: "1px solid #243d36",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              padding: "6px 0",
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => goToTab(t.key)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  padding: "13px 20px",
                  background: mode === t.key ? "#243d36" : "transparent",
                  color: mode === t.key ? "#fff" : "#9db4ae",
                  fontSize: 14,
                  fontWeight: mode === t.key ? 700 : 500,
                  borderLeft: mode === t.key ? "3px solid #7ecfbb" : "3px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Hero (input tabs only) ────────────────────── */}
      {usesInputs && (
        <div style={{ flexShrink: 0 }}>
          {plan.alreadyRetired ? (
            <div style={{ padding: "14px 18px", background: "#1a2e28" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7ecfbb", marginBottom: 3 }}>
                Retired
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                Planning from age {plan.currentAge} → {plan.lifeExpect}
              </div>
            </div>
          ) : (
            <RetireAtControl
              value={plan.retireAge}
              min={plan.currentAge}
              max={80}
              earliest={earliest}
              onScrub={onScrubAge}
              onCommit={onCommitAge}
            />
          )}
        </div>
      )}

      {/* ── Middle: the single scroller ───────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {usesInputs && activeSection ? (
          <SectionEditor
            section={activeSection}
            ftSub={ftSub}
            setFtSub={setFtSub}
            onDone={() => setActiveSection(null)}
            inputs={inputs}
            set={set}
            plan={plan}
            levers={{
              sensitivityRows: props.sensitivityRows,
              appliedLevers: props.appliedLevers,
              onApplyLever: props.applyLever,
              onUndoLevers: props.undoLevers,
            }}
          />
        ) : (
          <Results {...props} />
        )}
      </div>

      {/* ── Bottom nav (input tabs only) ──────────────── */}
      {usesInputs && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            background: "#fafcfc",
            borderTop: "1px solid #e2e8e6",
          }}
        >
          {NAV.map((n) => {
            const active = activeSection === n.key;
            return (
              <button
                key={n.key}
                onClick={() => tapSection(n.key)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                  padding: "9px 2px 8px",
                  borderTop: active ? "2px solid #7ecfbb" : "2px solid transparent",
                  marginTop: -1,
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#1a2e28" : "#7C9A92",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Results body for the active tab ──────────────────────────
function Results(props) {
  const {
    mode, plan, result, earliest, earliestByRisk, onPickRisk, funding, mcResult, scenario, totalAtRetirement, sustainable, retireBy,
    sensitivityRows, applyLever, appliedLevers, undoLevers,
    atRetirement, marginalRows, dynamicOpt, applyOptimized, onRunMc,
    inputs,
  } = props;

  if (mode === "advice") {
    return (
      <div style={{ background: "#f0f5f4", padding: "20px 16px 40px" }}>
        <AdvicePanel
          inputs={inputs}
          plan={plan}
          result={result}
          earliest={earliest}
          sustainable={sustainable}
          mcResult={mcResult}
          totalAtRetirement={totalAtRetirement}
        />
      </div>
    );
  }
  if (mode === "docs") {
    return (
      <div style={{ background: "#f0f5f4", padding: "20px 16px 40px" }}>
        <DocsPanel />
      </div>
    );
  }

  // early / maximize need a valid result (retire age ≥ current age)
  if (!result) {
    return (
      <div style={{ padding: "28px 18px" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#c97c1a", marginBottom: 8 }}>
            Check the retirement age
          </div>
          <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
            Your retire age ({plan.retireAge}) must be at least your current age ({plan.currentAge}).
            Nudge the slider above, or lower Your age under "You".
          </div>
        </div>
      </div>
    );
  }

  if (mode === "maximize") {
    return (
      <MaximizeCenter
        embedded
        plan={plan}
        result={result}
        earliestByRisk={earliestByRisk}
        onPickRisk={onPickRisk}
        totalAtRetirement={totalAtRetirement}
        sustainable={sustainable}
        dynamicOpt={dynamicOpt}
        onApplyOptimized={applyOptimized}
        scenario={scenario}
        mcResult={mcResult}
        onRunMc={onRunMc}
        atRetirement={atRetirement}
        marginalRows={marginalRows}
        funding={funding}
      />
    );
  }

  // early — retirees get the retiree dashboard instead of earliest-age framing
  if (plan.alreadyRetired) {
    return (
      <RetiredPanel
        embedded
        onPickRisk={onPickRisk}
        plan={plan}
        result={result}
        mcResult={mcResult}
        scenario={scenario}
        totalAtRetirement={totalAtRetirement}
        sustainable={sustainable}
        dynamicOpt={dynamicOpt}
        onApplyOptimized={applyOptimized}
        funding={funding}
      />
    );
  }
  return (
    <EarlyPanel
      embedded
      plan={plan}
      result={result}
      earliest={earliest}
      earliestByRisk={earliestByRisk}
      onPickRisk={onPickRisk}
      funding={funding}
      mcResult={mcResult}
      scenario={scenario}
      totalAtRetirement={totalAtRetirement}
      sustainable={sustainable}
      retireBy={retireBy}
    />
  );
}

// ── Single input section editor ──────────────────────────────
function SectionEditor({ section, ftSub, setFtSub, onDone, inputs, set, plan, levers = {} }) {
  // "Fine-tune" opens a sub-tab strip over the optional sections.
  if (section === "finetuning") {
    const Sub = INPUT_SECTIONS[ftSub].Body;
    const subExtra = ftSub === "levers" ? levers : {};
    return (
      <div style={{ background: "#fff", minHeight: "100%" }}>
        <EditorHeader title="Fine-tuning" onDone={onDone} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 14px", borderBottom: "1px solid #e2e8e6", background: "#fafcfc" }}>
          {FINE_TUNING_KEYS.map((key) => {
            const active = key === ftSub;
            return (
              <button
                key={key}
                onClick={() => setFtSub(key)}
                style={{
                  flexShrink: 0,
                  border: active ? "1px solid #1a2e28" : "1px solid #d0deda",
                  background: active ? "#1a2e28" : "#fff",
                  color: active ? "#fff" : "#4a5e58",
                  borderRadius: 999,
                  padding: "6px 13px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {INPUT_SECTIONS[key].title}
              </button>
            );
          })}
        </div>
        <ExpertToggle />
        <div style={{ padding: "16px 16px 32px" }}>
          <Sub inputs={inputs} set={set} plan={plan} {...subExtra} />
        </div>
      </div>
    );
  }

  const { title, Body } = INPUT_SECTIONS[section];
  return (
    <div style={{ background: "#fff", minHeight: "100%" }}>
      <EditorHeader title={title} onDone={onDone} />
      <div style={{ padding: "16px 16px 32px" }}>
        <Body inputs={inputs} set={set} plan={plan} />
      </div>
    </div>
  );
}

function EditorHeader({ title, onDone }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "#1a2e28",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{title}</span>
      <button
        onClick={onDone}
        style={{
          border: "1px solid #3d8c78",
          background: "transparent",
          color: "#7ecfbb",
          borderRadius: 7,
          padding: "5px 14px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </div>
  );
}
