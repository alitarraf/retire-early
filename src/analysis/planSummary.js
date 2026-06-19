// Builds a plain-text / markdown summary of the current plan and results,
// for the user to download and bring to a financial planner. Pure function —
// formats inputs + already-computed results; runs no simulation itself.
import { fmt, fmtK, pct } from "../format.js";
import { FILING_STATUS_LABELS } from "../constants/brackets.js";

export function buildPlanSummary(inputs, plan, result, extras = {}) {
  const { earliest = null, sustainable = null, mcResult = null, totalAtRetirement = null } = extras;

  const snaps = result?.snaps ?? [];
  const endVal = (snaps[snaps.length - 1]?.total ?? 0) - (result?.estateGainTax ?? 0);
  const survives = result?.depleted == null;
  const portfolio = totalAtRetirement != null ? totalAtRetirement : (snaps[0]?.total ?? 0);
  const date = new Date().toISOString().slice(0, 10);

  const L = [];
  L.push(`# Retirement Plan Summary`);
  L.push(`Generated ${date} · Educational planning tool — not financial advice.`);
  L.push(``);

  L.push(`## You`);
  L.push(`- Filing status: ${FILING_STATUS_LABELS[inputs.filingStatus] ?? inputs.filingStatus}`);
  L.push(`- Current age: ${inputs.currentAge}`);
  L.push(`- Target retire age: ${inputs.retireAge}`);
  L.push(`- Life expectancy (plan horizon): ${inputs.lifeExpect}`);
  L.push(`- Household size: ${inputs.householdSize}`);
  L.push(`- Social Security claim age: ${inputs.ssAge}`);
  L.push(``);

  L.push(`## Accounts (today)`);
  L.push(`- 401k / Traditional: ${fmt(inputs.k401Today)}`);
  L.push(`- Roth IRA: ${fmt(inputs.rothTotal)}`);
  L.push(`- Taxable brokerage: ${fmt(inputs.existingBrokerage)} (basis ${fmt(inputs.existingBrokerageBasis)})`);
  L.push(`- Municipal bonds: ${fmt(inputs.muniBonds)}`);
  L.push(`- CD / cash: ${fmt(inputs.cashDeposit)}`);
  L.push(`- HSA: ${fmt(inputs.hsaBalance ?? 0)}`);
  L.push(``);

  L.push(`## Spending & assumptions`);
  L.push(`- Monthly expenses (today's $): ${fmt(inputs.monthlyExpense)}`);
  L.push(`- Monthly expenses at retirement: ${fmt(Math.round(plan.monthlyAtRetirement))}`);
  L.push(`- Stock return: ${pct(inputs.stockReturn)} · Inflation: ${pct(inputs.inflationRate)}`);
  L.push(``);

  L.push(`## Results`);
  L.push(`- Portfolio at retirement (age ${inputs.retireAge}): ${fmt(portfolio)}`);
  if (earliest != null) L.push(`- Earliest viable retirement age: ${earliest}`);
  L.push(`- Plan verdict at age ${inputs.retireAge}: ${survives ? `money lasts to ${inputs.lifeExpect}` : `depletes around age ${Math.ceil(result.depleted)}`}`);
  if (sustainable != null) L.push(`- Sustainable monthly spend: ${fmt(Math.round(sustainable))}`);
  L.push(`- Projected estate at ${inputs.lifeExpect}: ${fmt(endVal)}`);
  if (mcResult) L.push(`- Monte Carlo success rate: ${Math.round(mcResult.successRate * 100)}% (median estate ${fmtK(mcResult.medianEndTotal ?? mcResult.p50EndTotal ?? 0)})`);
  L.push(``);

  const strat = [];
  if (inputs.conversionCeiling > 0) strat.push(`Roth bracket-fill conversions through age ${inputs.conversionEndAge}`);
  else if (inputs.annualRothConversion > 0) strat.push(`Roth conversions of ${fmt(inputs.annualRothConversion)}/yr`);
  if (inputs.rule55) strat.push(`Rule of 55 early 401k access`);
  if (inputs.annualSepp > 0) strat.push(`72(t) SEPP of ${fmt(inputs.annualSepp)}/yr`);
  if (inputs.guardrailUpper > 0) strat.push(`Guyton-Klinger guardrails`);
  if (strat.length) {
    L.push(`## Strategy in use`);
    strat.forEach((s) => L.push(`- ${s}`));
    L.push(``);
  }

  L.push(`## Questions for a planner`);
  L.push(`- Does my withdrawal sequence and Roth conversion plan look tax-efficient?`);
  L.push(`- Is my Social Security claiming age right for my situation?`);
  L.push(`- Are my return and inflation assumptions reasonable for my risk tolerance?`);
  L.push(`- How should I adjust if markets drop early in retirement?`);
  L.push(``);
  L.push(`_This summary reflects a simplified planning model. Verify Social Security at ssa.gov and taxes with a CPA before acting._`);

  return L.join("\n");
}
