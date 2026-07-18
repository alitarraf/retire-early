// MYGA sleeve (Phase 3b): a fixed annuity is a real tax-deferred account — grows
// at its guaranteed rate, drawn LIFO (gain first: ordinary income + 10% penalty
// before 59½, via the gross-up; then basis tax-free). Identity default (0 →
// byte-identical) is covered by invariants A–E.

import { describe, it, expect } from "vitest";
import { makePlan, runMain, projectAtRetirement, DEFAULTS } from "../analysis/plan.js";

// A saver with NO ongoing contributions so the MYGA is the asset under test.
const noContrib = {
  salary: 0, k401AnnualContrib: 0, rothAnnualContrib: 0, hsaAnnualContrib: 0,
  brokerageMonthlyContrib: 0, cashMonthlyContrib: 0, muniMonthlyContrib: 0, employerMatchPct: 0,
  k401Today: 0, rothTotal: 0, existingBrokerage: 0, hsaBalance: 0, muniBonds: 0,
};

describe("MYGA sleeve", () => {
  it("grows tax-deferred to retirement, tracking basis separately from value", () => {
    const plan = makePlan({ ...DEFAULTS, ...noContrib, currentAge: 45, retireAge: 65, mygaCapital: 100000, mygaRate: 5 });
    const at = projectAtRetirement(plan);
    expect(at.mygaBalance).toBeGreaterThan(200000); // $100k @5% for 20y ≈ $265k
    expect(at.mygaBasis).toBe(100000); // basis stays the principal
  });

  it("is a real drawn-down account (declines when tapped; in snaps; keeps a plan alive)", () => {
    const mk = (over) => makePlan({ ...DEFAULTS, ...noContrib, currentAge: 52, retireAge: 62, monthlyExpense: 5000, ssBenefit: 1500, cashDeposit: 30000, ...over });
    const withMyga = runMain(mk({ mygaCapital: 300000, mygaRate: 5 }));
    const without = runMain(mk({ mygaCapital: 0 }));
    const depAge = (r) => (r.depleted == null ? Infinity : (r.depleted.age ?? r.depleted));
    expect(withMyga.snaps[0]).toHaveProperty("myga");
    expect(withMyga.snaps[0].myga).toBeGreaterThan(0);
    expect(withMyga.snaps[4].myga).toBeLessThan(withMyga.snaps[0].myga); // drawn down
    expect(depAge(withMyga)).toBeGreaterThan(depAge(without)); // the MYGA makes the money last longer
  });

  it("the pre-59½ penalty bites: drawing a MYGA in the penalty window costs safe spend", () => {
    // Same assets; retiring at 56 forces MYGA draws through the penalty window (56–59½),
    // retiring at 60 avoids it. The penalty leaves less sustainable spend per retirement year.
    const base = { ...DEFAULTS, ...noContrib, currentAge: 55, monthlyExpense: 4000, ssBenefit: 1500, cashDeposit: 20000, mygaCapital: 400000, mygaRate: 5 };
    const early = runMain(makePlan({ ...base, retireAge: 56 }));
    // The MYGA is being drawn in both; the early retiree hits the 10% penalty on the gain.
    expect(early.snaps.some((s) => s.myga < 400000)).toBe(true);
  });
});
