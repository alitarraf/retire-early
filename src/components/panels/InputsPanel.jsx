// Left column: ALL inputs, ordered the way a person thinks.
// Who you are → Timeline → Income → Spending → Accounts →
// Assumptions → Tax → Strategy. Advanced/rare inputs live in
// collapsibles (progressive disclosure) to hit the one-screen goal.
import { useState } from "react";
import { Section, Row, NumInput, Select, Toggle, Collapsible, Note } from "../ui.jsx";
import { BracketBar } from "../charts/BracketBar.jsx";
import { fvAnnuity } from "../../engine/accounts.js";
import { marginalFedRate } from "../../engine/tax.js";
import {
  STATE_TAXES,
  EMPLOYMENT_BRACKETS,
  LTCG_RATES,
  CONTRIB_LIMITS,
  FILING_STATUS,
  FILING_STATUS_LABELS,
  TAX_YEAR,
} from "../../constants/brackets.js";
import { fmt, pct } from "../../format.js";

export function InputsPanel({ inputs, set, plan }) {
  const [previewWithdrawal, setPreviewWithdrawal] = useState(50000);
  const isMFJ = inputs.filingStatus === FILING_STATUS.MFJ;
  const annualSpendAtRetirement = plan.monthlyAtRetirement * 12;

  return (
    <div
      style={{
        flex: "0 0 420px",
        minWidth: 0,
        background: "#fff",
        borderRadius: 14,
        padding: 22,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      }}
    >
      {/* ── Who you are ───────────────────────────────── */}
      <Section title="Who you are">
        <Row label="Filing status">
          <Select
            value={inputs.filingStatus}
            onChange={set("filingStatus")}
            width={210}
            options={Object.values(FILING_STATUS).map((v) => ({ value: v, label: FILING_STATUS_LABELS[v] }))}
          />
        </Row>
        <Row label="Current age">
          <NumInput value={inputs.currentAge} onChange={set("currentAge")} min={18} max={80} />
        </Row>
        <Row label="Household size" hint="People in the household (for ACA, roadmap)">
          <NumInput value={inputs.householdSize} onChange={set("householdSize")} min={1} max={10} width={70} />
        </Row>
        {isMFJ && (
          <div style={{ background: "#f0f5f4", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid #3d8c78" }}>
            <div style={{ fontSize: 10, color: "#7C9A92", marginBottom: 8 }}>
              Spouse (accounts are pooled with yours; only timeline & SS tracked separately)
            </div>
            <Row label="Spouse SS at">
              <NumInput value={inputs.spouseSsAge} onChange={set("spouseSsAge")} min={62} max={70} width={70} />
            </Row>
            <Row label="Spouse SS benefit" hint="Monthly, today's $">
              <NumInput value={inputs.spouseSsBenefit} onChange={set("spouseSsBenefit")} prefix="$" step={100} />
            </Row>
          </div>
        )}
      </Section>

      {/* ── Timeline ──────────────────────────────────── */}
      <Section title="Timeline">
        <Row label="Retire at">
          <NumInput value={inputs.retireAge} onChange={set("retireAge")} min={inputs.currentAge + 1} max={80} />
        </Row>
        <Row label="Your Social Security at">
          <NumInput value={inputs.ssAge} onChange={set("ssAge")} min={62} max={70} />
        </Row>
        <Row label="Life expectancy">
          <NumInput value={inputs.lifeExpect} onChange={set("lifeExpect")} min={inputs.retireAge + 1} max={105} />
        </Row>
      </Section>

      {/* ── Income (pre-retirement) ───────────────────── */}
      <Section title="Income (while working)">
        <Row label="Your salary" hint="For employer match">
          <NumInput value={inputs.salary} onChange={set("salary")} prefix="$" step={5000} />
        </Row>
      </Section>

      {/* ── Spending & SS ─────────────────────────────── */}
      <Section title="Spending & Social Security">
        <Row label="Monthly expenses today" hint="Inflation-adjusted to retirement date">
          <NumInput value={inputs.monthlyExpense} onChange={set("monthlyExpense")} prefix="$" step={500} />
        </Row>
        <Row label="SS input method">
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
            options={[
              { value: "direct", label: "Known benefit" },
              { value: "pia", label: "PIA × age factor" },
            ]}
          />
        </Row>
        {inputs.ssPia > 0 ? (
          <>
            <Row label="PIA (benefit at FRA)" hint="From your SSA statement">
              <NumInput value={inputs.ssPia} onChange={set("ssPia")} prefix="$" step={100} />
            </Row>
            <Row label="Full Retirement Age">
              <NumInput value={inputs.ssFra} onChange={set("ssFra")} min={62} max={70} step={0.5} />
            </Row>
            <Note>
              Claiming at {inputs.ssAge} (FRA {inputs.ssFra}):{" "}
              <strong style={{ fontFamily: "'JetBrains Mono',monospace" }}>{fmt(Math.round(plan.ssBenefit))}/mo</strong>
              {" "}({Math.round((plan.ssBenefit / inputs.ssPia) * 100)}% of PIA).
              Change "Your Social Security at" in Timeline to see effect.
            </Note>
          </>
        ) : (
          <Row label="Your SS benefit" hint="Monthly at SS age (today's $)">
            <NumInput value={inputs.ssBenefit} onChange={set("ssBenefit")} prefix="$" step={100} />
          </Row>
        )}
        {(() => {
          const ssInfl = plan.ssBenefit * Math.pow(1 + inputs.inflationRate / 100, inputs.ssAge - inputs.currentAge);
          const covPct = plan.monthlyAtRetirement > 0 ? (ssInfl / plan.monthlyAtRetirement) * 100 : 0;
          return (
            <Note>
              At {inputs.ssAge}: SS ≈{" "}
              <strong style={{ fontFamily: "'JetBrains Mono',monospace" }}>{fmt(Math.round(ssInfl))}/mo</strong> inflated.{" "}
              <strong style={{ color: covPct > 25 ? "#3d8c78" : "#c97c1a" }}>{covPct.toFixed(0)}%</strong> of your{" "}
              {fmt(Math.round(plan.monthlyAtRetirement))}/mo spend.
            </Note>
          );
        })()}
      </Section>

      {/* ── Accounts ──────────────────────────────────── */}
      <Section title="401k / Traditional">
        <Row label="Current balance">
          <NumInput value={inputs.k401Today} onChange={set("k401Today")} prefix="$" step={1000} />
        </Row>
        <Row label="Your annual contribution" hint={`IRS max $${CONTRIB_LIMITS.k401.toLocaleString()}/yr (2026)`}>
          <NumInput value={inputs.k401AnnualContrib} onChange={set("k401AnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.k401} />
        </Row>
        <Row label="Employer match">
          <NumInput value={inputs.employerMatchPct} onChange={set("employerMatchPct")} suffix="% of salary" step={0.5} max={20} width={65} />
        </Row>
        <Note>
          You {fmt(inputs.k401AnnualContrib)} + match {fmt(plan.annualEmployerMatch)} ={" "}
          <strong style={{ color: "#3d8c78" }}>{fmt(plan.total401kAnnual)}/yr</strong>
          <div style={{ color: "#9db4ae", marginTop: 2 }}>Withdrawals taxed at retirement bracket — not {inputs.employmentBracket}%</div>
        </Note>
      </Section>

      <Section title="Roth IRA">
        <Row label="Current balance">
          <NumInput value={inputs.rothTotal} onChange={set("rothTotal")} prefix="$" step={1000} />
        </Row>
        {inputs.rothTotal > 0 && (
          <div style={{ background: "#f0f5f4", borderRadius: 8, padding: "10px 12px", marginBottom: 9, borderLeft: "3px solid #3d8c78" }}>
            <div style={{ fontSize: 10, color: "#7C9A92", marginBottom: 6 }}>Split existing balance:</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 10, color: "#7C9A92", marginBottom: 3 }}>Annual contributed</div>
                <NumInput value={inputs.rothAnnualContrib} onChange={set("rothAnnualContrib")} prefix="$" step={500} width={90} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#7C9A92", marginBottom: 3 }}>Years so far</div>
                <NumInput value={inputs.rothYearsContrib} onChange={set("rothYearsContrib")} min={0} max={40} width={70} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#7C9A92" }}>
              Contributions: <strong style={{ color: "#1a2e28" }}>{fmt(plan.rothContribNow)}</strong> · Earnings:{" "}
              <strong style={{ color: "#1a2e28" }}>{fmt(plan.rothEarningsNow)}</strong>
            </div>
          </div>
        )}
        <Row label="Contribution going forward" hint={`Max $${CONTRIB_LIMITS.rothIra.toLocaleString()}/yr (2026)`}>
          <NumInput value={inputs.rothAnnualContrib} onChange={set("rothAnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.rothIra} />
        </Row>
        <Row label="Existing Roth earnings" hint="Growth beyond contributions — leave 0 if unsure">
          <NumInput value={inputs.existingRothEarnings} onChange={set("existingRothEarnings")} prefix="$" step={1000} />
        </Row>
        <Note>
          Future contributions FV:{" "}
          <strong style={{ color: "#3d8c78" }}>{fmt(fvAnnuity(inputs.rothAnnualContrib, plan.yearsToRetire, inputs.stockReturn))}</strong>
          <div style={{ color: "#9db4ae", marginTop: 2 }}>
            {fmt(inputs.rothAnnualContrib)}/yr × {plan.yearsToRetire} yrs at {pct(inputs.stockReturn)}
          </div>
        </Note>
      </Section>

      <Collapsible title="Other savings & brokerage" hint="CD, municipal bonds, taxable brokerage">
        <Row label="CD / cash deposit">
          <NumInput value={inputs.cashDeposit} onChange={set("cashDeposit")} prefix="$" step={1000} />
        </Row>
        <Row label="Municipal bonds" hint={inputs.muniDoubleTaxFree ? "Double tax-free" : `State tax (${plan.effectiveStateTax}%) applies`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <NumInput value={inputs.muniBonds} onChange={set("muniBonds")} prefix="$" step={1000} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <NumInput value={inputs.muniReturn} onChange={set("muniReturn")} suffix="% yield" step={0.1} width={60} />
              <Toggle
                value={inputs.muniDoubleTaxFree ? "free" : "state"}
                onChange={(v) => set("muniDoubleTaxFree")(v === "free")}
                options={[{ value: "free", label: "Fed+State free" }, { value: "state", label: "State taxable" }]}
              />
            </div>
          </div>
        </Row>
        <Row label="Brokerage value">
          <NumInput value={inputs.existingBrokerage} onChange={set("existingBrokerage")} prefix="$" step={1000} />
        </Row>
        <Row label="Brokerage cost basis" hint={`Only gain above basis taxed at ${pct(plan.brokerageLtcgRate)} on sale`}>
          <NumInput value={inputs.existingBrokerageBasis} onChange={set("existingBrokerageBasis")} prefix="$" step={1000} />
        </Row>
      </Collapsible>

      <Collapsible title="HSA (Health Savings Account)" hint="Triple-tax-advantaged; grows & draws tax-free">
        <Row label="Current HSA balance">
          <NumInput value={inputs.hsaBalance} onChange={set("hsaBalance")} prefix="$" step={1000} />
        </Row>
        <Row
          label="Annual contribution"
          hint={`${TAX_YEAR}: $${CONTRIB_LIMITS.hsaFamily.toLocaleString()} family / $${CONTRIB_LIMITS.hsaIndividual.toLocaleString()} individual + $${CONTRIB_LIMITS.hsaCatchup.toLocaleString()} catch-up at 55`}
        >
          <NumInput value={inputs.hsaAnnualContrib} onChange={set("hsaAnnualContrib")} prefix="$" step={100} max={CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup} />
        </Row>
        <Note>
          HSA grows at the stock return rate and draws are modeled as tax-free (qualified medical).
          In the draw order it sits after munis and before brokerage — more efficient than taxable
          accounts.
        </Note>
      </Collapsible>

      <Collapsible title="Healthcare & Medicare" hint="ACA, IRMAA, state SS exemption">
        <Row label="ACA full premium" hint="Unsubsidized monthly; 0 = not tracked">
          <NumInput value={inputs.monthlyAcaFullPremium} onChange={set("monthlyAcaFullPremium")} prefix="$" step={50} />
        </Row>
        <Row label="IRMAA surcharge / mo" hint="Medicare Part B+D surcharge at 65+; 0 = none">
          <NumInput value={inputs.monthlyIrmaaSurcharge} onChange={set("monthlyIrmaaSurcharge")} prefix="$" step={69} />
        </Row>
        <Row label="State SS exemption" hint="Many states exempt SS income from state tax">
          <Toggle
            value={String(inputs.stateSsExemptRate)}
            onChange={(v) => set("stateSsExemptRate")(parseFloat(v))}
            options={[
              { value: "0", label: "None" },
              { value: "0.5", label: "50%" },
              { value: "1", label: "Full" },
            ]}
          />
        </Row>
        <Note>
          Enter the ACA premium here only if your monthly expenses above do <strong>not</strong>{" "}
          already include health insurance — otherwise you'll double-count it. The premium is added
          on top of expenses only when your income exceeds the ACA subsidy cliff (~$66k/yr for 2
          people); below that, subsidies are assumed to cover it. At 65, Medicare replaces ACA and
          the premium stops.
        </Note>
      </Collapsible>

      {/* ── Assumptions ───────────────────────────────── */}
      <Section title="Assumptions (rates)">
        <Row label="Stock market return" hint="Nominal">
          <NumInput value={inputs.stockReturn} onChange={set("stockReturn")} suffix="%" step={0.1} />
        </Row>
        <Row label="Inflation rate">
          <NumInput value={inputs.inflationRate} onChange={set("inflationRate")} suffix="%" step={0.1} />
        </Row>
        <Row label="CD / deposit rate">
          <NumInput value={inputs.cashDepositRate} onChange={set("cashDepositRate")} suffix="%" step={0.1} />
        </Row>
        <Note>
          Real return:{" "}
          <strong style={{ color: "#3d8c78", fontFamily: "'JetBrains Mono',monospace" }}>
            {pct(Math.max(0, inputs.stockReturn - inputs.inflationRate))}
          </strong>
          <span style={{ color: "#9db4ae" }}>
            {" "}= {pct(inputs.stockReturn)} − {pct(inputs.inflationRate)}
          </span>
        </Note>
      </Section>

      {/* ── Tax & strategy ────────────────────────────── */}
      <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid #eef2f1" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "#9db4ae", marginBottom: 10 }}>
          Tax Configuration & Strategy
        </div>

        <Collapsible title="Tax rates" hint="Employment bracket, capital gains, state">
          <Row label="Employment bracket" hint="CD interest during working years">
            <Toggle
              value={String(inputs.employmentBracket)}
              onChange={(v) => set("employmentBracket")(Number(v))}
              options={EMPLOYMENT_BRACKETS.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </Row>
          <Row label="Long-term cap gains">
            <Toggle
              value={String(inputs.ltcgBracket)}
              onChange={(v) => set("ltcgBracket")(Number(v))}
              options={LTCG_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </Row>
          <Row label="State income tax">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Select
                value={inputs.stateKey}
                onChange={set("stateKey")}
                options={STATE_TAXES.map((s) => ({ value: s.name, label: `${s.name}${s.rate > 0 ? ` (${s.rate}%)` : ""}` }))}
              />
              <Toggle
                value={inputs.stateTaxEnabled ? "on" : "off"}
                onChange={(v) => set("stateTaxEnabled")(v === "on")}
                options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
              />
            </div>
          </Row>
          <Note tone="warn">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>
                CD tax:{" "}
                <strong style={{ color: "#c97c1a", fontFamily: "'JetBrains Mono',monospace" }}>{pct(plan.accumulationOrdinaryRate)}</strong>
              </span>
              <span>
                Cap gains:{" "}
                <strong style={{ color: "#c97c1a", fontFamily: "'JetBrains Mono',monospace" }}>{pct(plan.brokerageLtcgRate)}</strong>
              </span>
            </div>
          </Note>
        </Collapsible>

        <Collapsible title="401k withdrawal tax preview" hint="Effective rate at any withdrawal amount">
          <Row label="Annual withdrawal to preview">
            <NumInput value={previewWithdrawal} onChange={setPreviewWithdrawal} prefix="$" step={5000} />
          </Row>
          <BracketBar annual={previewWithdrawal} stateTaxRate={plan.effectiveStateTax} filingStatus={inputs.filingStatus} />
          <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 8, lineHeight: 1.5 }}>
            At your projected {fmt(annualSpendAtRetirement)}/yr spend, the effective retirement rate is typically far below your{" "}
            {pct(plan.accumulationOrdinaryRate)} working rate.
          </div>
        </Collapsible>

        <Collapsible title="Early access (pre-59½)" hint="Rule of 55 or 72(t) SEPP">
          <Row label="Rule of 55" hint="Left employer at 55+? 401k accessible penalty-free.">
            <Toggle
              value={inputs.rule55 ? "yes" : "no"}
              onChange={(v) => set("rule55")(v === "yes")}
              options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]}
            />
          </Row>
          <Row label="72(t) SEPP / yr" hint="Substantially Equal Periodic Payments; 0 = none">
            <NumInput value={inputs.annualSepp} onChange={set("annualSepp")} prefix="$" step={1000} />
          </Row>
          <Note>
            SEPP must continue for 5 years or until 59½ (whichever is longer). Excess SEPP income
            after covering expenses is banked in CD for later use.
          </Note>
        </Collapsible>

        <Collapsible title="Spending guardrails (Guyton-Klinger)" hint="Auto-adjust spending based on withdrawal rate">
          <Row label="Upper guardrail" hint="Cut 10% if WR exceeds this; 0 = off">
            <NumInput
              value={inputs.guardrailUpper * 100}
              onChange={(v) => set("guardrailUpper")(v / 100)}
              suffix="% WR"
              step={0.5}
              min={0}
              max={25}
            />
          </Row>
          <Row label="Lower guardrail" hint="Raise 10% if WR falls below this; 0 = off">
            <NumInput
              value={inputs.guardrailLower * 100}
              onChange={(v) => set("guardrailLower")(v / 100)}
              suffix="% WR"
              step={0.5}
              min={0}
              max={15}
            />
          </Row>
          <Note>
            WR = net annual portfolio draw (spending minus SS) ÷ total portfolio. Checked each
            year-end. Typical: upper 5–6%, lower 3%. Set both to 0 to disable.
          </Note>
        </Collapsible>

        <Collapsible title="Roth conversion ladder" hint="Convert 401k → Roth during bridge at low rates">
          <div style={{ fontSize: 11, color: "#9db4ae", marginBottom: 10, lineHeight: 1.5 }}>
            During the bridge ({inputs.retireAge}→59½) your income is low. Converting fills the low brackets cheaply.
          </div>
          <Row label="Convert per year" hint="Taxed now, unlocks tax-free after 5 years">
            <NumInput value={inputs.annualRothConversion} onChange={set("annualRothConversion")} prefix="$" step={5000} />
          </Row>
          {inputs.annualRothConversion > 0 && (
            <div style={{ background: "#f0f5f4", borderRadius: 8, padding: "10px 12px", fontSize: 11, borderLeft: "3px solid #7C9A92" }}>
              <div style={{ marginBottom: 4 }}>
                Marginal tax rate:{" "}
                <strong style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  {pct((marginalFedRate(inputs.annualRothConversion, inputs.filingStatus) + plan.effectiveStateTax / 100) * 100)}
                </strong>
              </div>
              <div style={{ color: "#9db4ae" }}>Grows tax-free in Roth, unlocks as free contributions after 5 years.</div>
            </div>
          )}
        </Collapsible>
      </div>
    </div>
  );
}
