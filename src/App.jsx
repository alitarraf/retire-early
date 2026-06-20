import { useState, useMemo, useEffect, useRef } from "react";
import { DEFAULTS, makePlan, runMain, projectAtRetirement, simParamsAt } from "./analysis/plan.js";
import { earliestRetireAge } from "./analysis/earliestRetireAge.js";
import { retireByAge } from "./analysis/retireByAge.js";
import { sensitivity } from "./analysis/sensitivity.js";
import { marginalValues } from "./analysis/marginalValue.js";
import { dynamicOptimizer } from "./analysis/dynamicOptimizer.js";
import { sustainableSpend } from "./analysis/sustainableSpend.js";
import { monteCarlo } from "./engine/monteCarlo.js";
import { stressTest } from "./analysis/stressTest.js";
import { historicalSequence } from "./analysis/historicalSequence.js";
import { HISTORICAL_SCENARIOS } from "./constants/historicalReturns.js";
import { InputsSidebar } from "./components/panels/InputsSidebar.jsx";
import { RetireAtControl } from "./components/panels/RetireAtControl.jsx";
import { EarlyPanel } from "./components/panels/EarlyPanel.jsx";
import { MaximizeCenter } from "./components/panels/MaximizeCenter.jsx";
import { DocsPanel } from "./components/panels/DocsPanel.jsx";
import { AdvicePanel } from "./components/panels/AdvicePanel.jsx";
import { QuickStart } from "./components/panels/QuickStart.jsx";
import { MobileShell } from "./components/mobile/MobileShell.jsx";
import { ChatDrawer } from "./components/panels/ChatDrawer.jsx";
import { isAskEnabled } from "./agent/featureFlags.js";
import { useIsMobile } from "./useIsMobile.js";
import { fmt } from "./format.js";

const TABS = [
  { key: "early", label: "Retire Early" },
  { key: "maximize", label: "Maximize" },
  { key: "advice", label: "Get advice" },
  { key: "docs", label: "How it works" },
];

const QS_KEY = "retire-early.quickStartDismissed";

