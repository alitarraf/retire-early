// Instrument registry integrity: every descriptor must point at real DEFAULTS keys
// and real caps, so the Invest tab's list + priority never reference a dead field.

import { describe, it, expect } from "vitest";
import { INSTRUMENTS, INSTRUMENT_CATEGORIES, instrumentsByCategory, INSTRUMENT_BY_KEY } from "../constants/instruments.js";
import { DEFAULTS } from "../analysis/plan.js";
import { contribCaps } from "../analysis/fundingOrder.js";

const caps = contribCaps(45);

describe("instrument registry", () => {
  it("every balanceKey / contribKey / rateKey exists in DEFAULTS", () => {
    for (const i of INSTRUMENTS) {
      if (i.balanceKey) expect(DEFAULTS, `${i.key}.balanceKey`).toHaveProperty(i.balanceKey);
      if (i.contribKey) expect(DEFAULTS, `${i.key}.contribKey`).toHaveProperty(i.contribKey);
      expect(DEFAULTS, `${i.key}.rateKey`).toHaveProperty(i.rateKey);
    }
  });

  it("every capKey resolves to a real age-adjusted cap", () => {
    for (const i of INSTRUMENTS) {
      if (i.capKey) expect(caps[i.capKey], `${i.key}.capKey=${i.capKey}`).toBeGreaterThan(0);
    }
  });

  it("every instrument has a known category and a unique key", () => {
    const cats = new Set(INSTRUMENT_CATEGORIES.map((c) => c.key));
    const keys = new Set();
    for (const i of INSTRUMENTS) {
      expect(cats).toContain(i.category);
      expect(keys).not.toContain(i.key);
      keys.add(i.key);
    }
    expect(Object.keys(INSTRUMENT_BY_KEY)).toHaveLength(INSTRUMENTS.length);
  });

  it("instrumentsByCategory groups and drops empty categories", () => {
    const groups = instrumentsByCategory();
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.items)).toHaveLength(INSTRUMENTS.length);
  });
});
