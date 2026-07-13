// Headless render smoke test for AllocationCard. `npm run build` only compiles
// JSX — it never executes a render, so a runtime throw in MixMilestones' stacked-
// column math, a NaN, or a bad prop shape would ship unseen. renderToStaticMarkup
// runs the full render in node and throws on any of those. Covers every caption
// branch + the retired/off/custom states. (Interaction — clicking a profile row —
// still needs the browser pass; this locks in that the render path is crash-free.)

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AllocationCard } from "../components/panels/AllocationCard.jsx";
import { STEPS } from "../components/onboarding/steps.jsx";
import { makePlan, DEFAULTS } from "../analysis/plan.js";

const render = (props) => renderToStaticMarkup(<AllocationCard {...props} />);

describe("AllocationCard render", () => {
  it("planning mode: renders the profile comparison + milestone columns + 'you' marker", () => {
    const plan = makePlan({ ...DEFAULTS, allocationEnabled: true, riskProfile: "moderate" });
    const html = render({
      plan,
      earliestByRisk: { conservative: 51, moderate: 48, aggressive: 48 },
      onPickRisk: () => {},
    });
    expect(html).toContain("When can you retire?");
    expect(html).toContain("age 48");
    expect(html).toContain("← you");
    expect(html).toContain("Today"); // milestone columns drew
    expect(html).toContain("At 75");
    expect(html).toContain("then holds"); // glide-floor summary line
    expect(html).toContain("More stocks buys ~3 earlier years");
  });

  it("retired mode (earliestByRisk null): shows the mix, no comparison table", () => {
    const plan = makePlan({ ...DEFAULTS, allocationEnabled: true, riskProfile: "conservative", alreadyRetired: true });
    const html = render({ plan, earliestByRisk: null, onPickRisk: () => {} });
    expect(html).toContain("Your mix today");
    expect(html).not.toContain("When can you retire?");
    expect(html).toContain("Today"); // milestone columns still draw
  });

  it("off state: reports 'not modeled' and the flat return", () => {
    const plan = makePlan({ ...DEFAULTS, allocationEnabled: false });
    const html = render({ plan, earliestByRisk: { conservative: 51, moderate: 50, aggressive: 49 }, onPickRisk: () => {} });
    expect(html).toContain("Not modeled yet");
    expect(html).toContain(`flat ${plan.stockReturn}%`);
  });

  it("custom pinned mix: labels the mix and collapses to a single fixed column", () => {
    const plan = makePlan({
      ...DEFAULTS,
      allocationEnabled: true,
      riskProfile: "custom",
      pinAllocation: true,
      equityPct: 50,
      bondPct: 30,
      cashPct: 20,
    });
    const html = render({ plan, earliestByRisk: { conservative: 55, moderate: 55, aggressive: 55 }, onPickRisk: () => {} });
    expect(html).toContain("custom mix");
    expect(html).toContain("Your mix"); // single pinned column, not milestones
    expect(html).toContain("Holds fixed at 50% stocks");
    expect(html).not.toContain("At 75");
  });

  it("caption edge — risk unlocks: safe profile null but aggressive real", () => {
    const plan = makePlan({ ...DEFAULTS, allocationEnabled: true, riskProfile: "aggressive" });
    const html = render({ plan, earliestByRisk: { conservative: null, moderate: null, aggressive: 60 }, onPickRisk: () => {} });
    expect(html).toContain("staying in stocks longer can");
    expect(html).toContain("75+"); // the null profiles render as 75+
  });

  it("caption edge — all blocked: no profile reaches a safe exit by 75", () => {
    const plan = makePlan({ ...DEFAULTS, allocationEnabled: true, riskProfile: "moderate" });
    const html = render({ plan, earliestByRisk: { conservative: null, moderate: null, aggressive: null }, onPickRisk: () => {} });
    expect(html).toContain("No mix reaches a safe exit by 75");
  });
});

describe("onboarding Allocate step render", () => {
  const Allocate = STEPS.find((s) => s.id === "allocate").Body;
  const stub = { setMany: () => {}, nav: { go: () => {} } };

  it("is registered in STEPS between spendss and reveal", () => {
    const ids = STEPS.map((s) => s.id);
    expect(ids).toContain("allocate");
    expect(ids.indexOf("allocate")).toBe(ids.indexOf("spendss") + 1);
    expect(ids.indexOf("allocate")).toBe(ids.indexOf("reveal") - 1);
  });

  it("renders the teaching milestones + profile picker when enabled", () => {
    const vals = { ...DEFAULTS, allocationEnabled: true, riskProfile: "moderate" };
    const html = renderToStaticMarkup(<Allocate vals={vals} {...stub} />);
    expect(html).toContain("How should your money be invested?");
    expect(html).toContain("Today"); // milestone columns drew
    expect(html).toContain("At 75");
    expect(html).toContain("Aggressive"); // profile picker present
  });

  it("renders (dimmed, no picker) when the glide is off", () => {
    const vals = { ...DEFAULTS, allocationEnabled: false };
    const html = renderToStaticMarkup(<Allocate vals={vals} {...stub} />);
    expect(html).toContain("Keep it simple");
    expect(html).not.toContain("Pick your risk profile");
  });
});
