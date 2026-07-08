// Step bodies for the onboarding wizard. Each Body receives
// { vals, set, setMany, nav, live } and renders its own CTA(s) via CtaRow.
// STEPS (bottom) is the ordered registry the orchestrator walks; the "saving"
// step is filtered out when already-retired. All components are top-level so
// React preserves input focus across keystrokes.
import { useEffect, useState } from "react";
import { NumInput, Select, Toggle } from "../ui.jsx";
import { StreamEditor, OneTimeExpenses } from "../panels/inputs/atoms.jsx";
import { fmtK } from "../../format.js";
import { FILING_STATUS, FILING_STATUS_LABELS, STATE_TAXES } from "../../constants/brackets.js";
import { allocationAt, RISK_PROFILE_KEYS, RISK_PROFILES } from "../../engine/allocation.js";
import { GlideBand } from "../panels/AllocationCard.jsx";
import { StepTitle, OptionCard, WizField, Guide, CtaRow, lbl, GREEN, MINT, MUTE } from "./parts.jsx";

const filingOptions = Object.values(FILING_STATUS).map((v) => ({ value: v, label: FILING_STATUS_LABELS[v] }));
const stateOptions = STATE_TAXES.map((s) => ({ value: s.name, label: s.name }));

/* 1 — Welcome */
function Welcome({ nav }) {
  return (
    <div>
      <StepTitle
        eyebrow="Start here"
        title="See exactly when your money runs out — and what to do about it."
        sub="A tax-accurate picture of your retirement in about two minutes. Answer a few questions and watch your plan come alive."
      />
      <div style={{ background: "#f2f7f5", borderRadius: 12, padding: "20px 16px", textAlign: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 34 }}>📈</div>
        <div style={{ fontSize: 12, color: MUTE, marginTop: 6 }}>Your plan, projected month by month.</div>
      </div>
      <CtaRow
        primary="Build my plan →"
        onPrimary={() => nav.go(1)}
        secondary="Skip"
        onSecondary={nav.skip}
      />
    </div>
  );
}

/* 2 — Life stage (the fork) */
function Stage({ vals, setMany, nav }) {
  const [chosen, setChosen] = useState(vals.__stageChosen || null);
  const pick = (which) => {
    setChosen(which);
    if (which === "retired") setMany({ alreadyRetired: true, retireAge: vals.currentAge, __stageChosen: which });
    else setMany({ alreadyRetired: false, __stageChosen: which });
  };
  const onAge = (v) =>
    setMany(vals.alreadyRetired ? { currentAge: v, retireAge: v } : { currentAge: v });

  return (
    <div>
      <StepTitle title="Where are you right now?" sub="This shapes everything that follows." />
      <OptionCard emoji="💼" title="Still working" sub="Building toward retirement" selected={chosen === "working"} onClick={() => pick("working")} />
      <OptionCard emoji="🌅" title="Already retired" sub="Living off my savings" selected={chosen === "retired"} onClick={() => pick("retired")} />
      <WizField label="I'm ___ years old">
        <NumInput value={vals.currentAge} onChange={onAge} min={25} max={90} width={80} />
      </WizField>
      <CtaRow primary="Continue →" onPrimary={() => nav.go(1)} primaryDisabled={!chosen || !vals.currentAge} />
    </div>
  );
}

/* 3 — About you */
function About({ vals, set, setMany, nav }) {
  const isMFJ = vals.filingStatus === FILING_STATUS.MFJ;
  return (
    <div>
      <StepTitle title="A little about your household." sub="Your filing status and state change how every dollar is taxed — this is what makes Reti accurate." />
      <WizField label="Filing status">
        <Select value={vals.filingStatus} onChange={set("filingStatus")} options={filingOptions} width={220} />
      </WizField>
      <WizField label="Spouse or partner in the plan?">
        <Toggle
          value={vals.hasSpouse ? "yes" : "no"}
          onChange={(v) => setMany({ hasSpouse: v === "yes" })}
          options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
        />
      </WizField>
      {vals.hasSpouse && (
        <WizField label="Spouse claims Social Security at age" hint="You'll enter the benefit amount in a moment.">
          <NumInput value={vals.spouseSsAge} onChange={set("spouseSsAge")} min={62} max={70} width={70} />
        </WizField>
      )}
      <WizField label="People in your household" hint="Everyone your budget supports — used for healthcare subsidy math.">
        <NumInput value={vals.householdSize} onChange={set("householdSize")} min={1} max={10} width={70} />
      </WizField>
      <WizField label="State">
        <Select value={vals.stateKey} onChange={set("stateKey")} options={stateOptions} width={220} />
      </WizField>
      <Guide>Some states don't tax retirement income at all — Reti knows the difference.</Guide>
      <CtaRow primary="Continue →" onPrimary={() => nav.go(1)} />
    </div>
  );
}

