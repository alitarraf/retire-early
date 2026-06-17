// @vitest-environment node
// Render smoke tests — catch render-time crashes and NaN-in-JSX that unit tests and the
// production build do not. Uses react-dom/server (no DOM needed). These guard the surfaces
// that have broken at runtime before (null-result white screen, optimizer card rewrite).
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import App from "../App.jsx";
import { MaximizeCenter } from "../components/panels/MaximizeCenter.jsx";
import { InputsSidebar } from "../components/panels/InputsSidebar.jsx";
import { DEFAULTS, makePlan, runMain } from "../analysis/plan.js";
import { dynamicOptimizer } from "../analysis/dynamicOptimizer.js";

const noNaN = (html) => expect(html).not.toMatch(/NaN/);

describe("render smoke tests", () => {
  it("App renders without throwing (initial Retire Early mode)", () => {
    const html = renderToString(<App />);
    expect(html).toContain("Earliest retirement");
    noNaN(html);
  });

  it("MaximizeCenter renders the dynamic optimizer card with a real schedule (no NaN)", () => {
    const plan = makePlan({
      currentAge: 50, retireAge: 55, lifeExpect: 90, monthlyExpense: 4000,
      k401Today: 1_500_000, cashDeposit: 300000, rothTotal: 150000, ssBenefit: 2000,
      filingStatus: "single", stateKey: "No state tax", stateTaxEnabled: false,
    });
    const result = runMain(plan);
    const opt = dynamicOptimizer(plan);
    const html = renderToString(
      <MaximizeCenter
        plan={plan}
        result={result}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={5000}
        dynamicOpt={opt}
        onApplyOptimized={() => {}}
        stressResult={null}
      />,
    );
    expect(html).toContain("Dynamic Roth conversion optimizer");
    expect(opt.type).toBe("fill"); // this scenario should recommend a fill
    expect(html).toContain("Apply these conversions");
    expect(html).toContain("bracket");
    noNaN(html); // bracketLabel / schedule amounts must all resolve to real numbers
  });

  it("MaximizeCenter renders the empty state when no conversion helps (no crash, no NaN)", () => {
    const plan = makePlan({
      currentAge: 50, retireAge: 55, lifeExpect: 90, monthlyExpense: 2000,
      k401Today: 0, cashDeposit: 50000, rothTotal: 400000, ssBenefit: 3000,
      filingStatus: "single", stateKey: "No state tax", stateTaxEnabled: false,
    });
    const result = runMain(plan);
    const opt = dynamicOptimizer(plan);
    const html = renderToString(
      <MaximizeCenter
        plan={plan}
        result={result}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={3000}
        dynamicOpt={opt}
        onApplyOptimized={() => {}}
        stressResult={null}
      />,
    );
    expect(html).toContain("Dynamic Roth conversion optimizer");
    noNaN(html);
  });

  it("InputsSidebar shows the active-optimizer summary label correctly (no NaN%)", () => {
    // Strategy section is collapsed by default, but its summary chip renders the bracket label —
    // single-filer ceiling 50400 = top of the 12% band → summary reads 'Roth fill 12%'.
    const inputs = { ...DEFAULTS, conversionCeiling: 50400, conversionEndAge: 72, filingStatus: "single" };
    const plan = makePlan(inputs);
    const html = renderToString(<InputsSidebar inputs={inputs} set={() => () => {}} plan={plan} />);
    expect(html).toContain("fill 12%");
    noNaN(html);
  });
});
