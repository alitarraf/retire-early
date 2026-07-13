// Three-profile earliest-age comparison feeding the AllocationCard.

import { describe, it, expect } from "vitest";
import { profileEarliestAges } from "../analysis/allocationCompare.js";
import { DEFAULTS } from "../analysis/plan.js";
import { RISK_PROFILE_KEYS } from "../engine/allocation.js";

const SAMPLE = {
  ...DEFAULTS,
  currentAge: 35,
  monthlyExpense: 6000,
  existingBrokerage: 200000,
  existingBrokerageBasis: 200000,
  annualSavings: 40000,
  current401k: 150000,
};

describe("profileEarliestAges", () => {
  it("returns an entry for every named profile", () => {
    const ages = profileEarliestAges(SAMPLE);
    for (const k of RISK_PROFILE_KEYS) {
      expect(ages).toHaveProperty(k);
      expect(ages[k] === null || typeof ages[k] === "number").toBe(true);
    }
  });

  it("a riskier profile never retires later than a safer one (more equity ⇒ ≤ age)", () => {
    // With a survivable plan, more equity compounds faster, so the earliest
    // safe age is monotonic: aggressive ≤ moderate ≤ conservative. Ties allowed.
    const { conservative, moderate, aggressive } = profileEarliestAges(SAMPLE);
    // Only assert ordering among the ages that resolved (non-null).
    if (aggressive != null && moderate != null) expect(aggressive).toBeLessThanOrEqual(moderate);
    if (moderate != null && conservative != null) expect(moderate).toBeLessThanOrEqual(conservative);
  });

  it("does not mutate the caller's inputs", () => {
    const raw = { ...SAMPLE };
    const snapshot = JSON.stringify(raw);
    profileEarliestAges(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});