export default function App() {
  const [mode, setMode] = useState("early");
  const isMobile = useIsMobile();
  const [inputs, setInputs] = useState(DEFAULTS);
  const set = (key) => (val) => setInputs((prev) => ({ ...prev, [key]: val }));

  // First-run onboarding overlay; dismissal is remembered across sessions.
  const [showQuickStart, setShowQuickStart] = useState(() => {
    try { return !localStorage.getItem(QS_KEY); } catch { return true; }
  });
  const dismissQuickStart = () => {
    try { localStorage.setItem(QS_KEY, "1"); } catch { /* ignore */ }
    setShowQuickStart(false);
  };
  const applyQuickStart = (vals) => {
    setInputs((prev) => ({ ...prev, ...vals }));
    dismissQuickStart();
  };

  const plan = useMemo(() => makePlan(inputs), [inputs]);

  // Drag-aware "Retire at": during a slider drag we update `dragAge` ONLY (never
  // setInputs), so `inputs`/`plan` stay referentially stable and every expensive
  // memo below (Monte Carlo, sensitivity, binary searches) is frozen for free.
  // A cheap live tier (livePlan/result, 1 sim) tracks the drag; committing on
  // release / a discrete control triggers the full recompute once.
  const [dragAge, setDragAge] = useState(null);
  const clampAge = (v) => Math.max(inputs.currentAge, Math.min(80, Math.round(v)));
  const onScrubAge = (v) => setDragAge(clampAge(v));
  const onCommitAge = (v) => {
    setInputs((prev) => ({ ...prev, retireAge: clampAge(v) }));
    setDragAge(null);
  };
  const livePlan = useMemo(
    () => (dragAge == null ? plan : makePlan({ ...inputs, retireAge: dragAge })),
    [plan, inputs, dragAge],
  );
  const result = useMemo(() => runMain(livePlan), [livePlan]);

  // Early-mode analysis
  const earliest = useMemo(() => earliestRetireAge(plan), [plan]);
  const sensitivityRows = useMemo(() => (mode === "early" ? sensitivity(plan) : []), [plan, mode]);

  // Goal-seek: "to retire at your configured Retire-at age, how much must I save?"
  // Keyed to the single source of truth (plan.retireAge) — no separate target input.
  const retireBy = useMemo(
    () => (mode === "early" ? retireByAge(plan, plan.retireAge) : null),
    [plan, mode],
  );

  // Monte Carlo — seeded so same inputs → same result. Live in Retire Early
  // (cheap, headline metric); opt-in in Maximize (where dynamicOptimizer already
  // runs sims) via a button. The useMemo re-caches automatically on input change.
  const [maxMcOn, setMaxMcOn] = useState(false);
  const mainSimParams = useMemo(() => simParamsAt(plan, plan.retireAge), [plan]);
  const mcResult = useMemo(
    () =>
      mode === "early" || (mode === "maximize" && maxMcOn)
        ? monteCarlo(mainSimParams, { n: 500, seed: 42 })
        : null,
    [mainSimParams, mode, maxMcOn],
  );
  // Re-gate Maximize MC on any input change so it stays genuinely on-demand:
  // without this the button gates the cost only once, then 500 runs go live on
  // every keystroke (on top of dynamicOptimizer). The user re-clicks Run to refresh.
  useEffect(() => {
    setMaxMcOn(false);
  }, [mainSimParams]);

  // Scenario overlay — a single downside run (synthetic stress OR a real historical
  // sequence) shown alongside the base plan. Null in deterministic mode. The
  // descriptor carries everything the chart line + results card need (snaps via
  // `result`, plus line color, legend label, and explanatory blurb).
  const stressResult = useMemo(
    () =>
      plan.scenarioMode === "stress"
        ? stressTest(mainSimParams, { dropPct: plan.stressDropPct, years: plan.stressYears })
        : null,
    [mainSimParams, plan.scenarioMode, plan.stressDropPct, plan.stressYears],
  );
  const historicalResult = useMemo(
    () =>
      plan.scenarioMode === "historical"
        ? historicalSequence(mainSimParams, {
            startYear: HISTORICAL_SCENARIOS.find((s) => s.key === plan.historicalScenario)?.startYear,
            lens: plan.historicalLens,
          })
        : null,
    [mainSimParams, plan.scenarioMode, plan.historicalScenario, plan.historicalLens],
  );
  const scenario = useMemo(() => {
    if (plan.scenarioMode === "stress" && stressResult) {
      return {
        result: stressResult,
        color: "#c0392b",
        label: "Stress test",
        blurb: `Illustrative downside: the market drops ${plan.stressDropPct}% per year for the first ${plan.stressYears} retirement year${plan.stressYears > 1 ? "s" : ""}, then reverts to your mean return. Retiring into a crash is the worst case for sequence-of-returns risk.`,
      };
    }
    if (plan.scenarioMode === "historical" && historicalResult) {
      const sc = HISTORICAL_SCENARIOS.find((s) => s.key === plan.historicalScenario);
      const lensLabel = plan.historicalLens === "sp" ? "S&P 500" : "60/40 blend";
      return {
        result: historicalResult,
        color: "#7048a8",
        label: `${sc?.label ?? "Historical"} · ${lensLabel}`,
        blurb: `${sc?.blurb ?? ""} Applies the ${lensLabel} return each year to your whole portfolio; once recorded history ends it reverts to your mean return. Nominal returns — spending still inflates at your own rate.`,
      };
    }
    return null;
  }, [plan.scenarioMode, plan.stressDropPct, plan.stressYears, plan.historicalScenario, plan.historicalLens, stressResult, historicalResult]);

  // Maximize-mode analysis
  const atRetirement = useMemo(() => projectAtRetirement(plan), [plan]);
  const marginalRows = useMemo(() => (mode === "maximize" ? marginalValues(plan) : []), [plan, mode]);
  const dynamicOpt = useMemo(() => (mode === "maximize" ? dynamicOptimizer(plan) : null), [plan, mode]);

  // "Apply these conversions" — writes the recommended bracket-fill strategy into the plan inputs.
  const applyOptimized = (opt) =>
    setInputs((prev) => ({
      ...prev,
      conversionCeiling: opt.ceiling,
      conversionEndAge: opt.endAge,
      annualRothConversion: 0,
    }));

  // Clickable sensitivity levers. We snapshot `inputs` before the FIRST lever is
  // applied (the baseline) and track which levers are applied. A lever can only
  // be applied once (so it can't silently stack, e.g. +$50k munis twice = +$100k),
  // and "Undo all" reverts to the baseline in one step.
  const [leverBaseline, setLeverBaseline] = useState(null);
  const [appliedLevers, setAppliedLevers] = useState([]);
  const applyLever = (apply, label) => {
    if (appliedLevers.includes(label)) return;
    setLeverBaseline((b) => (b == null ? inputs : b));
    setAppliedLevers((list) => [...list, label]);
    setInputs((prev) => ({ ...prev, ...apply }));
  };
  const undoLevers = () => {
    if (leverBaseline) setInputs(leverBaseline);
    setLeverBaseline(null);
    setAppliedLevers([]);
  };

  // Un-gated: used in Early mode KPI chip and Maximize mode hero
  const sustainable = useMemo(() => sustainableSpend(plan), [plan]);

  // Live projection for the headline "portfolio at retirement" so it tracks the
  // slider drag (cheap — no simulation); the committed `atRetirement` still feeds
  // the Maximize rail / marginal-value analysis.
  const liveAtRetirement = useMemo(() => projectAtRetirement(livePlan), [livePlan]);
  const totalAtRetirement =
    liveAtRetirement.rothContributions +
    liveAtRetirement.rothEarnings +
    liveAtRetirement.k401 +
    liveAtRetirement.brokerage +
    liveAtRetirement.cashDeposit +
    liveAtRetirement.muniBonds +
    (liveAtRetirement.hsaBalance ?? 0);

  // ── "Ask" agent wiring (PRD: agentic chat) ──────────────────
  // Keep the latest inputs in a ref so the agent can snapshot a baseline at the
  // moment of its first mutation (powers "Undo all agent changes").
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  const askResults = useMemo(
    () => ({
      earliest,
      sustainable,
      mcSuccess: mcResult?.successRate ?? null,
      totalAtRetirement,
      survives: result ? result.depleted == null : null,
      depletionAge: result?.depleted == null ? null : Math.ceil(result.depleted),
    }),
    [earliest, sustainable, mcResult, totalAtRetirement, result],
  );

  // Write-tool actions the agent drives. setInputs is stable; onCommitAge drives
  // the Retire-at control + recompute.
  const askActions = useMemo(
    () => ({
      getInputs: () => inputsRef.current,
      applyInputs: (patch) => setInputs((prev) => ({ ...prev, ...patch })),
      applyAge: (age) => onCommitAge(age),
      applyScenario: (patch) => setInputs((prev) => ({ ...prev, ...patch })),
      restoreInputs: (snap) => setInputs(snap),
    }),
    [onCommitAge],
  );

  // The chat is a permanent right column on desktop (variant "rail") and a
  // mobile sheet. isAskEnabled() is the deploy-level kill switch (PRD §9): when
  // off, the grid drops back to two columns and the relocated detail cards /
  // sidebar levers carry the content on their own.
  const askOn = isAskEnabled();
  const askDrawer = (variant) =>
    askOn ? (
      <ChatDrawer variant={variant} inputs={inputs} plan={plan} results={askResults} actions={askActions} />
    ) : null;

  // Sensitivity levers now live in the sidebar's Fine-tuning group (moved out of
  // the old right rail, which the chat replaced).
  const leverProps = {
    sensitivityRows,
    appliedLevers,
    onApplyLever: applyLever,
    onUndoLevers: undoLevers,
  };

  // ── Mobile (≤767px): a dedicated single-column shell fed the same props.
  // All hooks above run unconditionally, so this early return is hook-safe.
  if (isMobile) {
    return (
      <>
        <MobileShell
          mode={mode}
          setMode={setMode}
          tabs={TABS}
          inputs={inputs}
          set={set}
          plan={livePlan}
          earliest={earliest}
          onScrubAge={onScrubAge}
          onCommitAge={onCommitAge}
          result={result}
          mcResult={mcResult}
          scenario={scenario}
          totalAtRetirement={totalAtRetirement}
          sustainable={sustainable}
          retireBy={retireBy}
          sensitivityRows={sensitivityRows}
          applyLever={applyLever}
          appliedLevers={appliedLevers}
          undoLevers={undoLevers}
          atRetirement={atRetirement}
          marginalRows={marginalRows}
          dynamicOpt={dynamicOpt}
          applyOptimized={applyOptimized}
          onRunMc={() => setMaxMcOn(true)}
        />
        {showQuickStart && <QuickStart onApply={applyQuickStart} onSkip={dismissQuickStart} />}
        {askDrawer("sheet")}
      </>
    );
  }

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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap'); input[type=number]::-webkit-inner-spin-button{opacity:.4} *{box-sizing:border-box}
        @keyframes agePop { 0%{transform:scale(1.28)} 55%{transform:scale(.94)} 100%{transform:scale(1)} }
        @keyframes sparkPop { 0%{transform:scale(.5);opacity:0} 45%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @media (prefers-reduced-motion: reduce){ .age-pop,.spark-pop,.floaty{animation:none !important} }`}</style>

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
          <span>age {inputs.currentAge}</span>
          <span style={{ color: "#7ecfbb" }}>{fmt(totalAtRetirement)}</span>
          <span>{fmt(livePlan.monthlyAtRetirement)}/mo</span>
        </div>
      </div>

      {/* ── Workspace: sidebar │ center │ permanent chat rail ──────
          Col 3 is the always-on chat (all tabs, one mount so the transcript
          survives tab switches). When the Ask flag is off it collapses to two
          columns and the relocated cards/levers stand on their own. */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: askOn ? "400px 1fr 340px" : "400px 1fr",
          gap: "1px",
          background: "#e2e8e6",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left column: Retire-at command card pinned under the navbar, then the
            accordion inputs below it (both always visible, all tabs). */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "#fafcfc" }}>
          <RetireAtControl
            value={livePlan.retireAge}
            min={plan.currentAge}
            max={80}
            earliest={earliest}
            onScrub={onScrubAge}
            onCommit={onCommitAge}
          />
          {/* flex:1 + minHeight:0 gives InputsSidebar's height:100% a definite
              height so its pinned bottom caption isn't pushed off-screen. */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <InputsSidebar inputs={inputs} set={set} plan={livePlan} levers={leverProps} />
          </div>
        </div>

        {mode === "docs" ? (
          <div style={{ gridColumn: 2, background: "#f0f5f4", overflowY: "auto", padding: "28px 36px" }}>
            <DocsPanel />
          </div>
        ) : mode === "advice" ? (
          <div style={{ gridColumn: 2, background: "#f0f5f4", overflowY: "auto", padding: "28px 36px" }}>
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
        ) : (
          /* Center column: the results panel (the Retire-at control now lives
             pinned at the top of the left sidebar). */
          <div style={{ gridColumn: 2, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              {!result ? (
                <div style={{ height: "100%", background: "#f0f5f4", display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 36px" }}>
                  <div style={{ maxWidth: 360, textAlign: "center", background: "#fff", borderRadius: 14, padding: "24px 28px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c97c1a", marginBottom: 8 }}>
                      Check the retirement age
                    </div>
                    <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
                      Your retire age ({livePlan.retireAge}) must be at least your current age ({inputs.currentAge}).
                      Nudge the slider in the sidebar, or lower Your age there.
                    </div>
                  </div>
                </div>
              ) : mode === "early" ? (
                <EarlyPanel
                  plan={livePlan}
                  result={result}
                  earliest={earliest}
                  mcResult={mcResult}
                  scenario={scenario}
                  totalAtRetirement={totalAtRetirement}
                  sustainable={sustainable}
                  retireBy={retireBy}
                />
              ) : (
                <MaximizeCenter
                  plan={livePlan}
                  result={result}
                  totalAtRetirement={totalAtRetirement}
                  sustainable={sustainable}
                  dynamicOpt={dynamicOpt}
                  onApplyOptimized={applyOptimized}
                  scenario={scenario}
                  mcResult={mcResult}
                  onRunMc={() => setMaxMcOn(true)}
                  atRetirement={atRetirement}
                  marginalRows={marginalRows}
                />
              )}
            </div>
          </div>
        )}

        {/* Col 3: permanent chat rail (all tabs). */}
        {askOn && (
          <div style={{ gridColumn: 3, minHeight: 0, overflow: "hidden" }}>
            {askDrawer("rail")}
          </div>
        )}
      </div>

      {showQuickStart && <QuickStart onApply={applyQuickStart} onSkip={dismissQuickStart} />}
    </div>
  );
}
