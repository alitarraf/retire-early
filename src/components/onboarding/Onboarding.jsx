// Multi-page first-run onboarding. Replaces the single QuickStart popup with a
// forked wizard (working vs already-retired) that captures the high-signal
// spine — crucially the REAL account mix — plus optional depth, while a live
// result strip recomputes the verdict on every answer. Spec:
// docs/PRD_Onboarding_July2026.md. Same contract as QuickStart: onApply(vals)
// merges into inputs, onSkip() dismisses. Rendered as a fixed overlay in both
// the desktop and mobile shells, so one component serves both.
import { useMemo, useState } from "react";
import { DEFAULTS, makePlan, runMain } from "../../analysis/plan.js";
import { earliestRetireAge } from "../../analysis/earliestRetireAge.js";
import { STEPS } from "./steps.jsx";
import { GREEN, MINT, MUTE } from "./parts.jsx";

export function Onboarding({ initial, onApply, onSkip }) {
  // Working copy seeded from current inputs; every step mutates it in place and
  // onApply hands the whole object back (merge semantics preserved in App).
  const [vals, setVals] = useState(() => ({ ...DEFAULTS, ...(initial || {}) }));
  const set = (key) => (v) => setVals((p) => ({ ...p, [key]: v }));
  const setMany = (obj) => setVals((p) => ({ ...p, ...obj }));

  const [stepIdx, setStepIdx] = useState(0);
  const retired = !!vals.alreadyRetired;

  // The still-saving step is meaningless once retired — drop it from the flow.
  const steps = useMemo(
    () => STEPS.filter((s) => !(s.id === "saving" && retired)),
    [retired]
  );
  const step = steps[Math.min(stepIdx, steps.length - 1)];

  // Live verdict — same engine the app's headline uses, so they never disagree.
  const livePlan = useMemo(() => {
    try { return makePlan(vals); } catch { return null; }
  }, [vals]);
  const result = useMemo(() => (livePlan ? runMain(livePlan) : null), [livePlan]);
  const earliest = useMemo(
    () => (livePlan && !retired ? earliestRetireAge(livePlan) : null),
    [livePlan, retired]
  );
  const depletionAge = result?.depleted == null ? null : Math.ceil(result.depleted);
  const live = { plan: livePlan, result, earliest, depletionAge, retired };

  const go = (delta) => setStepIdx((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
  const goToId = (id) => {
    const i = steps.findIndex((s) => s.id === id);
    if (i >= 0) setStepIdx(i);
  };
  const finish = () => {
    // Drop wizard-internal bookkeeping keys before they reach the plan inputs.
    const clean = { ...vals };
    delete clean.__stageChosen;
    onApply(clean);
  };
  const nav = { go, goToId, finish, skip: onSkip, stepIdx, total: steps.length };

  // Progress bar reflects only the data-capture spine (bar:true steps).
  const barSteps = steps.filter((s) => s.bar);
  const barPos = step.bar ? barSteps.findIndex((s) => s.id === step.id) + 1 : 0;

  const Body = step.Body;

  return (
    <div style={overlay}>
      <div style={card}>
        {step.bar && (
          <div style={{ padding: "16px 26px 0" }}>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${(barPos / barSteps.length) * 100}%` }} />
            </div>
            <div style={{ fontSize: 10, color: MUTE, marginTop: 6, fontWeight: 600 }}>
              Step {barPos} of {barSteps.length}
            </div>
          </div>
        )}

        {step.strip && <LiveStrip live={live} />}

        <div style={bodyScroll}>
          {stepIdx > 0 && step.back !== false && (
            <button onClick={() => go(-1)} style={backBtn}>← Back</button>
          )}
          <Body vals={vals} set={set} setMany={setMany} nav={nav} live={live} />
        </div>

        <div style={footer}>Educational planning tool — not financial advice.</div>
      </div>
    </div>
  );
}

// Slim, always-honest verdict bar pinned below the progress bar.
function LiveStrip({ live }) {
  const { retired, earliest, depletionAge, plan } = live;
  const lifeExpect = plan?.lifeExpect ?? 85;
  const safe = depletionAge == null; // survives to life expectancy
  const dot = safe ? MINT : "#e0a458";

  let text;
  if (retired) {
    text = safe
      ? <>Your money lasts <strong style={{ color: GREEN }}>past {lifeExpect}</strong></>
      : <>Your money lasts to <strong style={{ color: GREEN }}>age {depletionAge}</strong></>;
  } else {
    text = earliest == null
      ? <>No safe retirement age found yet — keep going</>
      : <>You could retire as early as <strong style={{ color: GREEN }}>age {earliest}</strong>{safe ? "" : ` · funds run low at ${depletionAge}`}</>;
  }

  return (
    <div style={strip}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "#4a5e58" }}>{text}</span>
      <span style={{ marginLeft: "auto", fontSize: 9, color: "#9db4ae", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Live
      </span>
    </div>
  );
}

/* ---- shell styles ---- */
const overlay = {
  position: "fixed", inset: 0, zIndex: 100, background: "rgba(26,46,40,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  fontFamily: "'Inter', system-ui, sans-serif",
};
const card = {
  background: "#fff", borderRadius: 18, width: 480, maxWidth: "100%", maxHeight: "92vh",
  display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", overflow: "hidden",
};
const bodyScroll = { padding: "18px 26px 8px", overflowY: "auto", flex: 1 };
const footer = { fontSize: 9, color: "#9db4ae", textAlign: "center", padding: "10px 0 14px" };
const backBtn = { border: "none", background: "transparent", color: MUTE, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 0 12px", marginLeft: -2 };
const progressTrack = { height: 4, background: "#e2e8e6", borderRadius: 2, overflow: "hidden" };
const progressFill = { height: "100%", background: MINT, borderRadius: 2, transition: "width 0.3s ease" };
const strip = { display: "flex", alignItems: "center", gap: 8, padding: "10px 26px", background: "#f2f7f5", borderTop: "1px solid #e8f0ed", borderBottom: "1px solid #e8f0ed" };
