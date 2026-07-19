// Fine-tuning section bodies: Taxes · Strategy · Healthcare · Estate ·
// Levers · Advanced · Scenario. Expert mode reveals the auto tax/Medicare
// models, HSA medical fraction, and the survivor scenario.
import { useState } from "react";
import { NumInput, Select, Toggle } from "../../ui.jsx";
import { Field, Grid2, Grid3, Divider, SubTitle, OneTimeExpenses, useExpertMode } from "./atoms.jsx";
import { BracketBar } from "../../charts/BracketBar.jsx";
import { marginalFedRate } from "../../../engine/tax.js";
import { fraForBirthYear } from "../../../engine/socialSecurity.js";
import {
  STATE_TAXES, EMPLOYMENT_BRACKETS, LTCG_RATES, TAX_YEAR, FED_BRACKETS,
} from "../../../constants/brackets.js";
import { HISTORICAL_SCENARIOS } from "../../../constants/historicalReturns.js";
import { fmtK, pct } from "../../../format.js";

export function TaxesFields({ inputs, set, plan, previewWithdrawal: pwProp, setPreviewWithdrawal: setPwProp }) {
  // Optionally controlled: the desktop sidebar owns this state so the preview
  // amount survives collapsing/reopening Taxes. Falls back to internal state
  // when rendered standalone (mobile), where a reset is harmless.
  const [pwLocal, setPwLocal] = useState(50000);
  const previewWithdrawal = pwProp ?? pwLocal;
  const setPreviewWithdrawal = setPwProp ?? setPwLocal;
  const expert = useExpertMode();
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
      {expert && (
        <Field label="Capital gains model" help="autoLtcg">
          <Toggle
            value={inputs.autoLtcg ? "auto" : "manual"}
            onChange={(v) => set("autoLtcg")(v === "auto")}
            options={[{ value: "auto", label: "Real brackets + NIIT" }, { value: "manual", label: "Flat rate" }]}
          />
        </Field>
      )}
      {!inputs.autoLtcg && (
        <Field label="Long-term cap gains" help="ltcgBracket">
          <Toggle
            value={String(inputs.ltcgBracket)}
            onChange={(v) => set("ltcgBracket")(Number(v))}
            options={LTCG_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
          />
        </Field>
      )}
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
        CD tax: <strong style={{ color: "#c97c1a" }}>{pct(plan.accumulationOrdinaryRate)}</strong> · Cap gains:{" "}
        {inputs.autoLtcg
          ? <strong style={{ color: "#c97c1a" }}>auto (0/15/20% by income + NIIT)</strong>
          : <strong style={{ color: "#c97c1a" }}>{pct(plan.brokerageLtcgRate)}</strong>}
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

export function StrategyFields({ inputs, set, plan }) {
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
          . Converted principal unlocks tax- and penalty-free 5 years after each conversion — at any age.
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


export function HealthcareFields({ inputs, set }) {
  const expert = useExpertMode();
  return (
    <>
      <Field label="ACA benchmark premium/mo" hint="Only if not already in monthly expenses" help="monthlyAcaFullPremium">
        <NumInput value={inputs.monthlyAcaFullPremium} onChange={set("monthlyAcaFullPremium")} prefix="$" step={50} width={95} />
      </Field>
      {expert && (
        <Field label="Medicare model" help="autoMedicare">
          <Toggle
            value={inputs.autoMedicare ? "auto" : "manual"}
            onChange={(v) => set("autoMedicare")(v === "auto")}
            options={[{ value: "auto", label: "Part B + IRMAA by income" }, { value: "manual", label: "Flat surcharge" }]}
          />
        </Field>
      )}
      {!inputs.autoMedicare && (
        <Field label="IRMAA/mo" hint="Medicare Part B+D surcharge at 65+" help="monthlyIrmaaSurcharge">
          <NumInput value={inputs.monthlyIrmaaSurcharge} onChange={set("monthlyIrmaaSurcharge")} prefix="$" step={69} width={95} />
        </Field>
      )}
      {expert && (
        <Field label="Medical share of spending" hint="Share of expenses HSA can pay tax-free" help="hsaQualifiedFraction">
          <NumInput
            value={Math.round(inputs.hsaQualifiedFraction * 100)}
            onChange={(v) => set("hsaQualifiedFraction")(Math.min(100, Math.max(0, v)) / 100)}
            suffix="%"
            step={5}
            min={0}
            max={100}
            width={70}
          />
        </Field>
      )}
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

export function EstateFields({ inputs, set }) {
  const expert = useExpertMode();
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
      {expert && (
        <>
          <Divider />
          <SubTitle>Survivor scenario</SubTitle>
          <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
            The "widow's tax torpedo": after a spouse dies, the survivor files single (higher brackets),
            keeps only the larger SS benefit, and spends less. 0 = not modeled.
          </div>
          <Grid2>
            <Field label="Spouse dies at your age" help="survivorAge">
              <NumInput value={inputs.survivorAge} onChange={set("survivorAge")} min={0} max={105} width={70} />
            </Field>
            <Field label="Spending continues" help="survivorSpendFraction">
              <NumInput
                value={Math.round(inputs.survivorSpendFraction * 100)}
                onChange={(v) => set("survivorSpendFraction")(Math.min(100, Math.max(10, v)) / 100)}
                suffix="%"
                step={5}
                min={10}
                max={100}
                width={70}
              />
            </Field>
          </Grid2>
        </>
      )}
    </>
  );
}

export function AdvancedFields({ inputs, set, plan }) {
  const ltcPreset = () => {
    const list = inputs.oneTimeExpenses ?? [];
    set("oneTimeExpenses")([...list, { age: 82, amount: 150000 }]);
  };
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
      <SubTitle>One-time expenses &amp; windfalls</SubTitle>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 8 }}>
        Lump amounts in today's $ (wedding, home repair, new car). Negative = windfall (inheritance,
        downsizing) banked into cash when it lands.
      </div>
      <OneTimeExpenses
        value={inputs.oneTimeExpenses}
        onChange={set("oneTimeExpenses")}
        defaultAge={Math.min(inputs.retireAge + 5, inputs.lifeExpect - 1)}
      />
      <div style={{ marginTop: 8 }}>
        <button
          onClick={ltcPreset}
          title="Adds a $150k long-term-care shock at age 82 — a common stress case"
          style={{ border: "1px dashed #c97c1a", background: "#fff8e8", color: "#a06010", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px" }}
        >
          + Long-term-care shock ($150k at 82)
        </button>
      </div>
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

// Sensitivity levers — "what moves your earliest retirement age?" Each row
// applies one change to the inputs, all else equal. The lever data is
// Retire-Early-specific; in other tabs it shows a contextual note.
export function LeversFields({ sensitivityRows = [], appliedLevers = [], onApplyLever, onUndoLevers }) {
  if (!sensitivityRows.length) {
    return (
      <div style={{ fontSize: 11, color: "#7C9A92", lineHeight: 1.55 }}>
        Switch to the <strong style={{ color: "#1a2e28" }}>Retire Early</strong> tab to see what moves
        your earliest retirement age — each lever applies one change to your inputs, all else equal.
      </div>
    );
  }
  return (
    <>
      <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 14, lineHeight: 1.5 }}>
        Apply one to write it into your inputs and re-run. Each changes one thing, all else equal.
      </div>

      {appliedLevers.length > 0 && (
        <div style={{ background: "#f0f5f4", borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4a5e58" }}>Applied ({appliedLevers.length})</span>
            <button
              type="button"
              onClick={onUndoLevers}
              style={{ border: "none", background: "transparent", color: "#3d8c78", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              Undo all
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#4a5e58", lineHeight: 1.5 }}>{appliedLevers.join(" · ")}</div>
        </div>
      )}

      {sensitivityRows.map(({ label, newEarliest, delta, apply }) => {
        const noChange = delta === null || delta === 0;
        const applied = appliedLevers.includes(label);
        return (
          <div key={label} style={{ borderBottom: "1px solid #e2e8e6", padding: "0 0 10px", marginBottom: 10, opacity: applied ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#4a5e58", flex: 1, minWidth: 0 }}>{label}</span>
              {applied ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#3d8c78", whiteSpace: "nowrap" }}>✓ Applied</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onApplyLever?.(apply, label)}
                  title={`Apply "${label}" to your inputs`}
                  style={{ flexShrink: 0, border: "1px solid #3d8c78", background: "transparent", color: "#3d8c78", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}
                >
                  Apply
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, background: "#e2e8e6", borderRadius: 99, height: 3, overflow: "hidden" }}>
                {delta > 0 && (
                  <div style={{ width: `${Math.min(100, (delta / 10) * 100)}%`, height: "100%", background: "#3d8c78", borderRadius: 99, minWidth: 4 }} />
                )}
              </div>
              {newEarliest != null && (
                <span style={{ fontSize: 10, color: "#9db4ae", fontFamily: "'JetBrains Mono', monospace" }}>→ {newEarliest}</span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", minWidth: 44, textAlign: "right", color: delta > 0 ? "#3d8c78" : noChange ? "#9db4ae" : "#c0392b" }}>
                {delta > 0 ? `−${delta}yr` : noChange ? "—" : `+${Math.abs(delta ?? 0)}yr`}
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.5, marginTop: 4 }}>
        Bar = years gained (max 10). Full simulation per row — taxes, SS, inflation, draw order.
      </div>
    </>
  );
}

export function ScenarioFields({ inputs, set }) {
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
