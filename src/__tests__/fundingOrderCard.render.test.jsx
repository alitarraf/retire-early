// Headless render smoke test for FundingOrderCard. `npm run build` only compiles
// JSX; it never runs a render, so a NaN in the cascade math or a bad prop shape
// would ship unseen. renderToStaticMarkup runs the full render in node. The card
// computes its own `recommendedFunding` internally (from `plan`).

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FundingOrderCard } from "../components/panels/FundingOrderCard.jsx";
import { recommendedFunding } from "../analysis/fundingOrder.js";
import { makePlan, DEFAULTS } from "../analysis/plan.js";

const render = (plan) => renderToStaticMarkup(<FundingOrderCard plan={plan} onApply={() => {}} />);

describe("FundingOrderCard render", () => {
  it("working: renders the cascade with tiers, %, and the sustainable-spend impact", () => {
    // Early retiree with everything in a locked 401k → a big improvement to show.
    const plan = makePlan({
      ...DEFAULTS, currentAge: 40, retireAge: 55, salary: 200000, employerMatchPct: 5,
      k401AnnualContrib: 40000, rothAnnualContrib: 0, hsaBalance: 6000, hsaAnnualContrib: 0,
      brokerageMonthlyContrib: 0, cashDeposit: 100000, monthlyExpense: 10000,
    });
    const html = render(plan);
    expect(html).toContain("Funding order");
    expect(html).toContain("Capture 401(k) match");
    expect(html).toContain("Fund Roth IRA");
    expect(html).toContain("Apply this split");
    expect(html).toContain("safe spend"); // positive-impact copy
    expect(html).toMatch(/%/);
  });

  it("retired (rec unavailable): shows where the money sits, no cascade", () => {
    const plan = makePlan({ ...DEFAULTS, alreadyRetired: true });
    const html = render(plan);
    expect(html).toContain("Where your money sits");
    expect(html).not.toContain("Apply this split");
    expect(html).not.toContain("Best order for your plan");
  });

  it("working but not saving: shows the balance view (nothing to route)", () => {
    const plan = makePlan({
      ...DEFAULTS, alreadyRetired: false,
      k401AnnualContrib: 0, rothAnnualContrib: 0, hsaAnnualContrib: 0,
      brokerageMonthlyContrib: 0, cashMonthlyContrib: 0, muniMonthlyContrib: 0,
    });
    const html = render(plan);
    expect(html).toContain("Where your money sits");
    expect(html).not.toContain("Best order for your plan");
  });

  it("kids' education block renders the ESA → 530A Trump → 529 split + cost", () => {
    const plan = makePlan({
      ...DEFAULTS, currentAge: 40, retireAge: 55, salary: 200000, employerMatchPct: 5,
      k401AnnualContrib: 20000, rothAnnualContrib: 0, hsaBalance: 6000, brokerageMonthlyContrib: 0,
      cashDeposit: 100000, monthlyExpense: 10000, numDependents: 2, educationAnnualContrib: 16000,
    });
    const rec = recommendedFunding(plan);
    const html = render(plan);
    expect(rec.kids).toBeTruthy();
    expect(html).toContain("Coverdell ESA");
    expect(html).toContain("530A Trump Account");
    expect(html).toContain("529 Plan");
    expect(html).toContain("children"); // "Kids' education · 2 children" (apostrophe → &#x27;)
  });
});
