// Funding order (account-location axis): the ENGINE-DERIVED savings waterfall.
// Locks the IRS caps + catch-ups, budget conservation, the emergency/match rule
// tiers, bridge-awareness (a locked 401k drops out for early retirees), and that
// the recommendation lifts sustainable spend for a badly-allocated plan.

import { describe, it, expect } from "vitest";
import {
  recommendedFunding,
  contribCaps,
  annualSavingsBudget,
  fundingContribOverrides,
  currentSplit,
} from "../analysis/fundingOrder.js";
import { makePlan, DEFAULTS } from "../analysis/plan.js";
import { CONTRIB_LIMITS } from "../constants/brackets.js";

// Early retiree, HSA engaged, employer match on, cash already above the buffer.
const earlySaver = (over = {}) =>
  makePlan({
    ...DEFAULTS,
    currentAge: 40,
    retireAge: 55,
    salary: 200000,
    employerMatchPct: 5,
    cashDeposit: 100000, // above 6×$10k target → no emergency tier
    monthlyExpense: 10000,
    hsaBalance: 5000,
    hsaAnnualContrib: 4300,
    k401AnnualContrib: 24500,
    rothAnnualContrib: 7500,
    brokerageMonthlyContrib: 5000, // $60k/yr → forces overflow
    ...over,
  });

describe("contribCaps: age-adjusted IRS limits", () => {
  it("under 50 = base limits", () => {
    expect(contribCaps(40).k401).toBe(CONTRIB_LIMITS.k401);
    expect(contribCaps(40).ira).toBe(CONTRIB_LIMITS.rothIra);
  });
  it("50+ adds the standard catch-ups", () => {
    expect(contribCaps(52).k401).toBe(CONTRIB_LIMITS.k401 + CONTRIB_LIMITS.k401Catchup50);
    expect(contribCaps(52).ira).toBe(CONTRIB_LIMITS.rothIra + CONTRIB_LIMITS.rothIraCatchup50);
  });
  it("60–63 uses the super catch-up (replaces the 50+ amount); IRA has none", () => {
    expect(contribCaps(61).k401).toBe(CONTRIB_LIMITS.k401 + CONTRIB_LIMITS.k401Catchup60);
    expect(contribCaps(61).ira).toBe(CONTRIB_LIMITS.rothIra + CONTRIB_LIMITS.rothIraCatchup50);
  });
  it("64+ reverts to the 50+ catch-up", () => {
    expect(contribCaps(64).k401).toBe(CONTRIB_LIMITS.k401 + CONTRIB_LIMITS.k401Catchup50);
  });
  it("HSA family vs self-only, with the 55+ catch-up", () => {
    expect(contribCaps(40, { family: true }).hsa).toBe(CONTRIB_LIMITS.hsaFamily);
    expect(contribCaps(40, { family: false }).hsa).toBe(CONTRIB_LIMITS.hsaIndividual);
    expect(contribCaps(57, { family: true }).hsa).toBe(CONTRIB_LIMITS.hsaFamily + CONTRIB_LIMITS.hsaCatchup);
  });
});

describe("recommendedFunding: structure & rules", () => {
  it("captures the employer match first among the fillable tiers", () => {
    const rec = recommendedFunding(earlySaver());
    expect(rec.tiers[0].label).toBe("Capture 401(k) match");
    expect(rec.tiers[0].key).toBe("k401");
  });

  it("caps each sheltered tier at its IRS limit", () => {
    const rec = recommendedFunding(earlySaver());
    const hsa = rec.tiers.find((t) => t.key === "hsa");
    const roth = rec.tiers.find((t) => t.label === "Fund Roth IRA");
    expect(hsa.amount).toBe(CONTRIB_LIMITS.hsaFamily);
    expect(roth.amount).toBe(CONTRIB_LIMITS.rothIra);
    const k401 = rec.tiers.filter((t) => t.key === "k401").reduce((s, t) => s + t.amount, 0);
    expect(k401).toBeLessThanOrEqual(CONTRIB_LIMITS.k401);
  });

  it("conserves the budget: tiers sum exactly to the annual savings", () => {
    const plan = earlySaver();
    const rec = recommendedFunding(plan);
    const routed = rec.tiers.reduce((s, t) => s + t.amount, 0);
    expect(routed).toBe(rec.budget);
    expect(rec.budget).toBe(Math.round(annualSavingsBudget(plan)));
  });

  it("overflows the remainder into taxable brokerage", () => {
    const rec = recommendedFunding(earlySaver());
    const broker = rec.tiers.find((t) => t.key === "brokerage");
    expect(broker).toBeTruthy();
    expect(broker.amount).toBeGreaterThan(0);
  });

  it("BRIDGE-AWARE: for an early retiree, the locked 401k isn't funded beyond the match", () => {
    // 401k is inaccessible before 59½, so it scores ~0 and ranks below brokerage.
    const rec = recommendedFunding(earlySaver());
    expect(rec.tiers.some((t) => t.label === "Max 401(k)")).toBe(false);
    const k401 = rec.tiers.filter((t) => t.key === "k401");
    expect(k401).toHaveLength(1); // only the match tier
    expect(k401[0].label).toBe("Capture 401(k) match");
  });

  it("adds an emergency-buffer tier first when cash is below target, capped at 20%", () => {
    const rec = recommendedFunding(earlySaver({ cashDeposit: 0 }));
    expect(rec.tiers[0].label).toBe("Emergency buffer");
    expect(rec.tiers[0].amount).toBeLessThanOrEqual(Math.round(0.2 * rec.budget));
  });

  it("skips the HSA tier when the user has no HSA", () => {
    const rec = recommendedFunding(earlySaver({ hsaBalance: 0, hsaAnnualContrib: 0 }));
    expect(rec.tiers.some((t) => t.key === "hsa")).toBe(false);
  });

  it("returns unavailable (no sims) when retired or not saving", () => {
    expect(recommendedFunding(makePlan({ ...DEFAULTS, alreadyRetired: true })).available).toBe(false);
    expect(recommendedFunding(makePlan({ ...DEFAULTS, alreadyRetired: true })).impact).toBeNull();
  });

  it("LIFTS sustainable spend for a badly-allocated plan (all savings in a locked 401k)", () => {
    // Early retiree dumping everything into the 401k they can't touch until 59½.
    const bad = earlySaver({ k401AnnualContrib: 40000, rothAnnualContrib: 0, hsaAnnualContrib: 0, brokerageMonthlyContrib: 0, cashDeposit: 100000 });
    const rec = recommendedFunding(bad);
    expect(rec.impact.delta).toBeGreaterThan(1000); // big monthly-spend improvement
    expect(rec.impact.after).toBeGreaterThan(rec.impact.base);
  });
});

describe("fundingContribOverrides & currentSplit", () => {
  it("re-routes fields, zeroes untouched ones, preserves the budget", () => {
    const plan = earlySaver();
    const rec = recommendedFunding(plan);
    const patch = fundingContribOverrides(rec);
    expect(patch.rothAnnualContrib).toBe(CONTRIB_LIMITS.rothIra);
    expect(patch.muniMonthlyContrib).toBe(0);
    expect(Math.round(annualSavingsBudget({ ...plan, ...patch }))).toBe(Math.round(annualSavingsBudget(plan)));
  });

  it("currentSplit shares sum to 1", () => {
    const cs = currentSplit(earlySaver());
    expect(cs.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6);
  });
});
