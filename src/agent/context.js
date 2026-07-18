// ─────────────────────────────────────────────────────────────
//  Context & token management (PRD §5).
//
//  • buildPlanContext — a compact, per-turn snapshot of the user's
//    current inputs, latest headline results, and the §4.4 change
//    block. Refreshed each turn and injected as user-turn context
//    (Haiku doesn't support mid-conversation system messages), so the
//    agent reasons against the CURRENT plan, not the original.
//  • trimMessages — rolling verbatim window of the last N turns; older
//    turns are dropped (folded into a one-line recap pointer). Keeps
//    the change log + plan summary authoritative for numbers.
//  • estimateTokens — cheap client-side heuristic for the soft token
//    budget (§9). A real count_tokens check would need the API; this
//    is good enough to drive warn/stop thresholds and trimming.
// ─────────────────────────────────────────────────────────────

import { fmt } from "../format.js";
import { renderChangeLogForContext } from "./changeLog.js";
import { allocationAt } from "../engine/allocation.js";
import { annualSavingsBudget } from "../analysis/fundingOrder.js";

// Keep this many of the most recent turns verbatim (a turn = one message).
export const VERBATIM_MESSAGES = 12; // ~6 user/assistant exchanges

/** Compact plan + results + changes snapshot for the model's context. */
export function buildPlanContext(inputs, plan, results = {}, changeLog = []) {
  const { earliest, sustainable, mcSuccess, totalAtRetirement, survives, depletionAge } = results;
  const L = [];
  L.push("## Current plan (authoritative — use run_scenario for any what-if)");
  if (plan.alreadyRetired) {
    L.push(`- The user is ALREADY RETIRED (age ${inputs.currentAge}). Do not suggest retirement-age changes or earliest-retirement searches; focus on sustainable spend, Roth conversions, RMDs, Medicare/IRMAA, and sequence risk. Planning horizon: to ${inputs.lifeExpect}. Household ${inputs.householdSize}.`);
  } else {
    L.push(`- Current age ${inputs.currentAge}, target retire age ${inputs.retireAge}, life expectancy ${inputs.lifeExpect}, household ${inputs.householdSize}.`);
  }
  L.push(`- Monthly spend (today's $): ${fmt(inputs.monthlyExpense)}; at retirement: ${fmt(Math.round(plan.monthlyAtRetirement))}.`);
  L.push(`- Accounts: 401k ${fmt(inputs.k401Today)}, Roth ${fmt(inputs.rothTotal)}, brokerage ${fmt(inputs.existingBrokerage)}, muni ${fmt(inputs.muniBonds)}, cash ${fmt(inputs.cashDeposit)}.`);
  L.push(`- Assumptions: ${inputs.stockReturn}% stock return, ${inputs.inflationRate}% inflation; SS at ${inputs.ssAge}.`);
  if (plan.allocationEnabled) {
    const a = allocationAt(plan, plan.currentAge);
    const pct = (x) => Math.round(x * 100);
    const mode =
      plan.riskProfile === "custom" || plan.pinAllocation
        ? "fixed custom mix (pinned, no glide)"
        : `${plan.riskProfile} glide (equity share falls with age)`;
    L.push(
      `- Allocation: ${mode} — currently ${pct(a.equity)}% equity / ${pct(a.bond)}% bond / ${pct(a.cash)}% cash; bond return ${plan.bondReturn}%. Change with set_allocation.`,
    );
  } else {
    L.push(`- Allocation: not modeled (flat ${inputs.stockReturn}% growth). Enable it and pick a risk profile with set_allocation.`);
  }
  if (!plan.alreadyRetired) {
    const budget = annualSavingsBudget(plan);
    if (budget > 0)
      L.push(`- Funding order: saving ~${fmt(Math.round(budget))}/yr across accounts. Re-route the SAME budget tax-optimally (match → HSA → Roth → 401k → brokerage overflow) with route_savings.`);
  }
  L.push(`- Scenario overlay: ${inputs.scenarioMode}.`);
  if (results.tab) L.push(`- Dashboard tab the user is viewing: ${results.tab} (switchable via set_view).`);
  if (plan.incomeStreams?.length) {
    L.push(`- Income streams: ${plan.incomeStreams.map((s) => `${s.label ?? "stream"} ${fmt(s.monthly)}/mo from ${s.startAge ?? "now"}${s.endAge ? ` to ${s.endAge}` : ""}`).join("; ")}.`);
  }
  if (plan.expenseStreams?.length) {
    L.push(`- Expense streams: ${plan.expenseStreams.map((s) => `${s.label ?? "cost"} ${fmt(s.monthly)}/mo${s.endAge ? ` until ${s.endAge}` : ""}`).join("; ")}.`);
  }
  if (plan.survivorAge > 0) L.push(`- Survivor scenario modeled: spouse dies at primary's age ${plan.survivorAge}; spending continues at ${Math.round(plan.survivorSpendFraction * 100)}%.`);

  L.push("");
  L.push("## Latest headline results");
  if (totalAtRetirement != null) L.push(`- Portfolio at retirement (age ${inputs.retireAge}): ${fmt(totalAtRetirement)}.`);
  if (survives != null) {
    L.push(`- Verdict at age ${inputs.retireAge}: ${survives ? `money lasts to ${inputs.lifeExpect}` : `depletes around age ${depletionAge}`}.`);
  }
  if (earliest != null) L.push(`- Earliest viable retirement age: ${earliest}.`);
  if (sustainable != null) L.push(`- Sustainable monthly spend: ${fmt(Math.round(sustainable))}.`);
  if (mcSuccess != null) L.push(`- Monte Carlo success rate: ${Math.round(mcSuccess * 100)}%.`);

  L.push("");
  L.push("## Changes Ask has applied this session");
  L.push(renderChangeLogForContext(changeLog));

  return L.join("\n");
}

/**
 * Rolling history window: keep the last VERBATIM_MESSAGES messages. If older
 * turns are dropped, prepend a one-line recap pointer so the agent knows
 * context was trimmed (the change log + plan summary carry the real state).
 */
const isToolResultUser = (m) =>
  m && m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b?.type === "tool_result");

export function trimMessages(messages, keep = VERBATIM_MESSAGES) {
  if (messages.length <= keep) return messages;
  // Cut point; walk it BACK so the window never starts on a tool_result turn
  // whose matching assistant tool_use was dropped (the API 400s otherwise).
  let start = messages.length - keep;
  while (start > 0 && isToolResultUser(messages[start])) start -= 1;
  if (start <= 0) return messages;
  const recap = {
    role: "user",
    content: `[Earlier conversation trimmed: ${start} message(s). The current plan and the list of changes Ask has made are summarized in the context above and remain authoritative.]`,
  };
  return [recap, ...messages.slice(start)];
}

/** Rough token estimate (~4 chars/token) over system + tools + messages. */
export function estimateTokens({ system = "", tools = [], messages = [] } = {}) {
  const json = JSON.stringify({ system, tools, messages });
  return Math.ceil(json.length / 4);
}
