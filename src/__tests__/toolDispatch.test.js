import { describe, it, expect, beforeEach } from "vitest";
import { makePlan, DEFAULTS, runAt, projectTo, projectAtRetirement } from "../analysis/plan.js";
import { TOOL_REGISTRY } from "../agent/toolRegistry.js";
import { buildToolDefs } from "../agent/toolDefs.js";
import { dispatch, shouldStage } from "../agent/toolDispatch.js";
import { _resetChangeIds } from "../agent/changeLog.js";

const plan = makePlan(DEFAULTS);

// The exact on-screen "portfolio at retirement" sum App.jsx renders.
function appPortfolioSum(proj) {
  return Math.round(
    proj.rothContributions + proj.rothEarnings + proj.k401 + proj.brokerage + proj.cashDeposit + proj.muniBonds + (proj.hsaBalance ?? 0),
  );
}

beforeEach(() => _resetChangeIds());

describe("read tools — compact numbers from the real engine", () => {
  it("run_scenario matches a direct runAt at the same age/overrides", () => {
    const r = dispatch("run_scenario", { age: 60, monthlyExpense: 8000 }, { plan });
    expect(r.isError).toBe(false);
    const direct = runAt(plan, 60, { monthlyExpense: 8000 });
    const last = direct.snaps.at(-1);
    expect(r.result.age).toBe(60);
    expect(r.result.survives).toBe(direct.depleted == null); // matches the panel verdict
    expect(r.result.endEstate).toBe(Math.round((last.total ?? 0) - (direct.estateGainTax ?? 0)));
    // portfolio-at-retirement comes from the projection sum, NOT snaps[0]
    // (the first yearly snapshot lands ~1yr into retirement).
    expect(r.result.portfolioAtRetirement).toBe(appPortfolioSum(projectTo(plan, 60 - plan.currentAge, { monthlyExpense: 8000 })));
  });

  it("run_scenario at the configured age equals the App's on-screen totalAtRetirement", () => {
    // The trust-critical parity check: pin the tool's number to the value App
    // RENDERS (projectAtRetirement sum), not to the engine call it wraps.
    const r = dispatch("run_scenario", {}, { plan }).result;
    expect(r.portfolioAtRetirement).toBe(appPortfolioSum(projectAtRetirement(plan)));
  });

  it("run_scenario defaults to the configured retire age", () => {
    const r = dispatch("run_scenario", {}, { plan });
    expect(r.result.age).toBe(plan.retireAge);
  });

  it("find_earliest_retirement returns earliestAge + targetAge", () => {
    const r = dispatch("find_earliest_retirement", {}, { plan });
    expect(r.result).toHaveProperty("earliestAge");
    expect(r.result.targetAge).toBe(plan.retireAge);
  });

  it("max_sustainable_spend returns a monthly number", () => {
    const r = dispatch("max_sustainable_spend", {}, { plan });
    expect(typeof r.result.monthlyAtRetirement).toBe("number");
  });

  it("run_monte_carlo is seeded → deterministic", () => {
    const a = dispatch("run_monte_carlo", { age: 60 }, { plan }).result;
    const b = dispatch("run_monte_carlo", { age: 60 }, { plan }).result;
    expect(a.successRate).toBe(b.successRate);
    expect(a.successRate).toBeGreaterThanOrEqual(0);
    expect(a.successRate).toBeLessThanOrEqual(1);
  });

  it("optimize_roth_conversions returns a strategy", () => {
    const r = dispatch("optimize_roth_conversions", {}, { plan }).result;
    expect(["fill", "none"]).toContain(r.type);
    expect(r).toHaveProperty("gain");
  });

  it("stress_or_history runs both modes", () => {
    const s = dispatch("stress_or_history", { type: "stress", age: 60, dropPct: 40, years: 2 }, { plan }).result;
    expect(s.scenarioType).toContain("stress");
    const h = dispatch("stress_or_history", { type: "historical", age: 60, scenario: "gfc2007" }, { plan }).result;
    expect(h.scenarioType).toContain("gfc2007");
  });

  it("engine errors surface as a non-fatal tool error", () => {
    const r = dispatch("run_scenario", { age: 20 }, { plan }); // age < currentAge
    expect(r.isError).toBe(true);
    expect(r.result.error).toMatch(/before the current age/i);
  });

  it("unknown tool is a non-fatal error", () => {
    const r = dispatch("does_not_exist", {}, { plan });
    expect(r.isError).toBe(true);
  });
});

