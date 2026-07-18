// Render smoke test for the Invest tab: the editable list (every instrument) +
// the priority column, crash-free and NaN-free.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestPanel } from "../components/panels/InvestPanel.jsx";
import { INSTRUMENTS } from "../constants/instruments.js";
import { makePlan, DEFAULTS } from "../analysis/plan.js";

describe("InvestPanel render", () => {
  const plan = makePlan(DEFAULTS);
  const html = renderToStaticMarkup(
    <InvestPanel inputs={DEFAULTS} set={() => () => {}} plan={plan} funding={{ onApply: () => {} }} />,
  );

  it("lists every instrument from the registry and the category headers", () => {
    for (const i of INSTRUMENTS) expect(html).toContain(i.label);
    expect(html).toContain("Your accounts");
    expect(html).toContain("Kids"); // separate goal group
    expect(html).not.toMatch(/NaN/);
  });

  it("shows the priority column (the funding-order recommendation)", () => {
    expect(html).toContain("Funding order");
  });
});