/* 4 — Your money (account mix) */
const BUCKETS = [
  { key: "k401Today", emoji: "🏦", label: "401(k) / Traditional IRA", hint: "Pre-tax — taxed as income when you withdraw." },
  { key: "rothTotal", emoji: "🌱", label: "Roth IRA / Roth 401(k)", hint: "Already taxed — grows and comes out tax-free." },
  { key: "existingBrokerage", emoji: "📈", label: "Taxable brokerage", hint: "You're taxed only on the gains, at lower rates." },
  { key: "cashDeposit", emoji: "💵", label: "Cash / CDs / savings", hint: null },
  { key: "hsaBalance", emoji: "🩺", label: "HSA", hint: "Triple tax-free for medical costs." },
  { key: "muniBonds", emoji: "🏛️", label: "Municipal bonds", hint: "Interest is federally tax-free." },
];

function Money({ vals, set, setMany, nav }) {
  const [revealed, setRevealed] = useState(() => {
    const nz = BUCKETS.filter((b) => (vals[b.key] || 0) > 0).map((b) => b.key);
    // Always start with at least the core three so the screen isn't empty.
    const core = ["k401Today", "rothTotal", "existingBrokerage"];
    return new Set([...core, ...nz]);
  });
  const shown = BUCKETS.filter((b) => revealed.has(b.key));
  const hidden = BUCKETS.filter((b) => !revealed.has(b.key));
  const total = BUCKETS.reduce((s, b) => s + (vals[b.key] || 0), 0);

  const onBrokerage = (v) => {
    // Keep basis in step with the balance until the user overrides it.
    const syncBasis = (vals.existingBrokerageBasis || 0) === (vals.existingBrokerage || 0);
    setMany(syncBasis ? { existingBrokerage: v, existingBrokerageBasis: v } : { existingBrokerage: v });
  };

  return (
    <div>
      <StepTitle title="What have you saved — and where?" sub="These accounts are taxed very differently. Splitting them out is the single thing that makes your answer real instead of a guess." />
      {shown.map((b) => (
        <div key={b.key} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{b.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{b.label}</div>
              {b.hint && <div style={{ fontSize: 10.5, color: "#9db4ae" }}>{b.hint}</div>}
            </div>
            <NumInput
              value={vals[b.key]}
              onChange={b.key === "existingBrokerage" ? onBrokerage : set(b.key)}
              prefix="$"
              step={10000}
              width={120}
            />
          </div>
          {b.key === "existingBrokerage" && (vals.existingBrokerage || 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginLeft: 28 }}>
              <span style={{ fontSize: 10.5, color: MUTE }}>What did you pay for it? (cost basis)</span>
              <NumInput value={vals.existingBrokerageBasis} onChange={set("existingBrokerageBasis")} prefix="$" step={10000} width={110} />
            </div>
          )}
        </div>
      ))}

      {hidden.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 0 10px" }}>
          {hidden.map((b) => (
            <button
              key={b.key}
              onClick={() => setRevealed((s) => new Set(s).add(b.key))}
              style={{ border: "1px dashed #c8d6d1", background: "transparent", color: MUTE, fontSize: 11.5, fontWeight: 600, borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}
            >
              + {b.emoji} {b.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8e6", paddingTop: 12, marginTop: 6 }}>
        <span style={lbl}>Total saved</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: GREEN, fontFamily: "'JetBrains Mono', monospace" }}>{fmtK(total)}</span>
      </div>
      <CtaRow primary="Continue →" onPrimary={() => nav.go(1)} />
    </div>
  );
}

/* 5 — Still saving (working only) */
function Saving({ vals, set, nav }) {
  return (
    <div>
      <StepTitle title="How fast are you building it?" sub="Your savings between now and retirement." />
      <WizField label="I plan to retire at age" hint="You can change this anytime — Reti will also tell you the earliest age that's safe.">
        <NumInput value={vals.retireAge} onChange={set("retireAge")} min={vals.currentAge + 1} max={80} width={80} />
      </WizField>
      <WizField label="Annual salary">
        <NumInput value={vals.salary} onChange={set("salary")} prefix="$" step={5000} width={130} />
      </WizField>
      <WizField label="Into my 401(k) each year">
        <NumInput value={vals.k401AnnualContrib} onChange={set("k401AnnualContrib")} prefix="$" step={1000} width={120} />
      </WizField>
      <WizField label="Employer match (% of salary)">
        <NumInput value={vals.employerMatchPct} onChange={set("employerMatchPct")} suffix="%" step={1} max={25} width={70} />
      </WizField>
      <Guide>The match is free money — most people should grab all of it before anything else.</Guide>
      <WizField label="Into my Roth each year">
        <NumInput value={vals.rothAnnualContrib} onChange={set("rothAnnualContrib")} prefix="$" step={500} width={120} />
      </WizField>
      <WizField label="Into brokerage each month" hint="Optional — leave at 0 if none.">
        <NumInput value={vals.brokerageMonthlyContrib} onChange={set("brokerageMonthlyContrib")} prefix="$" step={100} width={120} />
      </WizField>
      <CtaRow primary="Continue →" onPrimary={() => nav.go(1)} />
    </div>
  );
}

/* 6 — Spending & Social Security */
function SpendSS({ vals, set, nav }) {
  return (
    <div>
      <StepTitle title="What will retirement cost — and what will Social Security cover?" />
      <WizField label="Monthly spending in retirement" hint="In today's dollars. Most people underestimate healthcare — you can add that in a moment.">
        <NumInput value={vals.monthlyExpense} onChange={set("monthlyExpense")} prefix="$" step={250} width={130} />
      </WizField>
      <WizField label="Your Social Security (monthly)" hint="Don't know it? Grab your real number from ssa.gov — typical is $1,500–$3,000/mo.">
        <NumInput value={vals.ssBenefit} onChange={set("ssBenefit")} prefix="$" step={100} width={120} />
      </WizField>
      <WizField label="You claim Social Security at age">
        <NumInput value={vals.ssAge} onChange={set("ssAge")} min={62} max={70} width={70} />
      </WizField>
      {vals.hasSpouse && (
        <WizField label="Spouse's Social Security (monthly)">
          <NumInput value={vals.spouseSsBenefit} onChange={set("spouseSsBenefit")} prefix="$" step={100} width={120} />
        </WizField>
      )}
      <CtaRow primary="See my plan →" onPrimary={() => nav.go(1)} />
    </div>
  );
}

/* 7 — Building your plan → the reveal */
function Reveal({ vals, nav, live }) {
  const [phase, setPhase] = useState("processing");
  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 1300);
    return () => clearTimeout(t);
  }, []);

  const { retired, earliest, depletionAge, plan } = live;
  const lifeExpect = plan?.lifeExpect ?? 85;
  const safe = depletionAge == null;

  if (phase === "processing") {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 40, animation: "pulse 1s ease-in-out infinite" }}>🌱</div>
        <div style={{ fontSize: 14, color: MUTE, marginTop: 14 }}>Running your plan, month by month…</div>
        <style>{`@keyframes pulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.05)}}`}</style>
      </div>
    );
  }

  let big, subline;
  if (retired) {
    big = safe ? `Your money lasts past ${lifeExpect}.` : `Your money lasts to age ${depletionAge}.`;
    subline = `Based on ${fmtK(vals.monthlyExpense)}/mo and everything you told us.`;
  } else if (earliest == null) {
    big = "Retirement isn't safe yet at these numbers.";
    subline = "Add detail or adjust your inputs — Reti will show you what closes the gap.";
  } else {
    big = `You could retire as early as ${earliest}.`;
    subline = earliest <= vals.retireAge
      ? `Retiring at ${vals.retireAge}? You've got it.`
      : `You're targeting ${vals.retireAge} — a bit more gets you there.`;
  }

  return (
    <div>
      <StepTitle eyebrow="Your plan" title={big} sub={subline} />
      <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        <StatChip label={retired ? "Money lasts to" : "Earliest safe age"} value={retired ? (safe ? `${lifeExpect}+` : `${depletionAge}`) : (earliest ?? "—")} />
        <StatChip label="Planning horizon" value={`age ${lifeExpect}`} />
      </div>
      <div style={{ fontSize: 12, color: MUTE, margin: "16px 0 0", lineHeight: 1.5 }}>
        This updates the instant you change anything. Want it sharper?
      </div>
      <CtaRow
        primary="Sharpen my plan →"
        onPrimary={() => nav.goToId("depth")}
        secondary="Take me to the app"
        onSecondary={nav.finish}
      />
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{ flex: 1, background: "#f2f7f5", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTE }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: GREEN, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  );
}

