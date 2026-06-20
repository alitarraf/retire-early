import { describe, it, expect } from "vitest";
import { followUpChips } from "../agent/useAsk.js";

describe("followUpChips — clickable next questions (§8.3)", () => {
  it("extracts bold either/or options and re-phrases them in the user's voice", () => {
    const text =
      "Are you primarily concerned about **minimizing the total tax bill over your lifetime**, or about **keeping your early-retirement taxable income low** (to reduce Medicare premiums)?";
    const chips = followUpChips(text, {}, {});
    expect(chips).toHaveLength(2);
    expect(chips[0]).toBe("Minimizing the total tax bill over my lifetime");
    expect(chips[1]).toBe("Keeping my early-retirement taxable income low");
  });

  it("ignores number/figure emphasis (not real options)", () => {
    const text = "You spend **$14,258/month** and have a **29%** success rate. What next?";
    const chips = followUpChips(text, { earliest: 52 }, { retireAge: 55 });
    // falls back to contextual chips, not the $ / % bolds
    expect(chips.some((c) => c.includes("$14,258"))).toBe(false);
    expect(chips[0]).toBe("Show me retiring at 52");
  });

  it("falls back to contextual next-steps when there are no bold options", () => {
    const chips = followUpChips("Your money lasts to 85.", { mcSuccess: 0.6 }, { retireAge: 55 });
    expect(chips).toContain("How do I de-risk my plan?");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(3);
  });
});