describe("write tools — graduated confirmation gating (§4.2)", () => {
  it("small reversible age change applies directly", () => {
    const calls = [];
    const r = dispatch("set_retire_age", { age: plan.retireAge + 1 }, {
      plan,
      confirmMode: "graduated",
      actions: { applyAge: (a) => calls.push(a) },
    });
    expect(r.result.status).toBe("applied");
    expect(calls).toEqual([plan.retireAge + 1]);
    expect(r.changeLog).toHaveLength(1);
    expect(r.changeLog[0].status).toBe("applied");
    expect(r.writeCount).toBe(1);
  });

  it("large age change (>2) stages for confirmation, no action call", () => {
    const calls = [];
    const staged = [];
    const r = dispatch("set_retire_age", { age: plan.retireAge + 5 }, {
      plan,
      confirmMode: "graduated",
      actions: { applyAge: (a) => calls.push(a) },
      stageConfirmation: (s) => staged.push(s),
    });
    expect(r.result.status).toBe("awaiting_confirmation");
    expect(calls).toEqual([]); // nothing applied
    expect(staged).toHaveLength(1);
    expect(r.changeLog[0].status).toBe("awaiting_confirmation");
  });

  it("multi-field update_inputs stages even if each change is small", () => {
    const r = dispatch("update_inputs", { ssAge: plan.ssAge + 1, stockReturn: plan.stockReturn + 0.1 }, {
      plan,
      confirmMode: "graduated",
      stageConfirmation: () => {},
    });
    expect(r.result.status).toBe("awaiting_confirmation");
    expect(r.result.changes).toHaveLength(2);
  });

  it("spending change >15% stages; ≤15% applies", () => {
    const big = dispatch("update_inputs", { monthlyExpense: Math.round(plan.monthlyExpense * 1.3) }, {
      plan, confirmMode: "graduated", stageConfirmation: () => {},
    });
    expect(big.result.status).toBe("awaiting_confirmation");
    const small = dispatch("update_inputs", { monthlyExpense: Math.round(plan.monthlyExpense * 1.05) }, {
      plan, confirmMode: "graduated", actions: { applyInputs: () => {} },
    });
    expect(small.result.status).toBe("applied");
  });

  it("confirmMode 'always' stages even a 1-year age nudge", () => {
    const r = dispatch("set_retire_age", { age: plan.retireAge + 1 }, {
      plan, confirmMode: "always", stageConfirmation: () => {},
    });
    expect(r.result.status).toBe("awaiting_confirmation");
  });

  it("confirmMode 'never' applies a large change directly", () => {
    const r = dispatch("set_retire_age", { age: plan.retireAge + 9 }, {
      plan, confirmMode: "never", actions: { applyAge: () => {} },
    });
    expect(r.result.status).toBe("applied");
  });

  it("write budget blocks the 4th write in a turn", () => {
    const r = dispatch("set_retire_age", { age: plan.retireAge + 1 }, {
      plan, confirmMode: "never", writeCount: 3, actions: { applyAge: () => {} },
    });
    expect(r.isError).toBe(true);
    expect(r.result.error).toMatch(/budget/i);
  });

  it("no-op write reports no_change without consuming budget", () => {
    const r = dispatch("set_retire_age", { age: plan.retireAge }, { plan });
    expect(r.result.status).toBe("no_change");
    expect(r.writeCount).toBe(0);
  });

  it("applied write threads an updated plan forward", () => {
    const r = dispatch("set_retire_age", { age: plan.retireAge + 2 }, {
      plan, confirmMode: "never", actions: { applyAge: () => {} },
    });
    expect(r.plan.retireAge).toBe(plan.retireAge + 2);
  });

  it("get_change_log reflects prior changes", () => {
    const first = dispatch("set_retire_age", { age: plan.retireAge + 1 }, {
      plan, confirmMode: "never", actions: { applyAge: () => {} },
    });
    const log = dispatch("get_change_log", {}, { plan: first.plan, changeLog: first.changeLog });
    expect(log.result.changes).toHaveLength(1);
    expect(log.result.changes[0].field).toBe("retireAge");
  });
});

