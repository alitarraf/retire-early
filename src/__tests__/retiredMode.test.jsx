// @vitest-environment node
// Phase 4 — already-retired first-class mode
// makePlan pins retireAge to currentAge and zeroes accumulation flows in the
// NORMALIZED plan only (raw inputs preserved); the agent knows and refuses
// retirement-age moves; RetiredPanel renders without NaN.

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { makePlan, runMain, projectAtRetirement } from "../analysis/plan.js";
import { sustainableSpend } from "../analysis/sustainableSpend.js";
import { dynamicOptimizer } from "../analysis/dynamicOptimizer.js";
import { buildPlanContext } from "../agent/context.js";
import { TOOL_REGISTRY } from "../agent/toolRegistry.js";
import { RetiredPanel } from "../components/panels/RetiredPanel.jsx";

const retiredInputs = {
  alreadyRetired: true,
  currentAge: 64,
  retireAge: 55, // stale planning value — must be overridden
  lifeExpect: 90,
  k401Today: 1_500_000,
  rothTotal: 300_000,
  cashDeposit: 200_000,
  monthlyExpense: 7000,
  salary: 150_000,
  k401AnnualContrib: 20_000,
  rothAnnualContrib: 7_000,
};

describe("makePlan retired normalization", () => {
  const plan = makePlan(retiredInputs);

  it("pins retireAge to currentAge", () => {
    expect(plan.retireAge).toBe(64);
    expect(plan.yearsToRetire).toBe(0);
    expect(plan.monthlyAtRetirement).toBe(plan.monthlyExpense);
  });

  it("zeroes accumulation flows in the normalized plan", () => {
    expect(plan.k401AnnualContrib).toBe(0);
    expect(plan.rothAnnualContrib).toBe(0);
    expect(plan.salary).toBe(0);
    expect(plan.annualEmployerMatch).toBe(0);
    expect(plan.total401kAnnual).toBe(0);
  });

  it("raw inputs are untouched — toggling back restores contributions", () => {
    const back = makePlan({ ...retiredInputs, alreadyRetired: false });
    expect(back.k401AnnualContrib).toBe(20_000);
    expect(back.salary).toBe(150_000);
    expect(back.retireAge).toBe(55);
  });

  it("projection at retirement equals today's balances (no growth years)", () => {
    const p = projectAtRetirement(plan);
    expect(p.k401).toBeCloseTo(1_500_000, 0);
  });

  it("the full pipeline runs: verdict + sustainable spend + optimizer", () => {
    const result = runMain(plan);
    expect(result).not.toBeNull();
    expect(sustainableSpend(plan)).toBeGreaterThan(0);
    const rec = dynamicOptimizer(plan);
    expect(rec.estateWith).toBeGreaterThanOrEqual(rec.estateBase - 1);
  });
});

describe("agent awareness", () => {
  const plan = makePlan(retiredInputs);

  it("plan context leads with the retired line", () => {
    const ctx = buildPlanContext(retiredInputs, plan, {}, []);
    expect(ctx).toMatch(/ALREADY RETIRED/);
    expect(ctx).not.toMatch(/target retire age/);
  });

  it("find_earliest_retirement short-circuits", () => {
    const out = TOOL_REGISTRY.find_earliest_retirement.handler({}, plan);
    expect(out.alreadyRetired).toBe(true);
    expect(out.note).toMatch(/already retired/);
  });

  it("set_retire_age refuses with a helpful error", () => {
    expect(() => TOOL_REGISTRY.set_retire_age.buildProposal({ age: 70 }, plan)).toThrow(/already retired/);
  });
});

describe("RetiredPanel renders", () => {
  it("renders without NaN for a surviving plan", () => {
    const plan = makePlan(retiredInputs);
    const result = runMain(plan);
    const html = renderToString(
      <RetiredPanel
        plan={plan}
        result={result}
        mcResult={null}
        scenario={null}
        totalAtRetirement={2_000_000}
        sustainable={9000}
        dynamicOpt={dynamicOptimizer(plan)}
        onApplyOptimized={() => {}}
      />,
    );
    expect(html).not.toMatch(/NaN/);
    expect(html).toMatch(/This year/); // apostrophe is HTML-escaped in SSR output
  });

  it("renders the depleting state (money runs out)", () => {
    const plan = makePlan({ ...retiredInputs, monthlyExpense: 30_000 });
    const result = runMain(plan);
    const html = renderToString(
      <RetiredPanel
        plan={plan}
        result={result}
        mcResult={null}
        scenario={null}
        totalAtRetirement={2_000_000}
        sustainable={9000}
        dynamicOpt={null}
        onApplyOptimized={null}
      />,
    );
    expect(html).not.toMatch(/NaN/);
    expect(html).toMatch(/runs out/);
  });

  it("RMD row appears for a 75-year-old", () => {
    const plan = makePlan({ ...retiredInputs, currentAge: 75, birthYear: 1951 });
    const result = runMain(plan);
    const html = renderToString(
      <RetiredPanel
        plan={plan}
        result={result}
        mcResult={null}
        scenario={null}
        totalAtRetirement={2_000_000}
        sustainable={9000}
        dynamicOpt={null}
        onApplyOptimized={null}
      />,
    );
    expect(html).toMatch(/Required Minimum Distribution/);
  });
});
