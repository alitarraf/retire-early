// ─────────────────────────────────────────────────────────────
//  agentLoop (PRD §7, §11) — the manual agentic loop, client-side.
//
//  One call = one user turn. It streams a model response; on
//  stop_reason "tool_use" it executes every tool_use block through the
//  pure dispatcher (threading plan / changeLog / writeCount forward so
//  the agent reasons against current state), appends one user message
//  with all tool_result blocks, and re-requests — until end_turn or the
//  ≤8 iteration ceiling. The model never does arithmetic; all numbers
//  come from tool results.
//
//  transport and dispatchImpl are injected so the loop is testable with
//  a scripted mock transport (no live API key in CI, §14).
// ─────────────────────────────────────────────────────────────

import { buildSystemPrompt } from "./systemPrompt.js";
import { buildToolDefs } from "./toolDefs.js";
import { trimMessages } from "./context.js";
import { dispatch as defaultDispatch } from "./toolDispatch.js";
import { streamChat } from "./chatClient.js";
import { MAX_TOOL_ITERATIONS } from "./featureFlags.js";

function summarizeResult(result) {
  if (result == null) return "";
  if (result.error) return result.error;
  if (result.status) return result.status;
  return Object.entries(result)
    .slice(0, 4)
    .map(([k, v]) => `${k}=${typeof v === "number" ? v : JSON.stringify(v)}`)
    .join(", ");
}

function mergeUsage(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/**
 * Run one user turn.
 * @returns {Promise<{messages, trajectory, changeLog, plan, usage, stopReason, incomplete, hitCeiling}>}
 */
export async function runAgentTurn({
  userText,
  history = [],
  planContext = "",
  plan,
  changeLog = [],
  confirmMode = "graduated",
  actions,
  stageConfirmation,
  maxTokens = 1024,
  signal,
  authToken,
  callbacks = {},
  transport = streamChat,
  dispatchImpl = defaultDispatch,
  system = buildSystemPrompt(),
  tools = buildToolDefs(),
} = {}) {
  const working = [...history, { role: "user", content: userText }];
  const trajectory = [];
  let usage = {};
  let writeCount = 0;
  let stopReason = null;
  let incomplete = false;
  let hitCeiling = false;
  let curPlan = plan;
  let curLog = changeLog;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // Inject the volatile plan summary as a leading user-turn block each request
    // (Haiku has no mid-conversation system role). History stays clean.
    const requestMessages = [
      ...(planContext ? [{ role: "user", content: planContext }] : []),
      ...trimMessages(working),
    ];

    const resp = await transport({
      system,
      tools,
      messages: requestMessages,
      maxTokens,
      signal,
      authToken,
      onText: callbacks.onText,
      onToolUseStart: callbacks.onToolUseStart,
    });

    usage = mergeUsage(usage, resp.usage);
    stopReason = resp.stop_reason;
    incomplete = resp.incomplete;
    working.push({ role: "assistant", content: resp.content });
    callbacks.onAssistant?.(resp);

    if (resp.stop_reason !== "tool_use") break;

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (!toolUses.length) break;

    const toolResults = [];
    for (const tu of toolUses) {
      const out = dispatchImpl(tu.name, tu.input ?? {}, {
        plan: curPlan,
        changeLog: curLog,
        writeCount,
        confirmMode,
        actions,
        stageConfirmation,
      });
      curPlan = out.plan;
      curLog = out.changeLog;
      writeCount = out.writeCount;
      const step = { id: tu.id, name: tu.name, args: tu.input ?? {}, result: out.result, isError: out.isError, summary: summarizeResult(out.result) };
      trajectory.push(step);
      callbacks.onToolResult?.(step);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(out.result),
        is_error: out.isError,
      });
    }
    working.push({ role: "user", content: toolResults });

    if (i === MAX_TOOL_ITERATIONS - 1) {
      hitCeiling = true;
      callbacks.onCeiling?.();
    }
  }

  return {
    messages: working,
    trajectory,
    changeLog: curLog,
    plan: curPlan,
    usage,
    stopReason,
    incomplete,
    hitCeiling,
  };
}