describe("shouldStage helper", () => {
  it("respects modes", () => {
    expect(shouldStage([{ field: "retireAge", from: 55, to: 56 }], "never")).toBe(false);
    expect(shouldStage([{ field: "retireAge", from: 55, to: 56 }], "always")).toBe(true);
    expect(shouldStage([{ field: "retireAge", from: 55, to: 56 }], "graduated")).toBe(false);
    expect(shouldStage([{ field: "retireAge", from: 55, to: 60 }], "graduated")).toBe(true);
  });
});

// ── Phase 5: tool parity — generalized writer, danger tiers, new tools ──
import { sensitivity } from "../analysis/sensitivity.js";
import { UPDATE_PATCH_FIELDS } from "../agent/toolRegistry.js";
import { DANGEROUS_FIELDS } from "../agent/toolDispatch.js";

describe("update_inputs: generalized field surface", () => {
  it("patchFields cover (almost) all scalar DEFAULTS keys", () => {
    expect(UPDATE_PATCH_FIELDS).toContain("k401Today");
    expect(UPDATE_PATCH_FIELDS).toContain("rule55");
    expect(UPDATE_PATCH_FIELDS).toContain("filingStatus");
    expect(UPDATE_PATCH_FIELDS).toContain("alreadyRetired");
    expect(UPDATE_PATCH_FIELDS).not.toContain("retireAge");        // set_retire_age owns it
    expect(UPDATE_PATCH_FIELDS).not.toContain("scenarioMode");     // set_scenario owns it
    expect(UPDATE_PATCH_FIELDS).not.toContain("oneTimeExpenses");  // arrays are UI-only
  });

  it("a single dangerous-field change is ALWAYS staged (balance edit)", () => {
    let staged = null;
    const r = dispatch("update_inputs", { k401Today: 500_000 }, { plan, stageConfirmation: (c) => (staged = c) });
    expect(r.result.status).toBe("awaiting_confirmation");
    expect(staged.changes[0].field).toBe("k401Today");
  });

  it("a small harmless tweak still applies directly", () => {
    let applied = null;
    const r = dispatch("update_inputs", { stockReturn: 9.5 }, { plan, actions: { applyInputs: (p) => (applied = p) } });
    expect(r.result.status).toBe("applied");
    expect(applied.stockReturn).toBe(9.5);
  });

  it("type mismatches and bad enums are rejected with a helpful error", () => {
    expect(dispatch("update_inputs", { k401Today: "a lot" }, { plan }).isError).toBe(true);
    expect(dispatch("update_inputs", { filingStatus: "married" }, { plan }).isError).toBe(true);
    expect(dispatch("update_inputs", { stateKey: "Atlantis" }, { plan }).isError).toBe(true);
  });

  it("every DANGEROUS_FIELDS entry is a real patchable/DEFAULTS field", () => {
    for (const f of DANGEROUS_FIELDS) expect(DEFAULTS, f).toHaveProperty(f);
  });
});

describe("set_view", () => {
  it("switches tabs immediately — never staged, not logged, no write budget", () => {
    let tab = null;
    let mc = false;
    const r = dispatch(
      "set_view",
      { tab: "maximize", runMonteCarlo: true },
      { plan, confirmMode: "always", actions: { setView: (t) => (tab = t), triggerMc: () => (mc = true) } },
    );
    expect(r.result.status).toBe("applied");
    expect(tab).toBe("maximize");
    expect(mc).toBe(true);
    expect(r.changeLog ?? []).toHaveLength(0);
    expect(r.writeCount ?? 0).toBe(0);
  });
});

