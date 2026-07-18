// Smoke test for the DocsPanel account-comparison tables (Phase 2 docs). `npm run
// build` compiles JSX but never renders it; this runs the full render in node and
// confirms both tables + the 530A Trump content are present and crash-free.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsPanel } from "../components/panels/DocsPanel.jsx";

describe("DocsPanel account comparison", () => {
  const html = renderToStaticMarkup(<DocsPanel />);

  it("renders the 'Account types compared' section with both tables", () => {
    expect(html).toContain("Account types compared");
    expect(html).toContain("Retirement &amp; savings accounts");
    expect(html).toContain("education accounts"); // apostrophe in "Kids'" renders as &#x27;
  });

  it("covers every account row, including the 530A Trump Account", () => {
    for (const acct of ["401(k)", "Roth IRA", "HSA", "Taxable brokerage", "Municipal bonds", "529 Savings Plan", "Coverdell ESA", "530A Trump Account", "Custodial Roth IRA"]) {
      expect(html).toContain(acct);
    }
  });

  it("shows the education column headers from the spec (child income / gov / employer match)", () => {
    expect(html).toContain("Child income required?");
    expect(html).toContain("Government match?");
    expect(html).toContain("Employer match?");
  });
});
