import { describe, it, expect } from "vitest";
import { simulate } from "../engine/simulate.js";

const snapAt = (res, age) => res.snaps.find((s) => s.age === age);
const endTotal = (res) => res.snaps[res.snaps.length - 1].total;
// Effective longevity: the depletion age, or life expectancy if it lasts.
const longevity = (res, lifeExpect) => res.depleted ?? lifeExpect;

// ── Scenario A — Roth conversion shifts balances ──────────────
describe("Scenario A: Roth conversion shifts balances", () => {
  const base = {
    retireAge: 55,
    lifeExpect: 85,
    ssAge: 67,
    monthlyExpense: 12000,
    inflationRate: 4.2,
    stockReturn: 7,
    rothContributions: 200000,
    rothEarnings: 50000,
    brokerage: 0,
    brokerageBasis: 0,
    brokerageLtcgRate: 24.9,
    k401: 800000,
    cashDeposit: 120000,
    muniBonds: 0,
    stateTaxRate: 9.9,
    ssBenefit: 1800,
    filingStatus: "single",
  };
  const noConv = simulate({ ...base, annualRothConversion: 0 });
  const conv = simulate({ ...base, annualRothConversion: 30000 });

  it("conversion moves money from 401k into the Roth bucket by age 58", () => {
    expect(snapAt(conv, 58).roth).toBeGreaterThan(snapAt(noConv, 58).roth);
    expect(snapAt(conv, 58).k401).toBeLessThan(snapAt(noConv, 58).k401);
  });

  it("bug guard: conversion actually changes balances (it wires in)", () => {
    expect(snapAt(conv, 58).roth).not.toBeCloseTo(snapAt(noConv, 58).roth, 0);
  });

  it("total at 58 is approximately equal (conversion ~tax-neutral short term)", () => {
    const a = snapAt(noConv, 58).total;
    const b = snapAt(conv, 58).total;
    expect(Math.abs(b - a) / a).toBeLessThan(0.15);
  });

  it("end-of-life total is not dramatically lower with conversion", () => {
    expect(endTotal(conv)).toBeGreaterThanOrEqual(endTotal(noConv) * 0.9);
  });
});

// ── Scenario B — no false depletion during the bridge ─────────
describe("Scenario B: depletion must not false-fire during the bridge", () => {
  const res = simulate({
    retireAge: 55,
    lifeExpect: 90,
    ssAge: 67,
    monthlyExpense: 8000,
    inflationRate: 3,
    stockReturn: 7,
    rothContributions: 100000, // runs dry well before 59.5
    rothEarnings: 0,
    brokerage: 0,
    brokerageBasis: 0,
    brokerageLtcgRate: 15,
    k401: 3000000, // huge balance, locked until 59.5 — clearly survives once unlocked
    cashDeposit: 0,
    muniBonds: 0,
    stateTaxRate: 0,
    ssBenefit: 0,
    annualRothConversion: 0,
    filingStatus: "single",
  });

  it("does not hard-deplete while the 401k is locked", () => {
    expect(res.depleted).toBeNull();
  });

  it("reports a bridge shortfall instead", () => {
    expect(res.bridgeShortfall).toBeGreaterThan(0);
  });
});

// ── Scenario C — Social Security must be wired & inflated ──────
describe("Scenario C: Social Security affects longevity and inflates", () => {
  const base = {
    retireAge: 60,
    lifeExpect: 90,
    ssAge: 67,
    monthlyExpense: 4500,
    inflationRate: 3,
    stockReturn: 6,
    rothContributions: 50000,
    rothEarnings: 50000,
    brokerage: 0,
    brokerageBasis: 0,
    brokerageLtcgRate: 15,
    k401: 500000,
    cashDeposit: 50000,
    muniBonds: 0,
    stateTaxRate: 0,
    annualRothConversion: 0,
    filingStatus: "single",
  };

  it("higher SS benefit extends longevity (SS is wired in & inflates)", () => {
    const low = longevity(simulate({ ...base, ssBenefit: 0 }), base.lifeExpect);
    const high = longevity(simulate({ ...base, ssBenefit: 2500 }), base.lifeExpect);
    expect(high).toBeGreaterThan(low);
  });

  it("SS cannot rescue money already gone before SS age", () => {
    const poor = {
      retireAge: 55,
      lifeExpect: 90,
      ssAge: 67,
      monthlyExpense: 10000,
      inflationRate: 3,
      stockReturn: 5,
      rothContributions: 60000,
      rothEarnings: 0,
      brokerage: 0,
      brokerageBasis: 0,
      brokerageLtcgRate: 15,
      k401: 0,
      cashDeposit: 0,
      muniBonds: 0,
      stateTaxRate: 0,
      annualRothConversion: 0,
      filingStatus: "single",
    };
    const noSS = simulate({ ...poor, ssBenefit: 0 }).depleted;
    const bigSS = simulate({ ...poor, ssBenefit: 5000 }).depleted;
    expect(noSS).not.toBeNull();
    expect(bigSS).toBeCloseTo(noSS, 5);
  });
});

// ── Spouse SS (combined household pool) ───────────────────────
describe("Spouse SS adds to the household stream", () => {
  const base = {
    retireAge: 60,
    lifeExpect: 90,
    ssAge: 67,
    monthlyExpense: 4500,
    inflationRate: 3,
    stockReturn: 6,
    rothContributions: 50000,
    rothEarnings: 50000,
    brokerage: 0,
    brokerageBasis: 0,
    brokerageLtcgRate: 15,
    k401: 500000,
    cashDeposit: 50000,
    muniBonds: 0,
    stateTaxRate: 0,
    ssBenefit: 1800,
    annualRothConversion: 0,
    filingStatus: "mfj",
  };

  it("a spouse benefit improves the outcome vs none", () => {
    const solo = longevity(simulate({ ...base, ss2Benefit: 0 }), base.lifeExpect);
    const couple = longevity(simulate({ ...base, ss2Benefit: 1500, ss2Age: 67 }), base.lifeExpect);
    expect(couple).toBeGreaterThan(solo);
  });

  it("defaults (ss2Benefit 0) reduce to single-SS behavior", () => {
    const a = endTotal(simulate({ ...base }));
    const b = endTotal(simulate({ ...base, ss2Benefit: 0, ss2Age: base.ssAge }));
    expect(a).toBeCloseTo(b, 5);
  });
});
