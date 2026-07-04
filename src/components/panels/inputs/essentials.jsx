// Essentials section bodies: You · Money · Spending · Assumptions.
// Shared by the desktop accordion and the mobile shell (one source of truth
// for fields, two layouts). Expert mode reveals the deeper layer.
import { useState } from "react";
import { NumInput, Select, Toggle } from "../../ui.jsx";
import { Field, Grid2, Grid3, Divider, SubTitle, MaxChip, StreamEditor, useExpertMode } from "./atoms.jsx";
import {
  CONTRIB_LIMITS, FILING_STATUS, FILING_STATUS_LABELS, TAX_YEAR,
} from "../../../constants/brackets.js";
import { fmt, fmtK, pct } from "../../../format.js";

export function YouFields({ inputs, set, plan }) {
  const isMFJ = inputs.filingStatus === FILING_STATUS.MFJ;
  return (
    <>
      <Field label="Life stage" help="alreadyRetired">
        <Toggle
          value={inputs.alreadyRetired ? "retired" : "planning"}
          onChange={(v) => set("alreadyRetired")(v === "retired")}
          options={[
            { value: "planning", label: "Still working" },
            { value: "retired", label: "Retired" },
          ]}
        />
      </Field>
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

// "+ Add account" affordance (simple mode): zero-balance account groups
// collapse to a single row of add buttons instead of empty field blocks.
function AddAccountRow({ hidden, onAdd }) {
  if (!hidden.length) return null;
  return (
    <>
      <Divider />
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9db4ae" }}>
          + Add account
        </span>
        {hidden.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onAdd(key)}
            style={{ border: "1px dashed #9db4ae", background: "#fafcfc", color: "#3d8c78", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "4px 9px" }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

export function MoneyFields({ inputs, set, plan }) {
  const ret = plan.alreadyRetired;
  const expert = useExpertMode();
  // Simple mode: zero-balance accounts hide behind "+ Add account" until the
  // user reveals them (or a balance exists). Expert mode shows everything.
  const [revealed, setRevealed] = useState(() => new Set());
  const showAcct = (key, ...values) => expert || revealed.has(key) || values.some((v) => (v ?? 0) > 0);
  const reveal = (key) => setRevealed((prev) => new Set(prev).add(key));

  // What the user saves per month across every account (their own contributions,
  // excluding employer match). 401k/Roth/HSA are entered yearly; the rest monthly.
  const monthlySavings =
    (inputs.k401AnnualContrib + inputs.rothAnnualContrib + (inputs.hsaAnnualContrib ?? 0)) / 12 +
    (inputs.brokerageMonthlyContrib ?? 0) + (inputs.cashMonthlyContrib ?? 0) + (inputs.muniMonthlyContrib ?? 0);
  const annualSavings = monthlySavings * 12;
  const savingsPctSalary = inputs.salary > 0 ? (annualSavings / inputs.salary) * 100 : 0;

  const showCash = showAcct("cash", inputs.cashDeposit, inputs.cashMonthlyContrib);
  const showMuni = showAcct("muni", inputs.muniBonds, inputs.muniMonthlyContrib);
  const showBrokerage = showAcct("brokerage", inputs.existingBrokerage, inputs.brokerageMonthlyContrib);
  const showHsa = showAcct("hsa", inputs.hsaBalance, inputs.hsaAnnualContrib);
  const hiddenAccounts = [
    !showCash && { key: "cash", label: "Cash / CDs" },
    !showMuni && { key: "muni", label: "Muni bonds" },
    !showBrokerage && { key: "brokerage", label: "Brokerage" },
    !showHsa && { key: "hsa", label: "HSA" },
  ].filter(Boolean);

  return (
    <>
      {!ret && (
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
        </>
      )}
      <SubTitle>401k / Traditional</SubTitle>
      <Grid2>
        <Field label="Balance" help="k401Today">
          <NumInput value={inputs.k401Today} onChange={set("k401Today")} prefix="$" step={1000} width={95} />
        </Field>
        {!ret && (
          <Field label={`Contrib/yr (max $${(CONTRIB_LIMITS.k401 / 1000).toFixed(0)}k)`} help="k401AnnualContrib">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NumInput value={inputs.k401AnnualContrib} onChange={set("k401AnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.k401} width={88} />
              <MaxChip onClick={() => set("k401AnnualContrib")(CONTRIB_LIMITS.k401)} />
            </div>
          </Field>
        )}
      </Grid2>
      {!ret && (
        <>
          <Field label="Employer match % of salary" help="employerMatchPct">
            <NumInput value={inputs.employerMatchPct} onChange={set("employerMatchPct")} suffix="%" step={0.5} max={20} width={70} />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            You {fmtK(inputs.k401AnnualContrib)} + match {fmtK(plan.annualEmployerMatch)} = <strong style={{ color: "#3d8c78" }}>{fmtK(plan.total401kAnnual)}/yr</strong>
          </div>
        </>
      )}
      <Divider />
      <SubTitle>Roth IRA</SubTitle>
      <Field label="Total balance" help="rothTotal">
        <NumInput value={inputs.rothTotal} onChange={set("rothTotal")} prefix="$" step={1000} width={120} />
      </Field>
      <Grid2>
        {!ret && (
          <Field label={`Contrib/yr (max $${(CONTRIB_LIMITS.rothIra / 1000).toFixed(1)}k)`} help="rothAnnualContrib">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NumInput value={inputs.rothAnnualContrib} onChange={set("rothAnnualContrib")} prefix="$" step={500} max={CONTRIB_LIMITS.rothIra} width={88} />
              <MaxChip onClick={() => set("rothAnnualContrib")(CONTRIB_LIMITS.rothIra)} />
            </div>
          </Field>
        )}
        <Field label="Yrs so far" help="rothYearsContrib">
          <NumInput value={inputs.rothYearsContrib} onChange={set("rothYearsContrib")} min={0} max={40} width={78} />
        </Field>
      </Grid2>
      {expert && (
        <>
          <Field label="Existing earnings (0 if unsure)" help="existingRothEarnings">
            <NumInput value={inputs.existingRothEarnings} onChange={set("existingRothEarnings")} prefix="$" step={1000} width={120} />
          </Field>
          <div style={{ fontSize: 10, color: "#9db4ae" }}>
            Contribs: <strong style={{ color: "#1a2e28" }}>{fmtK(plan.rothContribNow)}</strong> · Earnings: <strong style={{ color: "#1a2e28" }}>{fmtK(plan.rothEarningsNow)}</strong>
          </div>
        </>
      )}
      {showCash && (
        <>
          <Divider />
          <SubTitle>Cash & CDs</SubTitle>
          <Grid2>
            <Field label="Balance" help="cashDeposit">
              <NumInput value={inputs.cashDeposit} onChange={set("cashDeposit")} prefix="$" step={1000} width={95} />
            </Field>
            {!ret && (
              <Field label="Contribute/mo" help="cashMonthlyContrib">
                <NumInput value={inputs.cashMonthlyContrib} onChange={set("cashMonthlyContrib")} prefix="$" step={100} width={95} />
              </Field>
            )}
          </Grid2>
        </>
      )}
      {showMuni && (
        <>
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
          {!ret && (
            <Field label="Contribute/mo" help="muniMonthlyContrib">
              <NumInput value={inputs.muniMonthlyContrib} onChange={set("muniMonthlyContrib")} prefix="$" step={100} width={120} />
            </Field>
          )}
          {expert && (
            <Field label="Tax status" help="muniDoubleTaxFree">
              <Toggle
                value={inputs.muniDoubleTaxFree ? "free" : "state"}
                onChange={(v) => set("muniDoubleTaxFree")(v === "free")}
                options={[{ value: "free", label: "Fed+State free" }, { value: "state", label: "State taxable" }]}
              />
            </Field>
          )}
        </>
      )}
      {showBrokerage && (
        <>
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
          {!ret && (
            <Field label="Contribute/mo" help="brokerageMonthlyContrib">
              <NumInput value={inputs.brokerageMonthlyContrib} onChange={set("brokerageMonthlyContrib")} prefix="$" step={100} width={120} />
            </Field>
          )}
        </>
      )}
      {showHsa && (
        <>
          <Divider />
          <SubTitle>HSA (triple tax-advantaged)</SubTitle>
          <Grid2>
            <Field label="Balance" help="hsaBalance">
              <NumInput value={inputs.hsaBalance} onChange={set("hsaBalance")} prefix="$" step={1000} width={95} />
            </Field>
            {!ret && (
              <Field label={`Contrib/yr (${TAX_YEAR} max $${(CONTRIB_LIMITS.hsaFamily / 1000).toFixed(1)}k)`} help="hsaAnnualContrib">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <NumInput value={inputs.hsaAnnualContrib} onChange={set("hsaAnnualContrib")} prefix="$" step={100} max={CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup} width={80} />
                  <MaxChip onClick={() => set("hsaAnnualContrib")(CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup)} />
                </div>
              </Field>
            )}
          </Grid2>
        </>
      )}
      <AddAccountRow hidden={hiddenAccounts} onAdd={reveal} />
    </>
  );
}

export function SpendingFields({ inputs, set, plan }) {
  const expert = useExpertMode();
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
      {(expert || inputs.ssPia > 0) && (
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
      )}
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
      {expert && (
        <>
          <Divider />
          <SubTitle>Other income in retirement</SubTitle>
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            Pension, annuity, part-time work, rental. Taxable streams raise SS taxation, ACA premiums and IRMAA like real ordinary income.
          </div>
          <StreamEditor
            value={inputs.incomeStreams}
            onChange={set("incomeStreams")}
            kind="income"
            defaultStartAge={Math.max(inputs.retireAge, 65)}
          />
          <Divider />
          <SubTitle>Expenses that end</SubTitle>
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            Mortgage P&I, a loan — costs on top of monthly expenses that stop at a known age.
          </div>
          <StreamEditor
            value={inputs.expenseStreams}
            onChange={set("expenseStreams")}
            kind="expense"
            defaultStartAge={inputs.retireAge}
          />
        </>
      )}
    </>
  );
}

export function AssumptionsFields({ inputs, set }) {
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
