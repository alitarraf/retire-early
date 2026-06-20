import { describe, it, expect } from "vitest";
import { makePlan, DEFAULTS, runAt, simParamsAt, projectTo } from "../analysis/plan.js";
import { monteCarlo } from "../engine/monteCarlo.js";
import { earliestRetireAge } from "../analysis/earliestRetireAge.js";
import { runAgentTurn } from "../agent/agentLoop.js";
import { headline } from "../agent/toolRegistry.js";

// Golden-path tests (PRD §14): canonical questions run against a scripted model
// transcript → assert the TOOL the model called and the NUMBERS it received
// match a real engine run. Guards against tool/description drift and proves the
// loop quotes engine numbers (never invents them).

const plan = makePlan(DEFAULTS);

// Transport that emits a single tool call, then an end_turn. Captures the
// tool_result content fed back so we can compare it to a direct engine run.
function oneToolThenDone(name, input) {
  const fed = { content: null };
  let i = 0;
  const fn = async ({ messages }) => {
    if (i++ === 0) {
      return {
        content: [{ type: "tool_use", id: "g1", name, input }],
        stop_reason: "tool_use",
        usage: {},
        incomplete: false,
      };
    }
    // Capture the tool_result that was fed back on the follow-up request.
    const last = messages.at(-1);
    fed.content = last.content.find((b) => b.type === "tool_result");
    return { content: [{ type: "text", text: "done" }], stop_reason: "end_turn", usage: {}, incomplete: false };
  };
  fn.fed = fed;
  return fn;
}

describe("golden paths", () => {
  it("'Can I retire at 57?' → run_scenario, numbers match runAt(plan, 57)", async () => {
    const t = oneToolThenDone("run_scenario", { age: 57 });
    const out = await runAgentTurn({ userText: "Can I retire at 57?", plan, transport: t });

    expect(out.trajectory[0].name).toBe("run_scenario");
    const expected = headline(runAt(plan, 57));
    const fed = JSON.parse(t.fed.content.content);
    expect(fed.survives).toBe(expected.survives);
    expect(fed.endEstate).toBe(expected.endEstate);
    const proj = projectTo(plan, 57 - plan.currentAge);
    const appTotal = Math.round(
      proj.rothContributions + proj.rothEarnings + proj.k401 + proj.brokerage + proj.cashDeposit + proj.muniBonds + (proj.hsaBalance ?? 0),
    );
    expect(fed.portfolioAtRetirement).toBe(appTotal);
  });

  it("'What are my odds?' → run_monte_carlo, successRate matches a seeded run", async () => {
    const t = oneToolThenDone("run_monte_carlo", { age: 57 });
    await runAgentTurn({ userText: "What are my odds at 57?", plan, transport: t });
    const expected = monteCarlo(simParamsAt(plan, 57), { n: 500, seed: 42 });
    const fed = JSON.parse(t.fed.content.content);
    expect(fed.successRate).toBe(Math.round(expected.successRate * 1000) / 1000);
  });

  it("'How early can I retire?' → find_earliest_retirement matches the search", async () => {
    const t = oneToolThenDone("find_earliest_retirement", {});
    await runAgentTurn({ userText: "How early can I retire?", plan, transport: t });
    const fed = JSON.parse(t.fed.content.content);
    expect(fed.earliestAge).toBe(earliestRetireAge(plan));
  });
});
