import { describe, it, expect } from "vitest";
import { makePlan, projectAtRetirement, survivesAt } from "../analysis/plan.js";
import { earliestRetireAge } from "../analysis/earliestRetireAge.js";
import { sensitivity } from "../analysis/sensitivity.js";
import { marginalValues } from "../analysis/marginalValue.js";
import { optimalConversion } from "../analysis/optimalConversion.js";
import { sustainableSpend } from "../analysis/sustainableSpend.js";

// ── Scenario D — earliest-age and verdict must agree ──────────
describe("Scenario D: earliest age and verdict agree (same engine)", () => {
  const cases = [
    {},
    { retireAge: 50, monthlyExpense: 14000 },
    { retireAge: 62, monthlyExpense: 5000 },
    { monthlyExpense: 20000, k401Today: 50000 },
  ];

  for (const overrides of cases) {
    it(`consistent for ${JSON.stringify(overrides)}`, () => {
      const plan = makePlan(overrides);
      const verdict = survivesAt(plan, plan.retireAge);
      const earliest = earliestRetireAge(plan);
      if (verdict) {
        expect(earliest).not.toBeNull();
        expect(earliest).toBeLessThanOrEqual(plan.retireAge);
      } else {
        expect(earliest === null || earliest > plan.retireAge).toBe(true);
      }
    });
  }
});

// ── Scenario E — default scenario sanity (seven figures) ──────
describe("Scenario E: default scenario builds a seven-figure portfolio", () => {
  it("projects > $1M at retirement (FV annuity applied)", () => {
    const plan = makePlan({});
    const p = projectAtRetirement(plan);
    const total =
      p.rothContributions + p.rothEarnings + p.brokerage + p.k401 + p.cashDeposit + p.muniBonds;
    expect(total).toBeGreaterThan(1_000_000);
  });
});

// ── Analysis routines smoke tests ─────────────────────────────
describe("analysis routines return sane shapes", () => {
  const plan = makePlan({});

  it("sensitivity returns one row per lever with deltas", () => {
    const rows = sensitivity(plan);
    expect(rows.length).toBe(8);
    for (const r of rows) expect(r).toHaveProperty("label");
  });

  it("spending-cut levers never retire you later", () => {
    const rows = sensitivity(plan);
    const cut = rows.find((r) => r.label === "Spend −$2,000/mo");
    // delta is years gained; cutting spend should not be negative
    if (cut.delta !== null) expect(cut.delta).toBeGreaterThanOrEqual(0);
  });

  it("marginal values are non-negative", () => {
    for (const r of marginalValues(plan)) expect(r.gain).toBeGreaterThanOrEqual(0);
  });

  it("optimal conversion is within the search range", () => {
    const best = optimalConversion(plan);
    expect(best.amount).toBeGreaterThanOrEqual(0);
    expect(best.amount).toBeLessThanOrEqual(60000);
    expect(best.endVal).toBeGreaterThanOrEqual(best.baseEnd);
  });

  it("sustainable spend is a positive monthly figure", () => {
    const s = sustainableSpend(plan);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(50000);
  });
});
