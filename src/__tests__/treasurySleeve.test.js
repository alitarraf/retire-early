// Treasury sleeve (Phase 3): held Treasuries are a real drawn-down account —
// state-tax-exempt (grows at the federal-only after-tax rate), drawn tax-free.
// The identity default (0 balance → byte-identical) is covered by invariants A–E.

import { describe, it, expect } from "vitest";
import { makePlan, runMain, DEFAULTS } from "../analysis/plan.js";

const retiree = (over) =>
  makePlan({
    ...DEFAULTS, alreadyRetired: true, currentAge: 63, monthlyExpense: 3000, ssBenefit: 1500,
    k401Today: 0, rothTotal: 0, existingBrokerage: 0, hsaBalance: 0, muniBonds: 0, cashDeposit: 20000,
    ...over,
  });

describe("Treasury sleeve", () => {
  it("held Treasuries are drawn down to fund retirement (and appear in snaps)", () => {
    const with300 = runMain(retiree({ treasuryBalance: 300000, treasuryRate: 4.5 }));
    const without = runMain(retiree({ treasuryBalance: 0 }));
    expect(with300.snaps[0]).toHaveProperty("treasury");
    expect(with300.snaps[0].treasury).toBeGreaterThan(0);
    // The $300k Treasuries make the plan last; without them it depletes.
    expect(with300.depleted).toBeNull();
    expect(without.depleted).not.toBeNull();
    // The balance is spent down over time (bridge asset).
    expect(with300.snaps[3].treasury).toBeLessThan(with300.snaps[0].treasury);
  });

  it("grows at a STATE-EXEMPT rate: same yield beats a taxable CD of equal rate in a taxed state", () => {
    // Treasuries taxed federal-only; cash (CD) taxed fed+state → Treasuries grow faster.
    const base = { treasuryBalance: 0, cashDeposit: 100000, cashDepositRate: 4.5, treasuryRate: 4.5,
      alreadyRetired: false, currentAge: 40, retireAge: 60, stateKey: "Oregon", stateTaxEnabled: true };
    const plan = makePlan({ ...DEFAULTS, ...base });
    // treasuryAfterTaxRate (fed-only) should exceed depositAfterTaxRate (fed+state).
    expect(plan.treasuryAfterTaxRate).toBeGreaterThan(plan.depositAfterTaxRate);
  });
});
