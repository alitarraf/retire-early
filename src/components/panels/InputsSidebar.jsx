// Two-tier accordion sidebar. Essentials (You · Money · Spending ·
// Assumptions) are always shown; the optimization sections live under a
// collapsed "Fine-tuning (optional)" group. One section open at a time;
// closed sections show a monospace inline summary. A caption + disclaimer
// bar is pinned at the bottom. Field labels carry an InfoDot tooltip
// sourced from constants/fieldHelp.js.
//
// Each section's *fields* live in a standalone body component (YouFields,
// MoneyFields, …) keyed in the exported INPUT_SECTIONS map. The desktop
// accordion below renders those bodies inside AccSections; the mobile shell
// renders a single body on its own (no accordion chrome) driven by the bottom
// nav. One source of truth for the fields, two layouts.
import { useState } from "react";
import { NumInput, Select, Toggle, InfoDot } from "../ui.jsx";
import { BracketBar } from "../charts/BracketBar.jsx";
import { marginalFedRate } from "../../engine/tax.js";
import { fraForBirthYear } from "../../engine/socialSecurity.js";
import {
  STATE_TAXES, EMPLOYMENT_BRACKETS, LTCG_RATES, CONTRIB_LIMITS,
  FILING_STATUS, FILING_STATUS_LABELS, TAX_YEAR, FED_BRACKETS,
} from "../../constants/brackets.js";
import { FIELD_HELP } from "../../constants/fieldHelp.js";
import { HISTORICAL_SCENARIOS } from "../../constants/historicalReturns.js";
import { fmt, fmtK, pct } from "../../format.js";

// ─── Module-scope layout atoms ───────────────────────────────

function Field({ label, hint, help, children }) {
  const h = help ? FIELD_HELP[help] : null;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#7C9A92", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        {h && <InfoDot context={h.context} typical={h.typical} />}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 2 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Grid2({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
      {children}
    </div>
  );
}

function Grid3({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 4 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #e2e8e6", margin: "10px 0" }} />;
}

function SubTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5aada0", marginBottom: 7, marginTop: 2 }}>
      {children}
    </div>
  );
}

