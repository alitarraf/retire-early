import { describe, it, expect } from "vitest";
import { makePlan, DEFAULTS } from "../analysis/plan.js";
import { buildPlanContext, trimMessages, estimateTokens, VERBATIM_MESSAGES } from "../agent/context.js";
import { addChange } from "../agent/changeLog.js";

const inputs = DEFAULTS;
const plan = makePlan(DEFAULTS);

describe("context.js — compaction & change block", () => {
  it("compact plan summary includes current inputs and results", () => {
    const ctx = buildPlanContext(inputs, plan, { earliest: 52, survives: true, totalAtRetirement: 1_000_000 }, []);
    expect(ctx).toMatch(/target retire age 55/);
    expect(ctx).toMatch(/Earliest viable retirement age: 52/);
    expect(ctx).toMatch(/money lasts to/);
  });

  it("change block reflects the structured change log (§4.4)", () => {
    let log = [];
    log = addChange(log, { field: "monthlyExpense", from: 10000, to: 8000, scope: "input", status: "applied" });
    const ctx = buildPlanContext(inputs, plan, {}, log);
    expect(ctx).toMatch(/monthlyExpense: 10000 → 8000/);
  });

  it("trimMessages keeps the last N and adds a recap pointer when trimming", () => {
    const msgs = Array.from({ length: VERBATIM_MESSAGES + 5 }, (_, i) => ({ role: "user", content: `m${i}` }));
    const trimmed = trimMessages(msgs);
    expect(trimmed.length).toBe(VERBATIM_MESSAGES + 1); // recap + window
    expect(trimmed[0].content).toMatch(/trimmed/i);
    expect(trimmed.at(-1).content).toBe(msgs.at(-1).content);
  });

  it("trimMessages never starts the window on an orphaned tool_result", () => {
    // assistant tool_use at the boundary, tool_result just inside the window:
    // the cut must walk back to include the tool_use, or the API 400s.
    const base = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const msgs = [
      ...base,
      { role: "assistant", content: [{ type: "tool_use", id: "t", name: "x", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "{}" }] },
      { role: "assistant", content: "ok" },
    ];
    const trimmed = trimMessages(msgs, 2); // tiny window forces a cut mid-pair
    const firstReal = trimmed.find((m) => m.role !== "user" || typeof m.content === "string" || !m.content.some?.((b) => b?.type === "tool_result"));
    // No tool_result turn should appear without its preceding tool_use in the window.
    const idx = trimmed.findIndex((m) => Array.isArray(m.content) && m.content.some((b) => b?.type === "tool_result"));
    if (idx > -1) {
      const prev = trimmed[idx - 1];
      expect(Array.isArray(prev.content) && prev.content.some((b) => b?.type === "tool_use")).toBe(true);
    }
    expect(firstReal).toBeTruthy();
  });

  it("trimMessages is a no-op under the window", () => {
    const msgs = [{ role: "user", content: "a" }, { role: "assistant", content: "b" }];
    expect(trimMessages(msgs)).toEqual(msgs);
  });

  it("estimateTokens grows with content", () => {
    const small = estimateTokens({ system: "hi", tools: [], messages: [] });
    const big = estimateTokens({ system: "hi".repeat(1000), tools: [], messages: [] });
    expect(big).toBeGreaterThan(small);
  });
});
