import { describe, it, expect } from "vitest";
import { followUpChips, parseActions } from "../agent/useAsk.js";

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

describe("parseActions — model-authored chip comment", () => {
  it("splits a closed block into visible prose + chips, stripping the comment", () => {
    const raw =
      "Your plan looks solid through age 90.\n<!--actions: Run a Monte Carlo simulation | Compare retiring at 50 vs 55 | Lower my spending-->";
    const { text, actions } = parseActions(raw);
    expect(text).toBe("Your plan looks solid through age 90.");
    expect(actions).toEqual([
      "Run a Monte Carlo simulation",
      "Compare retiring at 50 vs 55",
      "Lower my spending",
    ]);
  });

  it("returns text unchanged and no chips when there is no comment", () => {
    const raw = "You can retire at 54 with a 92% success rate.";
    expect(parseActions(raw)).toEqual({ text: raw, actions: [] });
  });

  it("hides a mid-stream partial marker so the sentinel never flashes", () => {
    // As the comment streams in char-by-char it is never rendered as text.
    expect(parseActions("All set.\n<").text).toBe("All set.\n<");
    for (const tail of ["<!--", "<!--act", "<!--actions:", "<!--actions: Run a Mon"]) {
      const { text, actions } = parseActions(`All set.\n${tail}`);
      expect(text).toBe("All set.");
      expect(actions).toEqual([]);
    }
  });

  it("degrades gracefully on a truncated block (no closing -->)", () => {
    // max_tokens cut the response before the comment closed → hidden, no chips,
    // caller falls back to followUpChips.
    const raw = "Here is the analysis you asked for.\n<!--actions: Run a Monte Carl";
    const { text, actions } = parseActions(raw);
    expect(text).toBe("Here is the analysis you asked for.");
    expect(actions).toEqual([]);
  });

  it("strips a comment that precedes more text (multi-iteration turn) and keeps the last as chips", () => {
    // _raw spans the whole turn: a comment before a tool call must not leak as
    // literal text; the LAST closed comment wins as the chips.
    const raw =
      "Let me run that.\n<!--actions: foo-->The result is 92%.\n<!--actions: Run a stress test | Lower my spending-->";
    const { text, actions } = parseActions(raw);
    expect(text).not.toContain("<!--");
    expect(actions).toEqual(["Run a stress test", "Lower my spending"]);
  });

  it("hides a trailing partial even after an earlier closed block", () => {
    const raw = "A\n<!--actions: x-->B\n<!--actions: trunc";
    const { text, actions } = parseActions(raw);
    expect(text).not.toContain("<!--");
    expect(text).toBe("A\nB");
    expect(actions).toEqual(["x"]);
  });

  it("caps at 3 chips and drops empty segments", () => {
    const raw = "Done.\n<!--actions: A | B |  | C | D-->";
    expect(parseActions(raw).actions).toEqual(["A", "B", "C"]);
  });

  it("tolerates whitespace and casing in the marker", () => {
    const raw = "Done.\n<!--  ACTIONS :  First step | Second step  -->\n";
    const { text, actions } = parseActions(raw);
    expect(text).toBe("Done.");
    expect(actions).toEqual(["First step", "Second step"]);
  });
});
