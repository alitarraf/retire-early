// @vitest-environment node
// Render smoke tests — catch render-time crashes and NaN-in-JSX that unit tests and the
// production build do not. Uses react-dom/server (no DOM needed). These guard the surfaces
// that have broken at runtime before (null-result white screen, optimizer card rewrite).
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import App from "../App.jsx";
import { MaximizeCenter } from "../components/panels/MaximizeCenter.jsx";
import { EarlyPanel } from "../components/panels/EarlyPanel.jsx";
import { InputsSidebar } from "../components/panels/InputsSidebar.jsx";
import { earliestRetireAge } from "../analysis/earliestRetireAge.js";
import { retireByAge } from "../analysis/retireByAge.js";
import { AdvicePanel } from "../components/panels/AdvicePanel.jsx";
import { QuickStart } from "../components/panels/QuickStart.jsx";
import { InfoDot } from "../components/ui.jsx";
import { DEFAULTS, makePlan, runMain, simParamsAt, projectAtRetirement } from "../analysis/plan.js";
import { marginalValues } from "../analysis/marginalValue.js";
import { buildPlanSummary } from "../analysis/planSummary.js";
import { dynamicOptimizer } from "../analysis/dynamicOptimizer.js";
import { monteCarlo, buildHistogram } from "../engine/monteCarlo.js";
import { McDistChart } from "../components/charts/McDistChart.jsx";
import { StackedChart } from "../components/charts/StackedChart.jsx";
import { ScenarioCard, PhaseBreakdownCard, ProjectedBalancesCard, MarginalValueCard } from "../components/panels/ResultsExtras.jsx";
import { PromptCounter, PaywallCard } from "../components/panels/Paywall.jsx";
import { historicalSequence } from "../analysis/historicalSequence.js";
import { PortfolioChartCard } from "../components/panels/PortfolioChartCard.jsx";
import { MonteCarloCard } from "../components/panels/MonteCarloCard.jsx";
import { RetireAtControl } from "../components/panels/RetireAtControl.jsx";
import { MobileShell } from "../components/mobile/MobileShell.jsx";

const noNaN = (html) => expect(html).not.toMatch(/NaN/);

const MOBILE_TABS = [
  { key: "early", label: "Retire Early" },
  { key: "maximize", label: "Maximize" },
  { key: "advice", label: "Get advice" },
  { key: "docs", label: "How it works" },
];

