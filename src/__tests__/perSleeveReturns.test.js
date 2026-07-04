// Phase 1C — per-sleeve returns in retirement
// cd/munis previously compounded at the STOCK return inside simulate();
// their real yields were only used in accumulation (projectTo). cashReturn /
// muniYield give each sleeve its own rate; null reproduces legacy exactly.
// Sleeve rates stay FIXED under a returnSeries — cash doesn't crash.

import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const lastTotal = (res) => res.snaps[res.snaps.length - 1].total;

const base = {
  retireAge: 60,
  lifeExpect: 90,
  ssAge: 67,
  ssBenefit: 2000,
  monthlyExpense: 5000,
  inflationRate: 3,
  stockReturn: 8,
  rothContributions: 0,
  rothEarnings: 0,
  brokerage: 0,
  brokerageBasis: 0,
  brokerageLtcgRate: 15,
  k401: 1_000_000,
  cashDeposit: 500_000,
  muniBonds: 400_000,
  stateTaxRate: 0,
  annualRothConversion: 0,
  filingStatus: "mfj",
};

describe("per-sleeve returns: backward compatibility", () => {
  it("null cashReturn/muniYield reproduces legacy numbers exactly", () => {
    const legacy = simulate({ ...base });
    const explicit = simulate({ ...base, cashReturn: null, muniYield: null });
    expect(lastTotal(explicit)).toBe(lastTotal(legacy));
  });

  it("sleeve rate equal to the stock return matches legacy", () => {
    const legacy = simulate({ ...base });
    const same = simulate({ ...base, cashReturn: 8, muniYield: 8 });
    expect(lastTotal(same)).toBeCloseTo(lastTotal(legacy), 4);
  });
});

describe("per-sleeve returns: cash and munis earn their own yields", () => {
  it("a cash-heavy plan grows slower at a realistic cash yield than at stock rates", () => {
    const atStock = simulate({ ...base });
    const atCash = simulate({ ...base, cashReturn: 3.9, muniYield: 4.5 });
    expect(lastTotal(atCash)).toBeLessThan(lastTotal(atStock));
  });

  it("a higher muni yield strictly helps", () => {
    const lowMuni = simulate({ ...base, cashReturn: 3.9, muniYield: 3 });
    const highMuni = simulate({ ...base, cashReturn: 3.9, muniYield: 5 });
    expect(lastTotal(highMuni)).toBeGreaterThan(lastTotal(lowMuni));
  });
});

describe("per-sleeve returns: fixed under a returnSeries (cash doesn't crash)", () => {
  // Three brutal equity years at retirement. The cash-buffered run must beat
  // the same allocation where cash is (incorrectly) riding the equity series.
  const crashSeries = [-30, -15, -10, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];

  it("a cash buffer holds its value through the crash years", () => {
    const cashRides = simulate({ ...base, returnSeries: crashSeries });
    const cashHolds = simulate({ ...base, returnSeries: crashSeries, cashReturn: 3.9, muniYield: 4.5 });
    expect(lastTotal(cashHolds)).toBeGreaterThan(lastTotal(cashRides));
  });
});
