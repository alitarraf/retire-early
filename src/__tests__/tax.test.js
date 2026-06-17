import { describe, it, expect } from "vitest";
import { effectiveFedRate, marginalFedRate } from "../engine/tax.js";

describe("tax helpers", () => {
  it("returns 0 effective rate on zero income", () => {
    expect(effectiveFedRate(0)).toBe(0);
    expect(effectiveFedRate(-100)).toBe(0);
  });

  it("effective rate rises with income", () => {
    const a = effectiveFedRate(50000, "single");
    const b = effectiveFedRate(150000, "single");
    const c = effectiveFedRate(400000, "single");
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(0.37); // effective always below top marginal
  });

  it("MFJ brackets are wider than single (same income → lower/equal marginal)", () => {
    const single = marginalFedRate(120000, "single");
    const mfj = marginalFedRate(120000, "mfj");
    expect(mfj).toBeLessThan(single);
  });

  it("marginal rate steps up through the brackets (MFJ)", () => {
    expect(marginalFedRate(40000, "mfj")).toBe(0.1);
    expect(marginalFedRate(100000, "mfj")).toBe(0.12);
    expect(marginalFedRate(200000, "mfj")).toBe(0.22);
  });
});
