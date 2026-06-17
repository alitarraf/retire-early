// Direction B accordion sidebar. One section open at a time; closed
// sections show a monospace inline summary. A caption bar pinned at
// the bottom swaps per open section.
import { useState } from "react";
import { NumInput, Select, Toggle } from "../ui.jsx";
import { BracketBar } from "../charts/BracketBar.jsx";
import { marginalFedRate } from "../../engine/tax.js";
import { fraForBirthYear } from "../../engine/socialSecurity.js";
import {
  STATE_TAXES, EMPLOYMENT_BRACKETS, LTCG_RATES, CONTRIB_LIMITS,
  FILING_STATUS, FILING_STATUS_LABELS, TAX_YEAR,
} from "../../constants/brackets.js";
import { fmt, fmtK, pct } from "../../format.js";

// ─── Module-scope layout atoms ───────────────────────────────

function AccLabel({ text }) {
  return (
    <div style={{ fontSize: 10, color: "#7C9A92", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
      {text}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <AccLabel text={label} />
      {hint && <div style={{ fontSize: 10, color: "#b0c4be", marginBottom: 2 }}>{hint}</div>}
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
  return <div style={{ borderTop: "1px solid #eef2f1", margin: "10px 0" }} />;
}

function SubTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5aada0", marginBottom: 7, marginTop: 2 }}>
      {children}
    </div>
  );
}

function AccSection({ title, summary, isOpen, onToggle, children }) {
  return (
    <div style={{ borderBottom: "1px solid #dce8e4" }}>
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
        <span style={{ fontSize: 13, color: isOpen ? "#7ecfbb" : "#b0c4be", flexShrink: 0, lineHeight: 1 }}>
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
        style={{ border: "1px dashed #b0c4be", background: "#fafcfc", color: "#3d8c78", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px", marginTop: 2 }}
      >
        + Add one-time expense
      </button>
    </div>
  );
}

// Caption text per section — pinned at sidebar bottom
const CAPTIONS = {
  profile: "Filing status sets your federal tax brackets and standard deduction. Retire age and life expectancy frame the entire projection.",
  accounts: "Balances compound at the stock return to your retire date. Employer match is added on top of your contribution. Roth contributions are always yours tax-free.",
  savings: "Munis draw federal tax-free. HSA draws tax-free for qualified medical. Brokerage gains are taxed at your LTCG rate only on the gain above cost basis.",
  spending: "Monthly expenses are inflated to your retire date. Social Security adjusts for when you claim vs. your Full Retirement Age — earlier = smaller benefit.",
  assumptions: `Real return = stock − inflation. S&P 500 long-run: ~10% nominal, ~3% CPI, ~7% real. This is the biggest lever on your projections.`,
  tax: "Employment bracket applies only to interest while working. Retirement withdrawals use 2026 brackets on the actual draw — typically far lower than your working rate.",
  strategy: "Roth conversions during the bridge fill low brackets cheaply. Rule of 55 unlocks your 401k penalty-free if you left that employer at 55+. Guardrails auto-adjust spending based on withdrawal rate.",
  healthcare: "Enter ACA only if your monthly expenses above do not already include health insurance — otherwise you'll double-count it. At 65 Medicare replaces ACA. IRMAA applies at higher incomes.",
  estate: "Step-up in basis erases unrealized brokerage gains for your heirs — leave it on unless you plan to liquidate before death. The legacy target is the estate you want to leave; results show the gap.",
  advanced: "Birth year sets your exact RMD start age (73 vs 75) and Full Retirement Age. One-time expenses are lump costs in today's dollars. Phase multipliers model the go-go / slow-go / no-go spending curve.",
  scenario: "Stress Test replays a sharp early-retirement crash (sequence-of-returns risk) as an illustrative downside, separate from the headline verdict. Monte Carlo (Retire Early tab) averages 500 random paths.",
};

const FILING_SHORT = { single: "Single", mfj: "MFJ", hoh: "HOH" };

// ─── Main export ─────────────────────────────────────────────

export function InputsSidebar({ inputs, set, plan }) {
  const [open, setOpen] = useState("profile");
  const [previewWithdrawal, setPreviewWithdrawal] = useState(50000);

  const isMFJ = inputs.filingStatus === FILING_STATUS.MFJ;
  const realReturn = Math.max(0, inputs.stockReturn - inputs.inflationRate);
  const toggle = (key) => setOpen((prev) => (prev === key ? null : key));
  const caption = open ? CAPTIONS[open] : "Select a section to edit inputs. Closed sections show current values at a glance.";
  const stateRate = STATE_TAXES.find((s) => s.name === inputs.stateKey)?.rate ?? 0;

  return (
    <div style={{ background: "#fafcfc", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Scrollable accordion list */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* ── Profile ──────────────────────────────────── */}
        <AccSection
          title="Profile"
          summary={`${FILING_SHORT[inputs.filingStatus]} · age ${inputs.currentAge} · retire ${inputs.retireAge}`}
          isOpen={open === "profile"}
          onToggle={() => toggle("profile")}
        >
          <Field label="Filing status">
            <Select
              value={inputs.filingStatus}
              onChange={set("filingStatus")}
              width={320}
              options={Object.values(FILING_STATUS).map((v) => ({ value: v, label: FILING_STATUS_LABELS[v] }))}
            />
          </Field>
          <Grid3>
            <Field label="Your age">
              <NumInput value={inputs.currentAge} onChange={set("currentAge")} min={18} max={80} width={62} />
            </Field>
            <Field label="Retire at">
              <NumInput value={inputs.retireAge} onChange={set("retireAge")} min={inputs.currentAge + 1} max={80} width={62} />
            </Field>
            <Field label="Live to">
              <NumInput value={inputs.lifeExpect} onChange={set("lifeExpect")} min={inputs.retireAge + 1} max={105} width={62} />
            </Field>
          </Grid3>
          <Grid2>
            <Field label="SS at">
              <NumInput value={inputs.ssAge} onChange={set("ssAge")} min={62} max={70} width={78} />
            </Field>
            <Field label="Household">
              <NumInput value={inputs.householdSize} onChange={set("householdSize")} min={1} max={10} width={78} />
            </Field>
          </Grid2>
          {isMFJ && (
            <>
              <Divider />
              <SubTitle>Spouse</SubTitle>
              <Grid2>
                <Field label="SS at">
                  <NumInput value={inputs.spouseSsAge} onChange={set("spouseSsAge")} min={62} max={70} width={78} />
                </Field>
                <Field label="Benefit/mo">
                  <NumInput value={inputs.spouseSsBenefit} onChange={set("spouseSsBenefit")} prefix="$" step={100} width={78} />
                </Field>
              </Grid2>
            </>
          )}
        </AccSection>

        {/* ── Accounts ─────────────────────────────────── */}
        <AccSection
          title="Accounts"
          summary={`401k ${fmtK(inputs.k401Today)} · Roth ${fmtK(inputs.rothTotal)}`}
          isOpen={open === "accounts"}
          onToggle={() => toggle("accounts")}
        >
          <Field label="Salary (for match calc)">
            <NumInput value={inputs.salary} onChange={set("salary")} prefix="$" step={5000} width={120} />
          </Field>
          <Divider />
          <SubTitle>401k / Traditional</SubTitle>
          <Grid2>
            <Field label="Balance">
              <NumInput value={inputs.k401Today} onChange={set("k401Today")} prefix="$" step={1000} width={95} />
            </Field>
            <Field label={`Contrib/yr (max $${(CONTRIB_LIMITS.k401 / 1000).toFixed(0)}k)`}>
              <NumInput value={inputs.k401AnnualContrib} onChange={set("k401AnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.k401} width={95} />
            </Field>
          </Grid2>
          <Field label="Employer match % of salary">
            <NumInput value={inputs.employerMatchPct} onChange={set("employerMatchPct")} suffix="%" step={0.5} max={20} width={70} />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            You {fmtK(inputs.k401AnnualContrib)} + match {fmtK(plan.annualEmployerMatch)} = <strong style={{ color: "#3d8c78" }}>{fmtK(plan.total401kAnnual)}/yr</strong>
          </div>
          <Divider />
          <SubTitle>Roth IRA</SubTitle>
          <Field label="Total balance">
            <NumInput value={inputs.rothTotal} onChange={set("rothTotal")} prefix="$" step={1000} width={120} />
          </Field>
          <Grid2>
            <Field label={`Contrib/yr (max $${(CONTRIB_LIMITS.rothIra / 1000).toFixed(1)}k)`}>
              <NumInput value={inputs.rothAnnualContrib} onChange={set("rothAnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.rothIra} width={95} />
            </Field>
            <Field label="Yrs so far">
              <NumInput value={inputs.rothYearsContrib} onChange={set("rothYearsContrib")} min={0} max={40} width={78} />
            </Field>
          </Grid2>
          <Field label="Existing earnings (0 if unsure)">
            <NumInput value={inputs.existingRothEarnings} onChange={set("existingRothEarnings")} prefix="$" step={1000} width={120} />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae" }}>
            Contribs: <strong style={{ color: "#1a2e28" }}>{fmtK(plan.rothContribNow)}</strong> · Earnings: <strong style={{ color: "#1a2e28" }}>{fmtK(plan.rothEarningsNow)}</strong>
          </div>
        </AccSection>

        {/* ── Savings ──────────────────────────────────── */}
        <AccSection
          title="Savings"
          summary={`CD ${fmtK(inputs.cashDeposit)} · Muni ${fmtK(inputs.muniBonds)} · HSA ${fmtK(inputs.hsaBalance)}`}
          isOpen={open === "savings"}
          onToggle={() => toggle("savings")}
        >
          <Field label="CD / cash deposit">
            <NumInput value={inputs.cashDeposit} onChange={set("cashDeposit")} prefix="$" step={1000} width={120} />
          </Field>
          <Divider />
          <SubTitle>Municipal bonds</SubTitle>
          <Grid2>
            <Field label="Balance">
              <NumInput value={inputs.muniBonds} onChange={set("muniBonds")} prefix="$" step={1000} width={95} />
            </Field>
            <Field label="Yield">
              <NumInput value={inputs.muniReturn} onChange={set("muniReturn")} suffix="%" step={0.1} width={65} />
            </Field>
          </Grid2>
          <Field label="Tax status">
            <Toggle
              value={inputs.muniDoubleTaxFree ? "free" : "state"}
              onChange={(v) => set("muniDoubleTaxFree")(v === "free")}
              options={[{ value: "free", label: "Fed+State free" }, { value: "state", label: "State taxable" }]}
            />
          </Field>
          <Divider />
          <SubTitle>Brokerage</SubTitle>
          <Grid2>
            <Field label="Current value">
              <NumInput value={inputs.existingBrokerage} onChange={set("existingBrokerage")} prefix="$" step={1000} width={95} />
            </Field>
            <Field label="Cost basis">
              <NumInput value={inputs.existingBrokerageBasis} onChange={set("existingBrokerageBasis")} prefix="$" step={1000} width={95} />
            </Field>
          </Grid2>
          <Divider />
          <SubTitle>HSA (triple tax-advantaged)</SubTitle>
          <Grid2>
            <Field label="Balance">
              <NumInput value={inputs.hsaBalance} onChange={set("hsaBalance")} prefix="$" step={1000} width={95} />
            </Field>
            <Field label={`Contrib/yr (${TAX_YEAR} max $${(CONTRIB_LIMITS.hsaFamily / 1000).toFixed(1)}k)`}>
              <NumInput value={inputs.hsaAnnualContrib} onChange={set("hsaAnnualContrib")} prefix="$" step={100} max={CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup} width={95} />
            </Field>
          </Grid2>
        </AccSection>

        {/* ── Spending & SS ────────────────────────────── */}
        <AccSection
          title="Spending & SS"
          summary={`${fmtK(inputs.monthlyExpense)}/mo · SS ${fmtK(plan.ssBenefit)}@${inputs.ssAge}`}
          isOpen={open === "spending"}
          onToggle={() => toggle("spending")}
        >
          <Field label="Monthly expenses (today's $)" hint="Inflated to retirement date">
            <NumInput value={inputs.monthlyExpense} onChange={set("monthlyExpense")} prefix="$" step={500} width={130} />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            At retire ({inputs.retireAge}): <strong style={{ color: "#1a2e28", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(Math.round(plan.monthlyAtRetirement))}/mo</strong>
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
              <Field label="PIA at FRA" hint="From SSA statement">
                <NumInput value={inputs.ssPia} onChange={set("ssPia")} prefix="$" step={100} width={95} />
              </Field>
              <Field label="Your FRA">
                <NumInput value={inputs.ssFra} onChange={set("ssFra")} min={62} max={70} step={0.5} width={78} />
              </Field>
            </Grid2>
          ) : (
            <Field label="Your SS benefit/mo" hint={`At age ${inputs.ssAge}, today's $`}>
              <NumInput value={inputs.ssBenefit} onChange={set("ssBenefit")} prefix="$" step={100} width={120} />
            </Field>
          )}
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            Claiming at {inputs.ssAge}: <strong style={{ color: "#1a2e28", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(Math.round(plan.ssBenefit))}/mo</strong>
          </div>
        </AccSection>

        {/* ── Assumptions ──────────────────────────────── */}
        <AccSection
          title="Assumptions"
          summary={`Stock ${inputs.stockReturn}% · CPI ${inputs.inflationRate}% · CD ${inputs.cashDepositRate}%`}
          isOpen={open === "assumptions"}
          onToggle={() => toggle("assumptions")}
        >
          <Grid3>
            <Field label="Stock return">
              <NumInput value={inputs.stockReturn} onChange={set("stockReturn")} suffix="%" step={0.1} width={62} />
            </Field>
            <Field label="Inflation">
              <NumInput value={inputs.inflationRate} onChange={set("inflationRate")} suffix="%" step={0.1} width={62} />
            </Field>
            <Field label="CD rate">
              <NumInput value={inputs.cashDepositRate} onChange={set("cashDepositRate")} suffix="%" step={0.1} width={62} />
            </Field>
          </Grid3>
          <div style={{ fontSize: 11, color: "#9db4ae", marginTop: 4 }}>
            Real return:{" "}
            <strong style={{ color: "#3d8c78", fontFamily: "'JetBrains Mono', monospace" }}>
              {pct(realReturn)}
            </strong>
            <span style={{ color: "#b0c4be" }}> = {pct(inputs.stockReturn)} − {pct(inputs.inflationRate)}</span>
          </div>
        </AccSection>

        {/* ── Tax ──────────────────────────────────────── */}
        <AccSection
          title="Tax"
          summary={`${inputs.employmentBracket}% / LTCG ${inputs.ltcgBracket}% / state ${plan.effectiveStateTax > 0 ? plan.effectiveStateTax + "%" : "none"}`}
          isOpen={open === "tax"}
          onToggle={() => toggle("tax")}
        >
          <Field label="Employment bracket" hint="Applies to CD interest while working">
            <Select
              value={String(inputs.employmentBracket)}
              onChange={(v) => set("employmentBracket")(Number(v))}
              width={280}
              options={EMPLOYMENT_BRACKETS.map((r) => ({ value: String(r), label: `${r}% bracket` }))}
            />
          </Field>
          <Field label="Long-term cap gains">
            <Toggle
              value={String(inputs.ltcgBracket)}
              onChange={(v) => set("ltcgBracket")(Number(v))}
              options={LTCG_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </Field>
          <Field label="State income tax">
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
        </AccSection>

        {/* ── Strategy ─────────────────────────────────── */}
        <AccSection
          title="Strategy"
          summary={`Roth ${fmtK(inputs.annualRothConversion)}/yr · R55 ${inputs.rule55 ? "on" : "off"} · SEPP ${fmtK(inputs.annualSepp)}/yr · GK ${inputs.guardrailUpper > 0 ? "on" : "off"}`}
          isOpen={open === "strategy"}
          onToggle={() => toggle("strategy")}
        >
          <SubTitle>Roth conversion ladder</SubTitle>
          <Field label={`Convert 401k → Roth/yr (bridge: ${inputs.retireAge}→59½)`}>
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
          <Field label="Rule of 55" hint="Left employer at 55+? 401k penalty-free.">
            <Toggle
              value={inputs.rule55 ? "yes" : "no"}
              onChange={(v) => set("rule55")(v === "yes")}
              options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]}
            />
          </Field>
          <Field label="72(t) SEPP / yr" hint="Substantially Equal Periodic Payments; 0 = none">
            <NumInput value={inputs.annualSepp} onChange={set("annualSepp")} prefix="$" step={1000} width={120} />
          </Field>
          <Divider />
          <SubTitle>Guardrails (Guyton-Klinger)</SubTitle>
          <Grid2>
            <Field label="Upper WR" hint="Cut 10% if above">
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
            <Field label="Lower WR" hint="Raise 10% if below">
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
        </AccSection>

        {/* ── Healthcare ───────────────────────────────── */}
        <AccSection
          title="Healthcare"
          summary={`ACA ${fmtK(inputs.monthlyAcaFullPremium)}/mo · IRMAA ${fmtK(inputs.monthlyIrmaaSurcharge)}/mo`}
          isOpen={open === "healthcare"}
          onToggle={() => toggle("healthcare")}
        >
          <Grid2>
            <Field label="ACA full premium/mo" hint="Only if not already in monthly expenses">
              <NumInput value={inputs.monthlyAcaFullPremium} onChange={set("monthlyAcaFullPremium")} prefix="$" step={50} width={75} />
            </Field>
            <Field label="IRMAA/mo" hint="Medicare Part B+D surcharge at 65+">
              <NumInput value={inputs.monthlyIrmaaSurcharge} onChange={set("monthlyIrmaaSurcharge")} prefix="$" step={69} width={75} />
            </Field>
          </Grid2>
          <Field label="State SS income exemption">
            <Toggle
              value={String(inputs.stateSsExemptRate)}
              onChange={(v) => set("stateSsExemptRate")(parseFloat(v))}
              options={[{ value: "0", label: "None" }, { value: "0.5", label: "50%" }, { value: "1", label: "Full" }]}
            />
          </Field>
        </AccSection>

        {/* ── Estate & Legacy ──────────────────────────── */}
        <AccSection
          title="Estate"
          summary={`Step-up ${inputs.assumeStepUpBasis ? "on" : "off"} · target ${inputs.legacyTarget > 0 ? fmtK(inputs.legacyTarget) : "none"}`}
          isOpen={open === "estate"}
          onToggle={() => toggle("estate")}
        >
          <SubTitle>Estate &amp; legacy planning</SubTitle>
          <Field label="Step-up in basis at death" hint="Heirs inherit brokerage at market value — unrealized gains erased">
            <Toggle
              value={inputs.assumeStepUpBasis ? "yes" : "no"}
              onChange={(v) => set("assumeStepUpBasis")(v === "yes")}
              options={[{ value: "yes", label: "Step-up on" }, { value: "no", label: "No step-up" }]}
            />
          </Field>
          <Field label="Legacy target" hint="Estate you want to leave behind (today's $); 0 = none">
            <NumInput value={inputs.legacyTarget} onChange={set("legacyTarget")} prefix="$" step={50000} width={130} />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae" }}>
            Results show your projected estate at {inputs.lifeExpect} versus this target.
          </div>
        </AccSection>

        {/* ── Advanced Inputs ──────────────────────────── */}
        <AccSection
          title="Advanced"
          summary={`b.${plan.birthYear} · ${inputs.oneTimeExpenses?.length ?? 0} lump · phase ${inputs.goGoMult}/${inputs.slowGoMult}/${inputs.noGoMult}`}
          isOpen={open === "advanced"}
          onToggle={() => toggle("advanced")}
        >
          <SubTitle>Birth year</SubTitle>
          <Field label="Birth year override" hint="0 = derive from your age. Sets exact RMD age & FRA.">
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
            <Field label="Go-go ×">
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
        </AccSection>

        {/* ── Scenario Testing ─────────────────────────── */}
        <AccSection
          title="Scenario"
          summary={inputs.scenarioMode === "stress" ? `Stress −${inputs.stressDropPct}% × ${inputs.stressYears}y` : "Deterministic"}
          isOpen={open === "scenario"}
          onToggle={() => toggle("scenario")}
        >
          <SubTitle>Scenario testing</SubTitle>
          <Field label="Mode">
            <Toggle
              value={inputs.scenarioMode}
              onChange={set("scenarioMode")}
              options={[{ value: "deterministic", label: "Deterministic" }, { value: "stress", label: "Stress Test" }]}
            />
          </Field>
          {inputs.scenarioMode === "stress" && (
            <>
              <Grid2>
                <Field label="Crash size" hint="Annual return in crash years">
                  <NumInput value={inputs.stressDropPct} onChange={set("stressDropPct")} suffix="%" step={5} min={0} max={90} width={62} />
                </Field>
                <Field label="Crash years" hint="Starting at retirement">
                  <NumInput value={inputs.stressYears} onChange={set("stressYears")} min={1} max={10} width={62} />
                </Field>
              </Grid2>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>
                Adds a downside card to the results. Your headline verdict stays on the base assumptions.
              </div>
            </>
          )}
        </AccSection>

      </div>

      {/* Caption pinned at bottom — swaps per open section */}
      <div
        style={{
          padding: "11px 16px",
          background: "#f0f5f4",
          borderTop: "1px solid #dce8e4",
          fontSize: 11,
          color: "#7C9A92",
          lineHeight: 1.55,
          flexShrink: 0,
          minHeight: 68,
        }}
      >
        {caption}
      </div>
    </div>
  );
}