/* 8 — Sharpen it (optional depth menu) */
function Depth({ vals, set, setMany, nav }) {
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen((o) => (o === id ? null : id));
  const startAge = vals.retireAge || vals.currentAge;

  return (
    <div>
      <StepTitle title="Want a sharper plan?" sub="Add any of these, or skip them all and refine later in the sidebar. Each takes under a minute." />

      <DepthCard emoji="🩺" title="Healthcare before Medicare" open={open === "hc"} onToggle={() => toggle("hc")}>
        <WizField label="Benchmark silver premium (monthly)" hint="Full unsubsidized cost; Reti applies ACA subsidies on top.">
          <NumInput value={vals.monthlyAcaFullPremium} onChange={set("monthlyAcaFullPremium")} prefix="$" step={50} width={110} />
        </WizField>
        <WizField label="Income-test my Medicare (IRMAA) at 65+">
          <Toggle value={vals.autoMedicare ? "on" : "off"} onChange={(v) => setMany({ autoMedicare: v === "on" })} options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]} />
        </WizField>
      </DepthCard>

      <DepthCard emoji="💰" title="Pension, annuity or part-time income" open={open === "inc"} onToggle={() => toggle("inc")}>
        <div style={lbl}>Income streams</div>
        <StreamEditor value={vals.incomeStreams} onChange={set("incomeStreams")} kind="income" defaultStartAge={startAge} />
        <div style={{ ...lbl, marginTop: 12 }}>Costs that end (mortgage, loans)</div>
        <StreamEditor value={vals.expenseStreams} onChange={set("expenseStreams")} kind="expense" defaultStartAge={startAge} />
      </DepthCard>

      <DepthCard emoji="🧾" title="Taxes & Roth conversions" open={open === "tax"} onToggle={() => toggle("tax")}>
        <WizField label="Roth conversion per year" hint="Converting in low-income years can save six figures in lifetime tax.">
          <NumInput value={vals.annualRothConversion} onChange={set("annualRothConversion")} prefix="$" step={5000} width={120} />
        </WizField>
        <WizField label="State taxes Social Security?">
          <Toggle value={vals.stateSsExemptRate >= 1 ? "no" : "yes"} onChange={(v) => setMany({ stateSsExemptRate: v === "no" ? 1 : 0 })} options={[{ value: "yes", label: "Taxed" }, { value: "no", label: "Exempt" }]} />
        </WizField>
      </DepthCard>

      <DepthCard emoji="📉" title="Spending phases" open={open === "phase"} onToggle={() => toggle("phase")}>
        <Guide>Most people spend more early ("go-go years") and less later. 1.0 = flat.</Guide>
        <WizField label="Go-go multiplier (now → 70)"><NumInput value={vals.goGoMult} onChange={set("goGoMult")} step={0.05} width={80} /></WizField>
        <WizField label="Slow-go multiplier (70 → 80)"><NumInput value={vals.slowGoMult} onChange={set("slowGoMult")} step={0.05} width={80} /></WizField>
        <WizField label="No-go multiplier (80+)"><NumInput value={vals.noGoMult} onChange={set("noGoMult")} step={0.05} width={80} /></WizField>
      </DepthCard>

      <DepthCard emoji="📊" title="Market assumptions" open={open === "mkt"} onToggle={() => toggle("mkt")}>
        <WizField label="Stock return (%/yr)"><NumInput value={vals.stockReturn} onChange={set("stockReturn")} suffix="%" step={0.5} width={80} /></WizField>
        <WizField label="Inflation (%/yr)"><NumInput value={vals.inflationRate} onChange={set("inflationRate")} suffix="%" step={0.25} width={80} /></WizField>
      </DepthCard>

      <DepthCard emoji="🎁" title="Leave an estate" open={open === "est"} onToggle={() => toggle("est")}>
        <WizField label="Estate goal at death (today's $)" hint="Reti shows the gap between your plan and this target.">
          <NumInput value={vals.legacyTarget} onChange={set("legacyTarget")} prefix="$" step={50000} width={130} />
        </WizField>
      </DepthCard>

      <DepthCard emoji="🌊" title="One-time events & windfalls" open={open === "one"} onToggle={() => toggle("one")}>
        <Guide>A negative amount is a windfall — inheritance, downsizing proceeds — banked into cash.</Guide>
        <OneTimeExpenses value={vals.oneTimeExpenses} onChange={set("oneTimeExpenses")} defaultAge={startAge} />
      </DepthCard>

      <CtaRow primary="Done — see my plan →" onPrimary={() => nav.goToId("askpro")} />
    </div>
  );
}