describe("apply_lever", () => {
  it("applies a known lever's patch through the normal inputs flow", () => {
    const rows = sensitivity(plan);
    const label = rows[0].label;
    let staged = null;
    let applied = null;
    const r = dispatch("apply_lever", { label }, {
      plan,
      stageConfirmation: (c) => (staged = c),
      actions: { applyInputs: (p) => (applied = p) },
    });
    expect(r.isError).toBe(false);
    // Either staged (multi-field/dangerous) or applied — but through the inputs kind.
    expect(staged?.kind ?? "inputs").toBe("inputs");
    expect(r.result.status === "applied" || r.result.status === "awaiting_confirmation").toBe(true);
  });

  it("unknown labels list the valid levers", () => {
    const r = dispatch("apply_lever", { label: "make me rich" }, { plan });
    expect(r.isError).toBe(true);
    expect(r.result.error).toMatch(/Valid levers/);
  });
});

describe("revert_changes", () => {
  it("is always staged; confirming routes to undoAllAgentChanges", () => {
    let staged = null;
    const r = dispatch("revert_changes", {}, { plan, stageConfirmation: (c) => (staged = c) });
    expect(r.result.status).toBe("awaiting_confirmation");
    expect(staged.kind).toBe("revert");
  });
});

describe("run_analysis parity with the panels", () => {
  it("sensitivity rows match sensitivity(plan)", () => {
    const r = dispatch("run_analysis", { type: "sensitivity" }, { plan });
    const direct = sensitivity(plan);
    expect(r.result.rows.length).toBe(Math.min(10, direct.length));
    expect(r.result.rows[0].label).toBe(direct[0].label);
    expect(r.result.rows[0].yearsEarlier).toBe(direct[0].delta);
  });

  it("retire_by_age returns the goal-seek shape", () => {
    const r = dispatch("run_analysis", { type: "retire_by_age", targetAge: 52 }, { plan });
    expect(r.result.targetAge).toBe(52);
    expect(typeof r.result.feasible).toBe("boolean");
  });
});

describe("set_allocation", () => {
  // confirmMode:"never" forces the apply path so we can inspect the payload
  // (applyInputs receives the changed-fields patch, not the merged plan).
  const run = (args, ctx = {}) => {
    let applied = null;
    const r = dispatch("set_allocation", args, {
      plan,
      confirmMode: "never",
      actions: { applyInputs: (p) => (applied = p) },
      ...ctx,
    });
    return { r, applied };
  };

  it("a named risk profile enables allocation and sets the glide", () => {
    const { r, applied } = run({ riskProfile: "conservative" });
    expect(r.isError).toBe(false);
    expect(applied.allocationEnabled).toBe(true);
    expect(applied.riskProfile).toBe("conservative");
  });

  it("rejects an unknown risk profile", () => {
    const { r } = run({ riskProfile: "yolo" });
    expect(r.isError).toBe(true);
    expect(r.result.error).toMatch(/riskProfile must be one of/);
  });

  it("rejects a custom mix that does not total 100%", () => {
    const { r } = run({ equityPct: 70, bondPct: 20, cashPct: 5 });
    expect(r.isError).toBe(true);
    expect(r.result.error).toMatch(/must total 100/);
  });

  it("pins a valid custom mix and marks it custom", () => {
    const { r, applied } = run({ equityPct: 50, bondPct: 30, cashPct: 20 });
    expect(r.isError).toBe(false);
    expect(applied.riskProfile).toBe("custom");
    expect(applied.pinAllocation).toBe(true);
    expect(applied.equityPct).toBe(50);
    expect(applied.allocationEnabled).toBe(true);
  });

  it("enabled:false turns allocation off", () => {
    const onPlan = makePlan({ ...DEFAULTS, allocationEnabled: true });
    let applied = null;
    const r = dispatch("set_allocation", { enabled: false }, {
      plan: onPlan,
      confirmMode: "never",
      actions: { applyInputs: (p) => (applied = p) },
    });
    expect(r.isError).toBe(false);
    expect(applied.allocationEnabled).toBe(false);
  });

  it("errors when nothing would change", () => {
    const { r } = run({});
    expect(r.isError).toBe(true);
    expect(r.result.error).toMatch(/Nothing to change/);
  });

  it("allocation fields are excluded from update_inputs (single-owner)", () => {
    for (const f of ["allocationEnabled", "riskProfile", "pinAllocation", "equityPct", "bondPct", "cashPct"]) {
      expect(UPDATE_PATCH_FIELDS).not.toContain(f);
    }
  });
});
