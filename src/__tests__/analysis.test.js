import { describe, it, expect } from "vitest";
import { makePlan, projectAtRetirement, survivesAt } from "../analysis/plan.js";
import { earliestRetireAge } from "../analysis/earliestRetireAge.js";
import { sensitivity } from "../analysis/sensitivity.js";
import { marginalValues } from "../analysis/marginalValue.js";
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

  it("each lever's apply patch reproduces its previewed earliest age", () => {
    // The clickable lever writes `apply` (raw-input namespace) into inputs; the
    // preview simulated `ov` (engine-override namespace). They must agree, or a
    // click silently contradicts the number the user saw. Re-deriving earliest
    // from `apply` should land within a year of the previewed `newEarliest`
    // (the only slack is the Roth lever's splitRoth re-derivation of existing
    // contributions vs the override's contribution-only add).
    for (const row of sensitivity(plan)) {
      if (row.newEarliest == null) continue;
      const applied = earliestRetireAge(makePlan({ ...row.apply }), { max: 75 });
      expect(applied, row.label).not.toBeNull();
      expect(Math.abs(applied - row.newEarliest), row.label).toBeLessThanOrEqual(1);
    }
  });

  it("marginal values are non-negative", () => {
    for (const r of marginalValues(plan)) expect(r.gain).toBeGreaterThanOrEqual(0);
  });

  it("sustainable spend is a positive monthly figure", () => {
    const s = sustainableSpend(plan);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(50000);
  });

  it("sustainable spend respects the full pipeline: rule 55 sustains more", () => {
    // Early retiree with a locked 401k: unlocking it via rule 55 must never
    // reduce — and here strictly raises — the sustainable spend.
    const early = makePlan({ retireAge: 55, k401Today: 900_000, cashDeposit: 150_000 });
    const with55 = makePlan({ retireAge: 55, k401Today: 900_000, cashDeposit: 150_000, rule55: true });
    expect(sustainableSpend(with55)).toBeGreaterThan(sustainableSpend(early));
  });

  it("sustainable spend prices in lifestyle costs the old reduced sim ignored", () => {
    // A chunky one-time expense must lower the sustainable number.
    const clean = makePlan({});
    const withOneTime = makePlan({ oneTimeExpenses: [{ age: 60, amount: 400_000 }] });
    expect(sustainableSpend(withOneTime)).toBeLessThan(sustainableSpend(clean));
  });
});