function DepthCard({ emoji, title, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${open ? MINT : "#e2e8e6"}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: open ? "rgba(126,207,187,0.10)" : "#fff", border: "none", cursor: "pointer", padding: "14px 16px", textAlign: "left" }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: GREEN }}>{title}</span>
        <span style={{ fontSize: 16, color: MUTE }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ padding: "4px 16px 16px" }}>{children}</div>}
    </div>
  );
}

/* 9 — Ask Reti (soft Ask Pro) */
function AskPro({ nav }) {
  return (
    <div>
      <StepTitle title="Now ask it anything." sub="Reti's chat answers in plain English and runs the numbers on your exact plan." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {["When should I take Social Security?", "What if the market drops 30% my first year?", "Can I afford to spend more?"].map((q) => (
          <div key={q} style={{ background: "#f2f7f5", borderRadius: 10, padding: "11px 14px", fontSize: 12.5, color: "#4a5e58" }}>“{q}”</div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 4, lineHeight: 1.5 }}>
        A few questions are free every day — <strong style={{ color: GREEN }}>Ask Pro</strong> removes the limit.
      </div>
      <CtaRow primary="Explore my plan →" onPrimary={nav.finish} />
    </div>
  );
}

/* 6.5 — How your money is invested (teaching step, before the reveal) */
const AllocSwatch = ({ color, opacity = 1 }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color, opacity, marginRight: 5 }} />
);

