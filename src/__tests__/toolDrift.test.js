import { describe, it, expect } from "vitest";
import { makePlan, DEFAULTS } from "../analysis/plan.js";
import { TOOL_REGISTRY } from "../agent/toolRegistry.js";
import { buildToolDefs } from "../agent/toolDefs.js";
import { dispatch } from "../agent/toolDispatch.js";

// Cheap structural guard so NL descriptions and schemas can't silently diverge
// from the handlers as the analysis functions evolve (PRD §14).

const plan = makePlan(DEFAULTS);

describe("tool-description drift guard", () => {
  it("every registry entry has a non-empty description and a schema", () => {
    for (const [name, entry] of Object.entries(TOOL_REGISTRY)) {
      expect(entry.description, `${name} description`).toBeTruthy();
      expect(entry.description.length, `${name} description length`).toBeGreaterThan(20);
      expect(entry.schema, `${name} schema`).toBeTypeOf("object");
      expect(["read", "write"]).toContain(entry.kind);
    }
  });

  it("buildToolDefs mirrors the registry 1:1", () => {
    const defs = buildToolDefs();
    expect(defs.map((d) => d.name).sort()).toEqual(Object.keys(TOOL_REGISTRY).sort());
    for (const d of defs) {
      expect(d.description).toBe(TOOL_REGISTRY[d.name].description);
      expect(d.input_schema.type).toBe("object");
    }
  });

  it("update_inputs patchFields are all real plan/DEFAULTS keys", () => {
    for (const f of TOOL_REGISTRY.update_inputs.patchFields) {
      expect(DEFAULTS, `patch field ${f}`).toHaveProperty(f);
    }
  });

  it("each read tool's documented returnKeys exist on a real run", () => {
    const sampleArgs = {
      run_scenario: { age: 60 },
      find_earliest_retirement: {},
      max_sustainable_spend: {},
      run_monte_carlo: { age: 60 },
      optimize_roth_conversions: {},
      stress_or_history: { type: "stress", age: 60 },
      run_analysis: { type: "sensitivity" },
      get_change_log: {},
    };
    for (const [name, entry] of Object.entries(TOOL_REGISTRY)) {
      if (entry.kind !== "read") continue;
      const out = dispatch(name, sampleArgs[name], { plan, changeLog: [] });
      expect(out.isError, `${name} should not error`).toBe(false);
      for (const key of entry.returnKeys) {
        expect(out.result, `${name} → ${key}`).toHaveProperty(key);
      }
    }
  });
});
