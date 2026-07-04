// ─────────────────────────────────────────────────────────────
//  Tool dispatcher (PRD §6, §4.2, §7) — pure and unit-tested.
//
//  dispatch(name, args, ctx) routes a tool call:
//    • read tools  → run the registry handler, return compact numbers.
//    • write tools → build a proposal, apply directly OR stage a
//      confirmation per the graduated-confirmation rules, record the
//      change to the structured change log, enforce the write budget.
//
//  It NEVER does arithmetic itself — every number comes from runAt /
//  the analysis routines via the registry. Side effects (mutating React
//  state) happen only through the injected `ctx.actions`, so the
//  dispatcher stays testable with mock actions.
//
//  Returns an immutable result describing the new state; the caller
//  (agentLoop) threads `plan` / `changeLog` / `writeCount` forward so
//  the agent reasons against current state within a turn.
// ─────────────────────────────────────────────────────────────

import { TOOL_REGISTRY, headline, makePlan } from "./toolRegistry.js";
import { runAt } from "../analysis/plan.js";
import { addChange, nextChangeId, changeLogForTool } from "./changeLog.js";
import { WRITE_OPS_PER_TURN } from "./featureFlags.js";

function ok(result, ctx, extra = {}) {
  return {
    result,
    isError: false,
    plan: ctx.plan,
    changeLog: ctx.changeLog,
    writeCount: ctx.writeCount ?? 0,
    ...extra,
  };
}

function err(message, ctx) {
  return ok({ error: message }, ctx, { isError: true });
}

// Fields whose mutation always requires the user's confirmation, even as a
// single small change: a mistyped agent patch to a balance or identity field
// silently rewrites the user's financial reality.
export const DANGEROUS_FIELDS = new Set([
  "k401Today",
  "rothTotal",
  "existingBrokerage",
  "existingBrokerageBasis",
  "cashDeposit",
  "muniBonds",
  "hsaBalance",
  "currentAge",
  "lifeExpect",
  "birthYear",
  "filingStatus",
  "hasSpouse",
  "alreadyRetired",
  "salary",
]);

/** Graduated-confirmation decision (§4.2). */
export function shouldStage(changes, confirmMode) {
  // View switches are harmless and never staged, regardless of mode.
  if (changes.length > 0 && changes.every((ch) => ch.scope === "view")) return false;
  if (confirmMode === "never") return false;
  if (confirmMode === "always") return true;
  // graduated:
  if (changes.some((ch) => ch.scope === "revert")) return true; // undo-all always confirms
  if (changes.some((ch) => DANGEROUS_FIELDS.has(ch.field))) return true;
  if (changes.length >= 2) return true; // 2+ changes in one turn
  const c = changes[0];
  if (!c) return false;
  if (c.field === "retireAge") return Math.abs(c.to - c.from) > 2;
  if (c.field === "monthlyExpense") {
    const base = Math.abs(c.from) || 1;
    return Math.abs(c.to - c.from) / base > 0.15; // spending ±>15%
  }
  if (c.field === "conversionCeiling") return true; // conversion ceiling change
  return false;
}

function applyProposal(kind, payload, plan, actions) {
  let newPlan = plan;
  if (kind === "inputs") {
    newPlan = makePlan({ ...plan, ...payload });
    actions?.applyInputs?.(payload);
  } else if (kind === "age") {
    newPlan = makePlan({ ...plan, retireAge: payload });
    actions?.applyAge?.(payload);
  } else if (kind === "scenario") {
    newPlan = makePlan({ ...plan, ...payload });
    actions?.applyScenario?.(payload);
  } else if (kind === "view") {
    // Pure UI navigation: no plan mutation, no undo baseline.
    if (payload?.tab) actions?.setView?.(payload.tab);
    if (payload?.runMonteCarlo) actions?.triggerMc?.();
  } else if (kind === "revert") {
    // The baseline snapshot lives in useAsk; the action does the restore and
    // flips the change-log statuses. The next turn's context reflects it.
    actions?.undoAllAgentChanges?.();
  }
  return newPlan;
}

function planHeadline(plan) {
  const res = runAt(plan, plan.retireAge);
  return res ? headline(res) : null;
}

export function dispatch(name, args = {}, ctx = {}) {
  const entry = TOOL_REGISTRY[name];
  const c = {
    plan: ctx.plan,
    changeLog: ctx.changeLog ?? [],
    writeCount: ctx.writeCount ?? 0,
    confirmMode: ctx.confirmMode ?? "graduated",
    actions: ctx.actions,
    stageConfirmation: ctx.stageConfirmation,
  };

  if (!entry) return err(`Unknown tool '${name}'.`, c);

  // ── read tools ────────────────────────────────────────────
  if (entry.kind === "read") {
    if (name === "get_change_log") {
      return ok({ changes: changeLogForTool(c.changeLog) }, c);
    }
    try {
      return ok(entry.handler(args, c.plan), c);
    } catch (e) {
      return err(e?.message ?? "Tool failed.", c);
    }
  }

  // ── write tools ───────────────────────────────────────────
  if (c.writeCount >= WRITE_OPS_PER_TURN) {
    return err(
      `Write budget reached (${WRITE_OPS_PER_TURN} changes per turn). Summarize what you've changed and ask the user how to proceed before changing more.`,
      c,
    );
  }

  let proposal;
  try {
    proposal = entry.buildProposal(args, c.plan);
  } catch (e) {
    return err(e?.message ?? "Could not build the change.", c);
  }

  if (!proposal.changes.length) {
    return ok({ status: "no_change", changes: [], note: "Those values already match the current plan." }, c);
  }

  // View switches are pure navigation: apply immediately, keep them out of
  // the change log and the write budget (they're not plan mutations).
  if (proposal.kind === "view") {
    applyProposal(proposal.kind, proposal.payload, c.plan, c.actions);
    return ok({ status: "applied", changes: proposal.changes }, c);
  }

  // Stamp ids so the change log, audit trail and confirmation card agree.
  const changes = proposal.changes.map((ch) => ({ ...ch, id: nextChangeId() }));

  if (shouldStage(changes, c.confirmMode)) {
    let changeLog = c.changeLog;
    for (const ch of changes) {
      changeLog = addChange(changeLog, { ...ch, status: "awaiting_confirmation" });
    }
    c.stageConfirmation?.({
      toolName: name,
      kind: proposal.kind,
      payload: proposal.payload,
      changes,
    });
    // Preview numbers so the agent narrates the would-be outcome (not applied yet).
    const previewPlan = applyProposal(proposal.kind, proposal.payload, c.plan, undefined);
    const preview =
      proposal.kind === "scenario" || proposal.kind === "revert" ? undefined : planHeadline(previewPlan);
    return ok(
      { status: "awaiting_confirmation", changes, preview },
      { ...c, changeLog },
      { changeLog, writeCount: c.writeCount + 1 },
    );
  }

  // Apply directly.
  const newPlan = applyProposal(proposal.kind, proposal.payload, c.plan, c.actions);
  let changeLog = c.changeLog;
  for (const ch of changes) {
    changeLog = addChange(changeLog, { ...ch, status: "applied" });
  }
  return ok(
    { status: "applied", changes, result: planHeadline(newPlan) },
    c,
    { plan: newPlan, changeLog, writeCount: c.writeCount + 1 },
  );
}