function mobileProps(mode = "early") {
  const inputs = { ...DEFAULTS };
  const plan = makePlan(inputs);
  const result = runMain(plan);
  return {
    mode, setMode: () => {}, tabs: MOBILE_TABS,
    inputs, set: () => () => {}, plan,
    earliest: earliestRetireAge(plan), onScrubAge: () => {}, onCommitAge: () => {},
    result, mcResult: null, scenario: null,
    totalAtRetirement: result.snaps[0]?.total ?? 0, sustainable: 5000,
    retireBy: retireByAge(plan, plan.retireAge),
    sensitivityRows: [], applyLever: () => {}, appliedLevers: [], undoLevers: () => {},
    atRetirement: {}, marginalRows: [], dynamicOpt: null, applyOptimized: () => {}, onRunMc: () => {},
  };
}

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
        scenario={null}
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
        scenario={null}
      />,
    );
    expect(html).toContain("Dynamic Roth conversion optimizer");
    noNaN(html);
  });

  it("MaximizeCenter renders the chart toggle + Show-details Monte Carlo title (MC present)", () => {
    const plan = makePlan({
      currentAge: 50, retireAge: 55, lifeExpect: 90, monthlyExpense: 4000,
      k401Today: 1_500_000, cashDeposit: 300000, rothTotal: 150000, ssBenefit: 2000,
      filingStatus: "single", stateKey: "No state tax", stateTaxEnabled: false,
    });
    const result = runMain(plan);
    const mcResult = monteCarlo(simParamsAt(plan, plan.retireAge), { n: 50, seed: 42 });
    const html = renderToString(
      <MaximizeCenter
        plan={plan}
        result={result}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={5000}
        dynamicOpt={dynamicOptimizer(plan)}
        onApplyOptimized={() => {}}
        scenario={null}
        mcResult={mcResult}
        onRunMc={() => {}}
      />,
    );
    expect(html).toContain("Portfolio over time");
    expect(html).toContain("Outcome range"); // chart toggle option
    expect(html).toContain("Show details"); // flat disclosure trigger (cards revealed on open)
    expect(html).toContain("Monte Carlo, tax, scenario &amp; legacy"); // disclosure caption
    noNaN(html);
  });

  it("MaximizeCenter offers the Outcome-range toggle even before MC is run (on-demand)", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const result = runMain(plan);
    const html = renderToString(
      <MaximizeCenter
        plan={plan}
        result={result}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={5000}
        dynamicOpt={dynamicOptimizer(plan)}
        onApplyOptimized={() => {}}
        scenario={null}
        mcResult={null}
        onRunMc={() => {}}
      />,
    );
    expect(html).toContain("Outcome range"); // present because onRunMc enables on-demand MC
    noNaN(html);
  });

  it("StackedChart renders the MC percentile fan (bands) without NaN", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const result = runMain(plan);
    const mc = monteCarlo(simParamsAt(plan, plan.retireAge), { n: 30, seed: 42 });
    const html = renderToString(
      <StackedChart snaps={result.snaps} ssAge={plan.ssAge} mcBands={mc.bands} />,
    );
    expect(html).toContain("MC 10–90%");
    noNaN(html);
  });

  it("StackedChart renders a historical scenario overlay line + label without NaN", () => {
    const plan = makePlan({
      ...DEFAULTS, currentAge: 50, retireAge: 55,
      scenarioMode: "historical", historicalScenario: "gfc2007", historicalLens: "sp",
    });
    const result = runMain(plan);
    const scen = historicalSequence(simParamsAt(plan, plan.retireAge), { startYear: 2007, lens: "sp" });
    const html = renderToString(
      <StackedChart
        snaps={result.snaps}
        ssAge={plan.ssAge}
        scenarioSnaps={scen.snaps}
        scenarioColor="#7048a8"
        scenarioLabel="Global financial crisis (2007) · S&P 500"
      />,
    );
    expect(html).toContain("Global financial crisis (2007)"); // legend label
    expect(html).toContain("#7048a8"); // scenario line color applied
    noNaN(html);
  });

  it("ScenarioCard summarizes a historical scenario (outcome + estate + blurb)", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const scen = historicalSequence(simParamsAt(plan, plan.retireAge), { startYear: 2000, lens: "balanced" });
    const html = renderToString(
      <ScenarioCard
        plan={plan}
        scenario={{ result: scen, color: "#7048a8", label: "Dot-com bust (2000) · 60/40 blend", blurb: "Replays actual returns." }}
      />,
    );
    expect(html).toContain("Dot-com bust (2000)");
    expect(html).toMatch(/Survives|Depletes by/);
    noNaN(html);
  });

  it("StackedChart view='fan' renders the cone with a deterministic line and no NaN", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const result = runMain(plan);
    const mc = monteCarlo(simParamsAt(plan, plan.retireAge), { n: 30, seed: 42 });
    const html = renderToString(
      <StackedChart snaps={result.snaps} ssAge={plan.ssAge} mcBands={mc.bands} view="fan" />,
    );
    expect(html).toContain("MC 10–90%");
    expect(html).toContain("Deterministic"); // faint reference line legend (fan-only)
    expect(html).not.toContain("Brokerage"); // account legend suppressed in fan view
    noNaN(html);
  });

  it("PortfolioChartCard (Early-style: live MC) shows both toggle options", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const result = runMain(plan);
    const mc = monteCarlo(simParamsAt(plan, plan.retireAge), { n: 30, seed: 42 });
    const html = renderToString(
      <PortfolioChartCard snaps={result.snaps} ssAge={plan.ssAge} plan={plan} mcResult={mc} />,
    );
    expect(html).toContain("Projection");
    expect(html).toContain("Outcome range");
    expect(html).toContain("Portfolio over time");
    noNaN(html);
  });

  it("PortfolioChartCard fan state renders the cone, success headline and explanation together", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const result = runMain(plan);
    const mc = monteCarlo(simParamsAt(plan, plan.retireAge), { n: 30, seed: 42 });
    const html = renderToString(
      <PortfolioChartCard snaps={result.snaps} ssAge={plan.ssAge} plan={plan} mcResult={mc} initialView="range" />,
    );
    expect(html).toContain("MC 10–90%"); // the fan band/legend
    expect(html).toContain("randomized return sequences"); // FanExplainCard headline
    expect(html).toContain("sequence-of-returns risk"); // explanation
    // No duplicate "MC 10–90%" label (inline overlay legend is suppressed in fan view).
    expect(html.match(/MC 10–90%/g)?.length).toBe(1);
    noNaN(html);
  });

  it("PortfolioChartCard hides the Outcome-range option when no MC and no onRunMc", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const result = runMain(plan);
    const html = renderToString(
      <PortfolioChartCard snaps={result.snaps} ssAge={plan.ssAge} plan={plan} mcResult={null} />,
    );
    expect(html).not.toContain("Outcome range");
    noNaN(html);
  });

  it("MonteCarloCard renders stats and no longer offers the histogram", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 50, retireAge: 55 });
    const mc = monteCarlo(simParamsAt(plan, plan.retireAge), { n: 30, seed: 42 });
    const html = renderToString(<MonteCarloCard mcResult={mc} plan={plan} runs={500} />);
    expect(html).toContain("Success rate");
    expect(html).not.toContain("outcome distribution"); // histogram toggle removed
    noNaN(html);
  });

  it("McDistChart renders a normal distribution without NaN", () => {
    const hist = buildHistogram([0, 50_000, 120_000, 300_000, 800_000, 1_500_000], 12);
    const html = renderToString(
      <McDistChart histogram={hist} p10={0} p50={300_000} p90={1_500_000} />,
    );
    expect(html).toContain("svg");
    noNaN(html);
  });

  it("McDistChart renders the all-depleted edge case without NaN (maxVal collapses to 1)", () => {
    const hist = buildHistogram([0, 0, 0, 0], 12);
    const html = renderToString(<McDistChart histogram={hist} p10={0} p50={0} p90={0} />);
    noNaN(html);
  });

  it("InputsSidebar shows the active-optimizer summary label correctly (no NaN%)", () => {
    // Strategy lives in the collapsed Fine-tuning group; reveal it via the prop so the
    // summary chip's bracket label renders. Single-filer ceiling 50400 = top of the 12%
    // band → summary reads 'Roth fill 12%'.
    const inputs = { ...DEFAULTS, conversionCeiling: 50400, conversionEndAge: 72, filingStatus: "single" };
    const plan = makePlan(inputs);
    const html = renderToString(<InputsSidebar inputs={inputs} set={() => () => {}} plan={plan} defaultFineTuningOpen />);
    expect(html).toContain("fill 12%");
    noNaN(html);
  });

  it("RetireAtControl renders the command band: step-1 slider, steppers, Earliest + milestone ticks", () => {
    const html = renderToString(
      <RetireAtControl value={55} min={40} max={80} earliest={52} onScrub={() => {}} onCommit={() => {}} />,
    );
    expect(html).toContain("Plan to retire at");
    expect(html).toContain('type="range"');
    expect(html).toContain('step="1"');
    expect(html).toContain('min="40"');
    expect(html).toContain("Earliest age"); // accent earliest tick (label/title)
    expect(html).toContain("Medicare"); // milestone teaching ticks (title)
    noNaN(html);
  });

  it("App renders the full-width Retire-at command band", () => {
    const html = renderToString(<App />);
    expect(html).toContain("Plan to retire at");
    noNaN(html);
  });

  it("MobileShell (early) renders hero, folded results, and the input bottom nav", () => {
    const html = renderToString(<MobileShell {...mobileProps("early")} />);
    expect(html).toContain("Plan to retire at"); // pinned hero
    expect(html).toContain("Fine-tune"); // bottom-nav input section
    expect(html).toContain("Earliest retirement"); // EarlyPanel results folded in
    noNaN(html);
  });

  it("MobileShell content tabs (Get advice) hide the hero + input bottom nav", () => {
    const html = renderToString(<MobileShell {...mobileProps("advice")} />);
    expect(html).not.toContain("Plan to retire at"); // hero hidden on content pages
    expect(html).not.toContain("Fine-tune"); // bottom nav hidden on content pages
    noNaN(html);
  });

  it("InputsSidebar renders the two-tier groups and a help tooltip dot", () => {
    const plan = makePlan(DEFAULTS);
    const html = renderToString(<InputsSidebar inputs={DEFAULTS} set={() => () => {}} plan={plan} />);
    expect(html).toContain("Essentials");
    expect(html).toContain("Money");
    expect(html).toContain("Fine-tuning");
    expect(html).toContain("not financial advice");
    expect(html).toContain('aria-label="More info"'); // InfoDot present on fields
    noNaN(html);
  });

  it("InputsSidebar Money section renders contribution fields, Max chips and savings total", () => {
    const inputs = { ...DEFAULTS, brokerageMonthlyContrib: 500, cashMonthlyContrib: 100 };
    const plan = makePlan(inputs);
    const html = renderToString(
      <InputsSidebar inputs={inputs} set={() => () => {}} plan={plan} defaultOpenSection="money" />,
    );
    expect(html).toContain("Contribute/mo");
    expect(html).toContain("Max"); // capped-account chip
    expect(html).toContain("You save");
    noNaN(html);
  });

  it("InfoDot renders its trigger without throwing", () => {
    const html = renderToString(<InfoDot context="Some context" typical="Typical range" />);
    expect(html).toContain('aria-label="More info"');
    noNaN(html);
  });

  it("QuickStart renders the onboarding form", () => {
    const html = renderToString(<QuickStart onApply={() => {}} onSkip={() => {}} />);
    expect(html).toContain("Start here");
    expect(html).toContain("See my plan");
    noNaN(html);
  });

  it("AdvicePanel renders the CFP networks, fee illustration and export controls", () => {
    const plan = makePlan(DEFAULTS);
    const result = runMain(plan);
    const html = renderToString(
      <AdvicePanel
        inputs={DEFAULTS}
        plan={plan}
        result={result}
        earliest={55}
        sustainable={5000}
        mcResult={null}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
      />,
    );
    expect(html).toContain("NAPFA");
    expect(html).toContain("Export plan summary");
    expect(html).toContain("not financial advice");
    noNaN(html);
  });

  it("already-retired persona (retireAge == currentAge) gets a correct on-track verdict", () => {
    // The $7M / 62 / retired case from QuickStart. retireAge == currentAge is a path
    // the rest of the suite never exercises; earliestRetireAge must floor at currentAge
    // so it can report "retire now" instead of falsely needing another year.
    const inputs = {
      ...DEFAULTS, currentAge: 62, retireAge: 62, monthlyExpense: 12000, lifeExpect: 95,
      existingBrokerage: 7_000_000, existingBrokerageBasis: 7_000_000,
      k401Today: 0, rothTotal: 0, existingRothEarnings: 0, cashDeposit: 0, muniBonds: 0, hsaBalance: 0,
    };
    const plan = makePlan(inputs);
    const result = runMain(plan);
    const earliest = earliestRetireAge(plan);
    expect(result.depleted).toBeNull();        // survives
    expect(earliest).toBeLessThanOrEqual(62);  // can retire now, not "need 1 more year"

    const html = renderToString(
      <EarlyPanel
        plan={plan}
        result={result}
        earliest={earliest}
        mcResult={null}
        scenario={null}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={41000}
      />,
    );
    expect(html).not.toContain("more year"); // no false "Need N more years" warning
    expect(html).toContain("lasts to"); // plain-language positive summary
    noNaN(html);
  });

  it("EarlyPanel renders the 'Retire by age' card keyed to plan.retireAge", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 30, retireAge: 50, monthlyExpense: 6000 });
    const result = runMain(plan);
    const retireBy = retireByAge(plan, plan.retireAge); // single source of truth
    const html = renderToString(
      <EarlyPanel
        plan={plan}
        result={result}
        earliest={earliestRetireAge(plan)}
        mcResult={null}
        scenario={null}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={5000}
        retireBy={retireBy}
      />,
    );
    expect(html).toContain("Retire by age 50"); // header reflects the sidebar Retire at age
    expect(html).toContain("Change"); // hint pointing to the sidebar
    noNaN(html);
  });

  it("EarlyPanel target card handles the no-runway path (retireAge <= current age)", () => {
    const plan = makePlan({ ...DEFAULTS, currentAge: 62, retireAge: 62 });
    const result = runMain(plan);
    const retireBy = retireByAge(plan, plan.retireAge); // runway false
    const html = renderToString(
      <EarlyPanel
        plan={plan}
        result={result}
        earliest={earliestRetireAge(plan)}
        mcResult={null}
        scenario={null}
        totalAtRetirement={result.snaps[0]?.total ?? 0}
        sustainable={5000}
        retireBy={retireBy}
      />,
    );
    expect(html).toContain("above your current age");
    noNaN(html);
  });

  it("buildPlanSummary returns a markdown summary with the key fields", () => {
    const plan = makePlan(DEFAULTS);
    const result = runMain(plan);
    const md = buildPlanSummary(DEFAULTS, plan, result, {
      earliest: 55,
      sustainable: 5000,
      totalAtRetirement: result.snaps[0]?.total ?? 0,
    });
    expect(md).toContain("Retirement Plan Summary");
    expect(md).toContain("Earliest viable retirement age: 55");
    expect(md).toContain("Sustainable monthly spend");
    expect(md).toContain("Questions for a planner");
    expect(md).not.toMatch(/NaN/);
  });

  // Cards relocated from the deleted rails into "Show details" (default
  // collapsed, so App/panel renders never mount them). Render each directly.
  it("PhaseBreakdownCard renders the three phases with balances and no NaN", () => {
    const plan = makePlan(DEFAULTS);
    const result = runMain(plan);
    const html = renderToString(<PhaseBreakdownCard plan={plan} result={result} />);
    expect(html).toContain("Phase breakdown");
    expect(html).toContain("Bridge");
    expect(html).toContain("Early Retirement");
    expect(html).toContain("Full SS");
    expect(html).not.toMatch(/NaN/);
  });

  it("ProjectedBalancesCard renders per-account balances + total without NaN", () => {
    const plan = makePlan(DEFAULTS);
    const atRetirement = projectAtRetirement(plan);
    const html = renderToString(<ProjectedBalancesCard plan={plan} atRetirement={atRetirement} />);
    expect(html).toContain("Projected at retirement");
    expect(html).toContain("401k");
    expect(html).toContain("Total");
    expect(html).not.toMatch(/NaN/);
  });

  it("MarginalValueCard renders the next-$1k bars without NaN", () => {
    const plan = makePlan(DEFAULTS);
    const marginalRows = marginalValues(plan);
    const html = renderToString(<MarginalValueCard plan={plan} marginalRows={marginalRows} />);
    expect(html).toContain("next $1,000");
    expect(html).not.toMatch(/NaN/);
  });

  it("MarginalValueCard and ProjectedBalancesCard no-op on missing data", () => {
    expect(renderToString(<MarginalValueCard plan={makePlan(DEFAULTS)} marginalRows={[]} />)).toBe("");
    expect(renderToString(<ProjectedBalancesCard plan={makePlan(DEFAULTS)} atRetirement={null} />)).toBe("");
  });

  // Ask Pro funnel UI (PRD §10.5/§10.7).
  it("PromptCounter: hidden unconfigured, shows free count, shows Pro badge", () => {
    const strip = (h) => h.replace(/<!--.*?-->/g, "");
    expect(renderToString(<PromptCounter ent={{ configured: false }} />)).toBe("");
    expect(strip(renderToString(<PromptCounter ent={{ configured: true, isPro: false, remaining: 2, limit: 3 }} />))).toContain("2 of 3 free left");
    expect(renderToString(<PromptCounter ent={{ configured: true, isPro: true }} />)).toContain("Ask Pro");
  });

  it("PaywallCard: null without a wall, sign-up at 401, paywall at 402", () => {
    expect(renderToString(<PaywallCard ent={{ paywall: null }} />)).toBe("");
    const signup = renderToString(<PaywallCard ent={{ paywall: { status: 401, text: "q" }, signIn: () => {}, dismissPaywall: () => {} }} />);
    expect(signup).toMatch(/Sign in free/);
    expect(signup).toMatch(/you@email\.com/);
    const pay = renderToString(<PaywallCard ent={{ paywall: { status: 402 }, subscribe: () => {}, dismissPaywall: () => {} }} />);
    expect(pay).toMatch(/\$7\/mo/);
    expect(pay).not.toMatch(/NaN/);
  });
});
