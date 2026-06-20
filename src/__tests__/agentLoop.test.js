import { describe, it, expect } from "vitest";
import { makePlan, DEFAULTS } from "../analysis/plan.js";
import { runAgentTurn } from "../agent/agentLoop.js";
import { _resetChangeIds } from "../agent/changeLog.js";

const plan = makePlan(DEFAULTS);

// Build a transport from a script of responses; captures the messages it was
// sent so we can assert tool_results were fed back.
function scripted(responses) {
  let i = 0;
  const seen = [];
  const fn = async ({ messages }) => {
    seen.push(messages);
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return { incomplete: false, usage: { output_tokens: 5 }, ...r };
  };
  fn.seen = seen;
  return fn;
}

describe("agentLoop — manual tool-use loop", () => {
  it("runs tool_use → tool_result → end_turn and records the trajectory", async () => {
    _resetChangeIds();
    const transport = scripted([
      {
        content: [
          { type: "text", text: "Let me run that." },
          { type: "tool_use", id: "t1", name: "run_scenario", input: { age: 60 } },
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "The model projects your money lasts." }], stop_reason: "end_turn" },
    ]);

    const out = await runAgentTurn({ userText: "Can I retire at 60?", plan, transport });

    expect(out.stopReason).toBe("end_turn");
    expect(out.trajectory).toHaveLength(1);
    expect(out.trajectory[0].name).toBe("run_scenario");
    expect(out.trajectory[0].isError).toBe(false);
    // The number came from the engine, not the model.
    expect(out.trajectory[0].result).toHaveProperty("endEstate");

    // Second request must contain a tool_result for t1.
    const secondReq = transport.seen[1];
    const toolResultMsg = secondReq.find(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result" && b.tool_use_id === "t1"),
    );
    expect(toolResultMsg).toBeTruthy();
    expect(out.usage.output_tokens).toBe(10); // accumulated across both requests
  });

  it("stops at the ≤8 iteration ceiling when the model never ends the turn", async () => {
    const transport = scripted([
      {
        content: [{ type: "tool_use", id: "x", name: "find_earliest_retirement", input: {} }],
        stop_reason: "tool_use",
      },
    ]);
    const out = await runAgentTurn({ userText: "loop forever", plan, transport });
    expect(out.hitCeiling).toBe(true);
    expect(out.trajectory).toHaveLength(8);
  });

  it("surfaces a tool error as a non-fatal tool_result and keeps going", async () => {
    const transport = scripted([
      {
        content: [{ type: "tool_use", id: "e1", name: "run_scenario", input: { age: 20 } }],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "That age is too early." }], stop_reason: "end_turn" },
    ]);
    const out = await runAgentTurn({ userText: "retire at 20?", plan, transport });
    expect(out.trajectory[0].isError).toBe(true);
    expect(out.stopReason).toBe("end_turn");
    const fed = transport.seen[1].find((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"));
    const tr = fed.content.find((b) => b.type === "tool_result");
    expect(tr.is_error).toBe(true);
  });

  it("threads applied write changes through the change log", async () => {
    _resetChangeIds();
    const applied = [];
    const transport = scripted([
      {
        content: [{ type: "tool_use", id: "w1", name: "set_retire_age", input: { age: plan.retireAge + 1 } }],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "Done — nudged your retire age." }], stop_reason: "end_turn" },
    ]);
    const out = await runAgentTurn({
      userText: "bump my retire age by one year",
      plan,
      transport,
      confirmMode: "graduated",
      actions: { applyAge: (a) => applied.push(a) },
    });
    expect(applied).toEqual([plan.retireAge + 1]);
    expect(out.changeLog).toHaveLength(1);
    expect(out.changeLog[0].status).toBe("applied");
    expect(out.plan.retireAge).toBe(plan.retireAge + 1);
  });

  it("stages a large write and does not call the action", async () => {
    _resetChangeIds();
    const applied = [];
    const staged = [];
    const transport = scripted([
      {
        content: [{ type: "tool_use", id: "w2", name: "set_retire_age", input: { age: plan.retireAge + 6 } }],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "I've staged that — confirm to apply." }], stop_reason: "end_turn" },
    ]);
    const out = await runAgentTurn({
      userText: "retire 6 years later",
      plan,
      transport,
      actions: { applyAge: (a) => applied.push(a) },
      stageConfirmation: (s) => staged.push(s),
    });
    expect(applied).toEqual([]);
    expect(staged).toHaveLength(1);
    expect(out.changeLog[0].status).toBe("awaiting_confirmation");
  });
});
