// Historical Sequence Testing — replays real return sequences through simulate()
// via the same returnSeries hook used by stressTest/monteCarlo. These lock in the
// table→series mapping, the revert-to-mean tail, and the sp-vs-balanced ordering.
import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";
import { historicalSequence } from "../analysis/historicalSequence.js";
import { HISTORICAL_RETURNS, HISTORICAL_SCENARIOS } from "../constants/historicalReturns.js";

// Shared base simParams (same shape monteCarlo.test.js uses).
const base = {
  retireAge: 60,
  lifeExpect: 90,
  ssAge: 70,
  monthlyExpense: 4000,
  inflationRate: 3,
  stockReturn: 7,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_500_000,
  cashDeposit: 0,
  muniBonds: 0,
  stateTaxRate: 0,
  ssBenefit: 2000,
  annualRothConversion: 0,
  filingStatus: "single",
};

const span = base.lifeExpect - base.retireAge; // 30
const finalTotal = (res) => res.snaps.at(-1)?.total ?? 0;
const totalAtAge = (res, age) => res.snaps.find((s) => s.age === age)?.total ?? 0;
const expectedSeries = (startYear, lens) =>
  Array.from({ length: span }, (_, i) => HISTORICAL_RETURNS[startYear + i]?.[lens] ?? base.stockReturn);

describe("historicalSequence(): table-driven return replay", () => {
  it("builds the exact table series and reverts to the mean past recorded history", () => {
    // 2000 + 30y reaches 2029, but the table ends at 2024 → last 5 years should be the mean.
    const series = expectedSeries(2000, "sp");
    expect(series.length).toBe(span);
    expect(series.slice(0, 3)).toEqual([HISTORICAL_RETURNS[2000].sp, HISTORICAL_RETURNS[2001].sp, HISTORICAL_RETURNS[2002].sp]);
    expect(series.slice(25)).toEqual(Array(5).fill(base.stockReturn)); // 2025–2029 revert to mean

    const viaFn = historicalSequence(base, { startYear: 2000, lens: "sp" });
    const viaManual = simulate({ ...base, returnSeries: series });
    expect(finalTotal(viaFn)).toBeCloseTo(finalTotal(viaManual), 6);
  });

  it("a bad start (2000 dot-com) erodes the portfolio in the early years vs the steady run", () => {
    // Compare the EARLY years (the crash window), not final wealth: with a low
    // withdrawal rate the post-2003 boom can compound the dot-com path back above a
    // flat 7%, but the sequence-of-returns hit is unmistakable up front.
    const steady = simulate({ ...base });
    const dotcom = historicalSequence(base, { startYear: 2000, lens: "sp" });
    expect(totalAtAge(dotcom, 65)).toBeLessThan(totalAtAge(steady, 65) * 0.8);
  });

  it("the S&P lens is harsher than the 60/40 blend through the 2007–08 crash", () => {
    const sp = historicalSequence(base, { startYear: 2007, lens: "sp" });
    const balanced = historicalSequence(base, { startYear: 2007, lens: "balanced" });
    // 2008 was -37% all-equity vs ~-20% blended → equity is lower right after the crash.
    expect(totalAtAge(sp, 62)).toBeLessThan(totalAtAge(balanced, 62));
  });

  it("every named scenario's start year is covered by the returns table", () => {
    for (const sc of HISTORICAL_SCENARIOS) {
      expect(HISTORICAL_RETURNS[sc.startYear], sc.key).toBeDefined();
    }
  });
});