function Allocate({ vals, setMany, nav }) {
  const on = !!vals.allocationEnabled;
  const bandPlan = { ...vals, lifeExpect: vals.lifeExpect ?? 90, pinAllocation: vals.pinAllocation ?? false };
  const mix = allocationAt(bandPlan, vals.currentAge ?? 40);
  const pc = (f) => Math.round(f * 100);
  return (
    <div>
      <StepTitle
        title="How should your money be invested?"
        sub="Your mix of stocks, bonds and cash — and how it eases from growth toward safety as you age."
      />

      {/* Signature: the same glide band you'll see on your results. */}
      <div style={{ background: "#fff", border: "1px solid #e2e8e6", borderRadius: 12, padding: 14, marginBottom: 14, opacity: on ? 1 : 0.55 }}>
        <GlideBand plan={bandPlan} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: MUTE, marginTop: 8 }}>
          <span><AllocSwatch color={GREEN} />Stocks {pc(mix.equity)}%</span>
          <span><AllocSwatch color={MINT} />Bonds {pc(mix.bond)}%</span>
          <span><AllocSwatch color={MUTE} opacity={0.55} />Cash {pc(mix.cash)}%</span>
          <span style={{ marginLeft: "auto" }}>today → age {bandPlan.lifeExpect}</span>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: "#4a5e58", lineHeight: 1.6, marginBottom: 14 }}>
        <div>More <strong style={{ color: GREEN }}>stocks</strong> → retire sooner, but a rougher ride.</div>
        <div>More <strong style={{ color: "#3d8c78" }}>bonds</strong> → steadier, usually a bit later.</div>
      </div>

      <WizField label="Model a glide path?" hint="A target-date approach — heavier in stocks now, easing into bonds as you age.">
        <Toggle
          value={on ? "on" : "off"}
          onChange={(v) => setMany({ allocationEnabled: v === "on" })}
          options={[{ value: "off", label: "Keep it simple" }, { value: "on", label: "Model it" }]}
        />
      </WizField>
      {on && (
        <WizField label="Pick your risk profile">
          <Toggle
            value={vals.riskProfile}
            onChange={(v) => setMany({ riskProfile: v, pinAllocation: false })}
            options={RISK_PROFILE_KEYS.map((k) => ({ value: k, label: RISK_PROFILES[k].label }))}
          />
        </WizField>
      )}
      <Guide>Not sure? Moderate is a sensible default — you can change it anytime, and Reti shows how each choice moves your retirement age.</Guide>
      <CtaRow primary="Continue →" onPrimary={() => nav.go(1)} />
    </div>
  );
}

export const STEPS = [
  { id: "welcome", Body: Welcome, bar: false, strip: false, back: false },
  { id: "stage", Body: Stage, bar: true, strip: false },
  { id: "about", Body: About, bar: true, strip: false },
  { id: "money", Body: Money, bar: true, strip: true },
  { id: "saving", Body: Saving, bar: true, strip: true },
  { id: "spendss", Body: SpendSS, bar: true, strip: true },
  { id: "allocate", Body: Allocate, bar: true, strip: true },
  { id: "reveal", Body: Reveal, bar: false, strip: false, back: false },
  { id: "depth", Body: Depth, bar: false, strip: true },
  { id: "askpro", Body: AskPro, bar: false, strip: false },
];