// One-click chip that fills a capped contribution to its IRS limit.
function MaxChip({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Set to the annual IRS limit"
      style={{
        border: "1px solid #b9d2ca",
        background: "#eef5f2",
        color: "#3d8c78",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 10,
        fontWeight: 700,
        padding: "5px 8px",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      Max
    </button>
  );
}

// Small banner that labels a tier of sections.
function GroupLabel({ children }) {
  return (
    <div style={{ padding: "9px 16px 6px", background: "#fafcfc", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9db4ae" }}>
      {children}
    </div>
  );
}

function AccSection({ title, summary, isOpen, onToggle, children }) {
  return (
    <div style={{ borderBottom: "1px solid #e2e8e6" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          cursor: "pointer",
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: isOpen ? "#1a2e28" : "#fafcfc",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: isOpen ? "#fff" : "#1a2e28", flexShrink: 0, minWidth: 70 }}>
          {title}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: isOpen ? "#7ecfbb" : "#9db4ae",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <span style={{ fontSize: 13, color: isOpen ? "#7ecfbb" : "#9db4ae", flexShrink: 0, lineHeight: 1 }}>
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: "14px 16px 16px", background: "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Header that reveals/hides the optional fine-tuning sections.
function FineTuningHeader({ isOpen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%",
        border: "none",
        borderTop: "1px solid #e2e8e6",
        borderBottom: isOpen ? "1px solid #e2e8e6" : "none",
        cursor: "pointer",
        padding: "11px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#f0f5f4",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5aada0", flexShrink: 0 }}>
        Fine-tuning <span style={{ color: "#9db4ae" }}>(optional)</span>
      </span>
      <span style={{ flex: 1, fontSize: 11, color: "#9db4ae", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isOpen ? "" : "Taxes · Strategy · Healthcare · Estate · Advanced · Scenario"}
      </span>
      <span style={{ fontSize: 13, color: "#5aada0", flexShrink: 0, lineHeight: 1 }}>{isOpen ? "−" : "+"}</span>
    </button>
  );
}

// Repeater for one-time / lump-sum expenses: an editable list of { age, amount }.
function OneTimeExpenses({ value, onChange, defaultAge }) {
  const list = value ?? [];
  const update = (i, patch) => onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...list, { age: defaultAge, amount: 25000 }]);
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  return (
    <div>
      {list.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#7C9A92", flexShrink: 0 }}>at age</span>
          <NumInput value={e.age} onChange={(v) => update(i, { age: v })} min={1} max={105} width={48} />
          <NumInput value={e.amount} onChange={(v) => update(i, { amount: v })} prefix="$" step={5000} width={88} />
          <button
            onClick={() => remove(i)}
            style={{ border: "none", background: "#f0f5f4", color: "#c0392b", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1, width: 24, height: 26, flexShrink: 0 }}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ border: "1px dashed #9db4ae", background: "#fafcfc", color: "#3d8c78", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px", marginTop: 2 }}
      >
        + Add one-time expense
      </button>
    </div>
  );
}

// ─── Section field bodies (shared by the desktop accordion + mobile) ─────────

function YouFields({ inputs, set, plan }) {
  const isMFJ = inputs.filingStatus === FILING_STATUS.MFJ;
  return (
    <>
      <Field label="Filing status" help="filingStatus">
        <Select
          value={inputs.filingStatus}
          onChange={set("filingStatus")}
          width={320}
          options={Object.values(FILING_STATUS).map((v) => ({ value: v, label: FILING_STATUS_LABELS[v] }))}
        />
      </Field>
      {/* "Retire at" is the pinned control at the top of the sidebar — not duplicated here. */}
      <Grid2>
        <Field label="Your age" help="currentAge">
          <NumInput value={inputs.currentAge} onChange={set("currentAge")} min={18} max={80} width={78} />
        </Field>
        <Field label="Live to" help="lifeExpect">
          <NumInput value={inputs.lifeExpect} onChange={set("lifeExpect")} min={plan.retireAge + 1} max={105} width={78} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="SS at" help="ssAge">
          <NumInput value={inputs.ssAge} onChange={set("ssAge")} min={62} max={70} width={78} />
        </Field>
        <Field label="Household" help="householdSize">
          <NumInput value={inputs.householdSize} onChange={set("householdSize")} min={1} max={10} width={78} />
        </Field>
      </Grid2>
      {isMFJ && (
        <>
          <Divider />
          <SubTitle>Spouse</SubTitle>
          <Grid2>
            <Field label="SS at" help="spouseSsAge">
              <NumInput value={inputs.spouseSsAge} onChange={set("spouseSsAge")} min={62} max={70} width={78} />
            </Field>
            <Field label="Benefit/mo" help="spouseSsBenefit">
              <NumInput value={inputs.spouseSsBenefit} onChange={set("spouseSsBenefit")} prefix="$" step={100} width={78} />
            </Field>
          </Grid2>
        </>
      )}
    </>
  );
}

function MoneyFields({ inputs, set, plan }) {
  // What the user saves per month across every account (their own contributions,
  // excluding employer match). 401k/Roth/HSA are entered yearly; the rest monthly.
  const monthlySavings =
    (inputs.k401AnnualContrib + inputs.rothAnnualContrib + (inputs.hsaAnnualContrib ?? 0)) / 12 +
    (inputs.brokerageMonthlyContrib ?? 0) + (inputs.cashMonthlyContrib ?? 0) + (inputs.muniMonthlyContrib ?? 0);
  const annualSavings = monthlySavings * 12;
  const savingsPctSalary = inputs.salary > 0 ? (annualSavings / inputs.salary) * 100 : 0;
  return (
    <>
      <div style={{ fontSize: 12, color: "#4a5e58", background: "#f0f5f4", borderRadius: 8, padding: "8px 11px", marginBottom: 12 }}>
        You save{" "}
        <strong style={{ color: "#3d8c78", fontFamily: "'JetBrains Mono', monospace" }}>
          {fmt(Math.round(monthlySavings))}/mo
        </strong>{" "}
        ({fmtK(annualSavings)}/yr){savingsPctSalary > 0 ? ` · ${Math.round(savingsPctSalary)}% of salary` : ""}
      </div>
      <Field label="Salary (for match calc)" help="salary">
        <NumInput value={inputs.salary} onChange={set("salary")} prefix="$" step={5000} width={120} />
      </Field>
      <Divider />
      <SubTitle>401k / Traditional</SubTitle>
      <Grid2>
        <Field label="Balance" help="k401Today">
          <NumInput value={inputs.k401Today} onChange={set("k401Today")} prefix="$" step={1000} width={95} />
        </Field>
        <Field label={`Contrib/yr (max $${(CONTRIB_LIMITS.k401 / 1000).toFixed(0)}k)`} help="k401AnnualContrib">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NumInput value={inputs.k401AnnualContrib} onChange={set("k401AnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.k401} width={88} />
            <MaxChip onClick={() => set("k401AnnualContrib")(CONTRIB_LIMITS.k401)} />
          </div>
        </Field>
      </Grid2>
      <Field label="Employer match % of salary" help="employerMatchPct">
        <NumInput value={inputs.employerMatchPct} onChange={set("employerMatchPct")} suffix="%" step={0.5} max={20} width={70} />
      </Field>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
        You {fmtK(inputs.k401AnnualContrib)} + match {fmtK(plan.annualEmployerMatch)} = <strong style={{ color: "#3d8c78" }}>{fmtK(plan.total401kAnnual)}/yr</strong>
      </div>
      <Divider />
      <SubTitle>Roth IRA</SubTitle>
      <Field label="Total balance" help="rothTotal">
        <NumInput value={inputs.rothTotal} onChange={set("rothTotal")} prefix="$" step={1000} width={120} />
      </Field>
      <Grid2>
        <Field label={`Contrib/yr (max $${(CONTRIB_LIMITS.rothIra / 1000).toFixed(1)}k)`} help="rothAnnualContrib">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NumInput value={inputs.rothAnnualContrib} onChange={set("rothAnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.rothIra} width={88} />
            <MaxChip onClick={() => set("rothAnnualContrib")(CONTRIB_LIMITS.rothIra)} />
          </div>
        </Field>
        <Field label="Yrs so far" help="rothYearsContrib">
          <NumInput value={inputs.rothYearsContrib} onChange={set("rothYearsContrib")} min={0} max={40} width={78} />
        </Field>
      </Grid2>
      <Field label="Existing earnings (0 if unsure)" help="existingRothEarnings">
        <NumInput value={inputs.existingRothEarnings} onChange={set("existingRothEarnings")} prefix="$" step={1000} width={120} />
      </Field>
      <div style={{ fontSize: 10, color: "#9db4ae" }}>
        Contribs: <strong style={{ color: "#1a2e28" }}>{fmtK(plan.rothContribNow)}</strong> · Earnings: <strong style={{ color: "#1a2e28" }}>{fmtK(plan.rothEarningsNow)}</strong>
      </div>
      <Divider />
      <SubTitle>Cash & CDs</SubTitle>
      <Grid2>
        <Field label="Balance" help="cashDeposit">
          <NumInput value={inputs.cashDeposit} onChange={set("cashDeposit")} prefix="$" step={1000} width={95} />
        </Field>
        <Field label="Contribute/mo" help="cashMonthlyContrib">
          <NumInput value={inputs.cashMonthlyContrib} onChange={set("cashMonthlyContrib")} prefix="$" step={100} width={95} />
        </Field>
      </Grid2>
      <Divider />
      <SubTitle>Municipal bonds</SubTitle>
      <Grid2>
        <Field label="Balance" help="muniBonds">
          <NumInput value={inputs.muniBonds} onChange={set("muniBonds")} prefix="$" step={1000} width={95} />
        </Field>
        <Field label="Yield" help="muniReturn">
          <NumInput value={inputs.muniReturn} onChange={set("muniReturn")} suffix="%" step={0.1} width={65} />
        </Field>
      </Grid2>
      <Field label="Contribute/mo" help="muniMonthlyContrib">
        <NumInput value={inputs.muniMonthlyContrib} onChange={set("muniMonthlyContrib")} prefix="$" step={100} width={120} />
      </Field>
      <Field label="Tax status" help="muniDoubleTaxFree">
        <Toggle
          value={inputs.muniDoubleTaxFree ? "free" : "state"}
          onChange={(v) => set("muniDoubleTaxFree")(v === "free")}
          options={[{ value: "free", label: "Fed+State free" }, { value: "state", label: "State taxable" }]}
        />
      </Field>
      <Divider />
      <SubTitle>Brokerage</SubTitle>
      <Grid2>
        <Field label="Current value" help="existingBrokerage">
          <NumInput value={inputs.existingBrokerage} onChange={set("existingBrokerage")} prefix="$" step={1000} width={95} />
        </Field>
        <Field label="Cost basis" help="existingBrokerageBasis">
          <NumInput value={inputs.existingBrokerageBasis} onChange={set("existingBrokerageBasis")} prefix="$" step={1000} width={95} />
        </Field>
      </Grid2>
      <Field label="Contribute/mo" help="brokerageMonthlyContrib">
        <NumInput value={inputs.brokerageMonthlyContrib} onChange={set("brokerageMonthlyContrib")} prefix="$" step={100} width={120} />
      </Field>
      <Divider />
      <SubTitle>HSA (triple tax-advantaged)</SubTitle>
      <Grid2>
        <Field label="Balance" help="hsaBalance">
          <NumInput value={inputs.hsaBalance} onChange={set("hsaBalance")} prefix="$" step={1000} width={95} />
        </Field>
        <Field label={`Contrib/yr (${TAX_YEAR} max $${(CONTRIB_LIMITS.hsaFamily / 1000).toFixed(1)}k)`} help="hsaAnnualContrib">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NumInput value={inputs.hsaAnnualContrib} onChange={set("hsaAnnualContrib")} prefix="$" step={100} max={CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup} width={80} />
            <MaxChip onClick={() => set("hsaAnnualContrib")(CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup)} />
          </div>
        </Field>
      </Grid2>
    </>
  );
}

function SpendingFields({ inputs, set, plan }) {
  return (
    <>
      <Field label="Monthly expenses (today's $)" hint="Inflated to retirement date" help="monthlyExpense">
        <NumInput value={inputs.monthlyExpense} onChange={set("monthlyExpense")} prefix="$" step={500} width={130} />
      </Field>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
        At retire ({plan.retireAge}): <strong style={{ color: "#1a2e28", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(Math.round(plan.monthlyAtRetirement))}/mo</strong>
      </div>
      <Divider />
      <SubTitle>Social Security</SubTitle>
      <Field label="Input method">
        <Toggle
          value={inputs.ssPia > 0 ? "pia" : "direct"}
          onChange={(v) => {
            if (v === "pia") {
              set("ssPia")(inputs.ssBenefit);
              set("ssFra")(67);
            } else {
              set("ssPia")(0);
            }
          }}
          options={[{ value: "direct", label: "Known benefit" }, { value: "pia", label: "PIA × age" }]}
        />
      </Field>
      {inputs.ssPia > 0 ? (
        <Grid2>
          <Field label="PIA at FRA" hint="From SSA statement" help="ssPia">
            <NumInput value={inputs.ssPia} onChange={set("ssPia")} prefix="$" step={100} width={95} />
          </Field>
          <Field label="Your FRA" help="ssFra">
            <NumInput value={inputs.ssFra} onChange={set("ssFra")} min={62} max={70} step={0.5} width={78} />
          </Field>
        </Grid2>
      ) : (
        <Field label="Your SS benefit/mo" hint={`At age ${inputs.ssAge}, today's $`} help="ssBenefit">
          <NumInput value={inputs.ssBenefit} onChange={set("ssBenefit")} prefix="$" step={100} width={120} />
        </Field>
      )}
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
        Claiming at {inputs.ssAge}: <strong style={{ color: "#1a2e28", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(Math.round(plan.ssBenefit))}/mo</strong>
      </div>
    </>
  );
}

function AssumptionsFields({ inputs, set }) {
  const realReturn = Math.max(0, inputs.stockReturn - inputs.inflationRate);
  return (
    <>
      <Grid3>
        <Field label="Stock return" help="stockReturn">
          <NumInput value={inputs.stockReturn} onChange={set("stockReturn")} suffix="%" step={0.1} width={62} />
        </Field>
        <Field label="Inflation" help="inflationRate">
          <NumInput value={inputs.inflationRate} onChange={set("inflationRate")} suffix="%" step={0.1} width={62} />
        </Field>
        <Field label="CD rate" help="cashDepositRate">
          <NumInput value={inputs.cashDepositRate} onChange={set("cashDepositRate")} suffix="%" step={0.1} width={62} />
        </Field>
      </Grid3>
      <div style={{ fontSize: 11, color: "#9db4ae", marginTop: 4 }}>
        Real return:{" "}
        <strong style={{ color: "#3d8c78", fontFamily: "'JetBrains Mono', monospace" }}>
          {pct(realReturn)}
        </strong>
        <span style={{ color: "#9db4ae" }}> = {pct(inputs.stockReturn)} − {pct(inputs.inflationRate)}</span>
      </div>
    </>
  );
}

function TaxesFields({ inputs, set, plan, previewWithdrawal: pwProp, setPreviewWithdrawal: setPwProp }) {
  // Optionally controlled: the desktop sidebar owns this state so the preview
  // amount survives collapsing/reopening Taxes. Falls back to internal state
  // when rendered standalone (mobile), where a reset is harmless.
  const [pwLocal, setPwLocal] = useState(50000);
  const previewWithdrawal = pwProp ?? pwLocal;
  const setPreviewWithdrawal = setPwProp ?? setPwLocal;
  return (
    <>
      <Field label="Employment bracket" hint="Applies to CD interest while working" help="employmentBracket">
        <Select
          value={String(inputs.employmentBracket)}
          onChange={(v) => set("employmentBracket")(Number(v))}
          width={280}
          options={EMPLOYMENT_BRACKETS.map((r) => ({ value: String(r), label: `${r}% bracket` }))}
        />
      </Field>
      <Field label="Long-term cap gains" help="ltcgBracket">
        <Toggle
          value={String(inputs.ltcgBracket)}
          onChange={(v) => set("ltcgBracket")(Number(v))}
          options={LTCG_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
        />
      </Field>
      <Field label="State income tax" help="stateKey">
        <Select
          value={inputs.stateKey}
          onChange={set("stateKey")}
          width={320}
          options={STATE_TAXES.map((s) => ({ value: s.name, label: `${s.name}${s.rate > 0 ? ` (${s.rate}%)` : ""}` }))}
        />
      </Field>
      <div style={{ marginBottom: 8 }}>
        <Toggle
          value={inputs.stateTaxEnabled ? "on" : "off"}
          onChange={(v) => set("stateTaxEnabled")(v === "on")}
          options={[{ value: "on", label: "State tax on" }, { value: "off", label: "Off" }]}
        />
      </div>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 10 }}>
        CD tax: <strong style={{ color: "#c97c1a" }}>{pct(plan.accumulationOrdinaryRate)}</strong> · Cap gains: <strong style={{ color: "#c97c1a" }}>{pct(plan.brokerageLtcgRate)}</strong>
      </div>
      <Divider />
      <SubTitle>401k withdrawal preview</SubTitle>
      <Field label="Preview withdrawal amount">
        <NumInput value={previewWithdrawal} onChange={setPreviewWithdrawal} prefix="$" step={5000} width={130} />
      </Field>
      <BracketBar annual={previewWithdrawal} stateTaxRate={plan.effectiveStateTax} filingStatus={inputs.filingStatus} />
    </>
  );
}

function StrategyFields({ inputs, set, plan }) {
  return (
    <>
      <SubTitle>Roth conversion ladder</SubTitle>
      {inputs.conversionCeiling > 0 && (
        <div style={{ background: "#f0faf6", border: "1px solid #a3d9c7", borderRadius: 8, padding: "9px 11px", marginBottom: 9 }}>
          <div style={{ fontSize: 10, color: "#2a6e56", lineHeight: 1.5 }}>
            <strong>Optimizer active:</strong> fill to top of the{" "}
            {Math.round((FED_BRACKETS[inputs.filingStatus]?.find((b) => b.upTo === inputs.conversionCeiling)?.rate ?? 0) * 100)}% bracket
            each year through age {inputs.conversionEndAge}. The fixed amount below is ignored.
          </div>
          <button
            onClick={() => {
              set("conversionCeiling")(0);
              set("conversionEndAge")(59.5);
            }}
            style={{ marginTop: 6, border: "1px solid #a3d9c7", background: "#fff", color: "#2a6e56", borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 700, padding: "3px 9px" }}
          >
            Clear optimizer strategy
          </button>
        </div>
      )}
      <Field label={`Convert 401k → Roth/yr (bridge: ${inputs.retireAge}→59½)`} help="annualRothConversion">
        <NumInput value={inputs.annualRothConversion} onChange={set("annualRothConversion")} prefix="$" step={5000} width={130} />
      </Field>
      {inputs.annualRothConversion > 0 && (
        <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
          Marginal rate:{" "}
          <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: "#1a2e28" }}>
            {pct((marginalFedRate(inputs.annualRothConversion, inputs.filingStatus) + plan.effectiveStateTax / 100) * 100)}
          </strong>
          . Unlocks tax-free after 5 years.
        </div>
      )}
      <Divider />
      <SubTitle>Early access (pre-59½)</SubTitle>
      <Field label="Rule of 55" hint="Left employer at 55+? 401k penalty-free." help="rule55">
        <Toggle
          value={inputs.rule55 ? "yes" : "no"}
          onChange={(v) => set("rule55")(v === "yes")}
          options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]}
        />
      </Field>
      <Field label="72(t) SEPP / yr" hint="Substantially Equal Periodic Payments; 0 = none" help="annualSepp">
        <NumInput value={inputs.annualSepp} onChange={set("annualSepp")} prefix="$" step={1000} width={120} />
      </Field>
      <Divider />
      <SubTitle>Guardrails (Guyton-Klinger)</SubTitle>
      <Grid2>
        <Field label="Upper WR" hint="Cut 10% if above" help="guardrailUpper">
          <NumInput
            value={inputs.guardrailUpper * 100}
            onChange={(v) => set("guardrailUpper")(v / 100)}
            suffix="%"
            step={0.5}
            min={0}
            max={25}
            width={62}
          />
        </Field>
        <Field label="Lower WR" hint="Raise 10% if below" help="guardrailLower">
          <NumInput
            value={inputs.guardrailLower * 100}
            onChange={(v) => set("guardrailLower")(v / 100)}
            suffix="%"
            step={0.5}
            min={0}
            max={15}
            width={62}
          />
        </Field>
      </Grid2>
    </>
  );
}

function HealthcareFields({ inputs, set }) {
  return (
    <>
      <Grid2>
        <Field label="ACA full premium/mo" hint="Only if not already in monthly expenses" help="monthlyAcaFullPremium">
          <NumInput value={inputs.monthlyAcaFullPremium} onChange={set("monthlyAcaFullPremium")} prefix="$" step={50} width={75} />
        </Field>
        <Field label="IRMAA/mo" hint="Medicare Part B+D surcharge at 65+" help="monthlyIrmaaSurcharge">
          <NumInput value={inputs.monthlyIrmaaSurcharge} onChange={set("monthlyIrmaaSurcharge")} prefix="$" step={69} width={75} />
        </Field>
      </Grid2>
      <Field label="State SS income exemption" help="stateSsExemptRate">
        <Toggle
          value={String(inputs.stateSsExemptRate)}
          onChange={(v) => set("stateSsExemptRate")(parseFloat(v))}
          options={[{ value: "0", label: "None" }, { value: "0.5", label: "50%" }, { value: "1", label: "Full" }]}
        />
      </Field>
    </>
  );
}

function EstateFields({ inputs, set }) {
  return (
    <>
      <SubTitle>Estate &amp; legacy planning</SubTitle>
      <Field label="Step-up in basis at death" hint="Heirs inherit brokerage at market value — unrealized gains erased" help="assumeStepUpBasis">
        <Toggle
          value={inputs.assumeStepUpBasis ? "yes" : "no"}
          onChange={(v) => set("assumeStepUpBasis")(v === "yes")}
          options={[{ value: "yes", label: "Step-up on" }, { value: "no", label: "No step-up" }]}
        />
      </Field>
      <Field label="Legacy target" hint="Estate you want to leave behind (today's $); 0 = none" help="legacyTarget">
        <NumInput value={inputs.legacyTarget} onChange={set("legacyTarget")} prefix="$" step={50000} width={130} />
      </Field>
      <div style={{ fontSize: 10, color: "#9db4ae" }}>
        Results show your projected estate at {inputs.lifeExpect} versus this target.
      </div>
    </>
  );
}

function AdvancedFields({ inputs, set, plan }) {
  return (
    <>
      <SubTitle>Birth year</SubTitle>
      <Field label="Birth year override" hint="0 = derive from your age. Sets exact RMD age & FRA." help="birthYear">
        <NumInput value={inputs.birthYear} onChange={set("birthYear")} min={0} max={TAX_YEAR} step={1} width={90} />
      </Field>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 4 }}>
        Using <strong style={{ color: "#1a2e28" }}>{plan.birthYear}</strong> → RMDs at{" "}
        <strong style={{ color: "#1a2e28" }}>{plan.rmdAge}</strong>, FRA{" "}
        <strong style={{ color: "#1a2e28" }}>{fraForBirthYear(plan.birthYear).toFixed(2).replace(/\.?0+$/, "")}</strong>.
      </div>
      <Divider />
      <SubTitle>One-time expenses</SubTitle>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
        Lump costs in today's $ (wedding, home repair, new car). Inflated to the spend year and funded from the draw order.
      </div>
      <OneTimeExpenses
        value={inputs.oneTimeExpenses}
        onChange={set("oneTimeExpenses")}
        defaultAge={Math.min(inputs.retireAge + 5, inputs.lifeExpect - 1)}
      />
      <Divider />
      <SubTitle>Phase spending (go-go / slow-go / no-go)</SubTitle>
      <Grid3>
        <Field label="Go-go ×" help="phaseSpending">
          <NumInput value={inputs.goGoMult} onChange={set("goGoMult")} step={0.05} min={0} max={3} width={56} />
        </Field>
        <Field label="Slow-go ×">
          <NumInput value={inputs.slowGoMult} onChange={set("slowGoMult")} step={0.05} min={0} max={3} width={56} />
        </Field>
        <Field label="No-go ×">
          <NumInput value={inputs.noGoMult} onChange={set("noGoMult")} step={0.05} min={0} max={3} width={56} />
        </Field>
      </Grid3>
      <Grid2>
        <Field label="Slow-go starts at">
          <NumInput value={inputs.slowGoAge} onChange={set("slowGoAge")} min={inputs.retireAge} max={105} width={70} />
        </Field>
        <Field label="No-go starts at">
          <NumInput value={inputs.noGoAge} onChange={set("noGoAge")} min={inputs.slowGoAge} max={110} width={70} />
        </Field>
      </Grid2>
      <div style={{ fontSize: 10, color: "#9db4ae" }}>
        1.0 = no change. Typical glide path: go-go 1.1, slow-go 1.0, no-go 0.8.
      </div>
    </>
  );
}

function ScenarioFields({ inputs, set }) {
  return (
    <>
      <SubTitle>Scenario testing</SubTitle>
      <Field label="Mode" help="scenarioMode">
        <Toggle
          value={inputs.scenarioMode}
          onChange={set("scenarioMode")}
          options={[
            { value: "deterministic", label: "Deterministic" },
            { value: "stress", label: "Stress Test" },
            { value: "historical", label: "Historical" },
          ]}
        />
      </Field>
      {inputs.scenarioMode === "stress" && (
        <>
          <Grid2>
            <Field label="Crash size" hint="Annual return in crash years" help="stressDropPct">
              <NumInput value={inputs.stressDropPct} onChange={set("stressDropPct")} suffix="%" step={5} min={0} max={90} width={62} />
            </Field>
            <Field label="Crash years" hint="Starting at retirement" help="stressYears">
              <NumInput value={inputs.stressYears} onChange={set("stressYears")} min={1} max={10} width={62} />
            </Field>
          </Grid2>
          <div style={{ fontSize: 10, color: "#9db4ae" }}>
            Adds a downside card to the results. Your headline verdict stays on the base assumptions.
          </div>
        </>
      )}
      {inputs.scenarioMode === "historical" && (
        <>
          <Field label="Period" hint="Real returns from this start year" help="historicalScenario">
            <Select
              value={inputs.historicalScenario}
              onChange={set("historicalScenario")}
              options={HISTORICAL_SCENARIOS.map((s) => ({ value: s.key, label: s.label }))}
            />
          </Field>
          <Field label="Returns" hint="Which series to replay" help="historicalLens">
            <Toggle
              value={inputs.historicalLens}
              onChange={set("historicalLens")}
              options={[
                { value: "balanced", label: "60/40 blend" },
                { value: "sp", label: "S&P 500" },
              ]}
            />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae" }}>
            Replays actual returns from the start year, reverting to your mean once history runs out.
            Adds a downside card; your headline verdict stays on the base assumptions.
          </div>
        </>
      )}
    </>
  );
}

// Caption text per section — pinned at sidebar bottom
const CAPTIONS = {
  you: "Filing status sets your federal tax brackets and standard deduction. Retire age and life expectancy frame the entire projection.",
  money: "Balances compound at the stock return to your retire date. Employer match is added on top. Munis and HSA draw tax-free; brokerage gains are taxed only above cost basis.",
  spending: "Monthly expenses are inflated to your retire date. Social Security adjusts for when you claim vs. your Full Retirement Age — earlier = smaller benefit.",
  assumptions: `Real return = stock − inflation. S&P 500 long-run: ~10% nominal, ~3% CPI, ~7% real. This is the biggest lever on your projections.`,
  tax: "Employment bracket applies only to interest while working. Retirement withdrawals use 2026 brackets on the actual draw — typically far lower than your working rate.",
  strategy: "Roth conversions during the bridge fill low brackets cheaply. Rule of 55 unlocks your 401k penalty-free if you left that employer at 55+. Guardrails auto-adjust spending based on withdrawal rate.",
  healthcare: "Enter ACA only if your monthly expenses above do not already include health insurance — otherwise you'll double-count it. At 65 Medicare replaces ACA. IRMAA applies at higher incomes.",
  estate: "Step-up in basis erases unrealized brokerage gains for your heirs — leave it on unless you plan to liquidate before death. The legacy target is the estate you want to leave; results show the gap.",
  advanced: "Birth year sets your exact RMD start age (73 vs 75) and Full Retirement Age. One-time expenses are lump costs in today's dollars. Phase multipliers model the go-go / slow-go / no-go spending curve.",
  scenario: "Stress Test replays a sharp early-retirement crash (sequence-of-returns risk) as an illustrative downside, separate from the headline verdict. Monte Carlo (Retire Early tab) averages 500 random paths.",
};

const ESSENTIAL_KEYS = ["you", "money", "spending", "assumptions"];
const FINE_TUNING_KEYS = ["tax", "strategy", "healthcare", "estate", "advanced", "scenario"];
const FILING_SHORT = { single: "Single", mfj: "MFJ", hoh: "HOH" };

// Section registry — { title, Body, caption }. The desktop accordion and the
// mobile single-section view both render from this, so fields live in one place.
const INPUT_SECTIONS = {
  you: { title: "You", Body: YouFields },
  money: { title: "Money", Body: MoneyFields },
  spending: { title: "Spending", Body: SpendingFields },
  assumptions: { title: "Assumptions", Body: AssumptionsFields },
  tax: { title: "Taxes", Body: TaxesFields },
  strategy: { title: "Strategy", Body: StrategyFields },
  healthcare: { title: "Healthcare", Body: HealthcareFields },
  estate: { title: "Estate", Body: EstateFields },
  advanced: { title: "Advanced", Body: AdvancedFields },
  scenario: { title: "Scenario", Body: ScenarioFields },
};

export { INPUT_SECTIONS, ESSENTIAL_KEYS, FINE_TUNING_KEYS, CAPTIONS };

// Per-section summary string for the closed accordion rows (desktop) and the
// mobile bottom-nav blurbs. Depends on derived plan values, so it's a function.
export function sectionSummary(key, inputs, plan) {
  switch (key) {
    case "you":
      return `${FILING_SHORT[inputs.filingStatus]} · age ${inputs.currentAge} · retire ${plan.retireAge}`;
    case "money": {
      const totalSaved =
        inputs.k401Today + inputs.rothTotal + inputs.cashDeposit + inputs.muniBonds +
        inputs.existingBrokerage + (inputs.hsaBalance ?? 0);
      const acctCount = [inputs.k401Today, inputs.rothTotal, inputs.cashDeposit, inputs.muniBonds, inputs.existingBrokerage, inputs.hsaBalance]
        .filter((v) => v > 0).length;
      return `${fmtK(totalSaved)} · ${acctCount} account${acctCount === 1 ? "" : "s"}`;
    }
    case "spending":
      return `${fmtK(inputs.monthlyExpense)}/mo · SS ${fmtK(plan.ssBenefit)}@${inputs.ssAge}`;
    case "assumptions":
      return `Stock ${inputs.stockReturn}% · CPI ${inputs.inflationRate}% · CD ${inputs.cashDepositRate}%`;
    case "tax":
      return `${inputs.employmentBracket}% / LTCG ${inputs.ltcgBracket}% / state ${plan.effectiveStateTax > 0 ? plan.effectiveStateTax + "%" : "none"}`;
    case "strategy":
      return `Roth ${
        inputs.conversionCeiling > 0
          ? `fill ${Math.round((FED_BRACKETS[inputs.filingStatus]?.find((b) => b.upTo === inputs.conversionCeiling)?.rate ?? 0) * 100)}%`
          : `${fmtK(inputs.annualRothConversion)}/yr`
      } · R55 ${inputs.rule55 ? "on" : "off"} · SEPP ${fmtK(inputs.annualSepp)}/yr · GK ${inputs.guardrailUpper > 0 ? "on" : "off"}`;
    case "healthcare":
      return `ACA ${fmtK(inputs.monthlyAcaFullPremium)}/mo · IRMAA ${fmtK(inputs.monthlyIrmaaSurcharge)}/mo`;
    case "estate":
      return `Step-up ${inputs.assumeStepUpBasis ? "on" : "off"} · target ${inputs.legacyTarget > 0 ? fmtK(inputs.legacyTarget) : "none"}`;
    case "advanced":
      return `b.${plan.birthYear} · ${inputs.oneTimeExpenses?.length ?? 0} lump · phase ${inputs.goGoMult}/${inputs.slowGoMult}/${inputs.noGoMult}`;
    case "scenario":
      return inputs.scenarioMode === "stress"
        ? `Stress −${inputs.stressDropPct}% × ${inputs.stressYears}y`
        : inputs.scenarioMode === "historical"
        ? `Historical: ${HISTORICAL_SCENARIOS.find((s) => s.key === inputs.historicalScenario)?.startYear ?? ""} · ${inputs.historicalLens === "sp" ? "S&P 500" : "60/40"}`
        : "Deterministic";
    default:
      return "";
  }
}

// ─── Main export (desktop accordion) ─────────────────────────

export function InputsSidebar({ inputs, set, plan, defaultFineTuningOpen = false, defaultOpenSection = "you" }) {
  const [open, setOpen] = useState(defaultOpenSection);
  const [ftOpen, setFtOpen] = useState(defaultFineTuningOpen);
  // Owned here (not inside TaxesFields) so the 401k-withdrawal preview persists
  // across opening/closing sections — TaxesFields only mounts while Taxes is open.
  const [previewWithdrawal, setPreviewWithdrawal] = useState(50000);

  const toggle = (key) => setOpen((prev) => (prev === key ? null : key));
  const captionVisible = open && (ftOpen || ESSENTIAL_KEYS.includes(open));
  const caption = captionVisible ? CAPTIONS[open] : "Select a section to edit inputs. Closed sections show current values at a glance.";

  const renderSection = (key) => {
    const { title, Body } = INPUT_SECTIONS[key];
    const extra = key === "tax" ? { previewWithdrawal, setPreviewWithdrawal } : {};
    return (
      <AccSection
        title={title}
        summary={sectionSummary(key, inputs, plan)}
        isOpen={open === key}
        onToggle={() => toggle(key)}
      >
        <Body inputs={inputs} set={set} plan={plan} {...extra} />
      </AccSection>
    );
  };

  return (
    <div style={{ background: "#fafcfc", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Scrollable accordion list */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        <GroupLabel>Essentials</GroupLabel>
        {ESSENTIAL_KEYS.map((key) => <div key={key}>{renderSection(key)}</div>)}

        {/* ── Fine-tuning (optional) ───────────────────── */}
        <FineTuningHeader isOpen={ftOpen} onToggle={() => setFtOpen((v) => !v)} />
        {ftOpen && FINE_TUNING_KEYS.map((key) => <div key={key}>{renderSection(key)}</div>)}

      </div>

      {/* Caption + disclaimer pinned at bottom */}
      <div
        style={{
          padding: "11px 16px",
          background: "#f0f5f4",
          borderTop: "1px solid #e2e8e6",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 11, color: "#7C9A92", lineHeight: 1.55, minHeight: 50 }}>
          {caption}
        </div>
        <div style={{ fontSize: 9, color: "#a9bdb6", marginTop: 8, letterSpacing: "0.02em" }}>
          Educational planning tool — not financial advice.
        </div>
      </div>
    </div>
  );
}
