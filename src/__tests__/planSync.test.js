import { describe, it, expect } from "vitest";
import { plansDiffer, reconcile } from "../agent/planSync.js";
import { DEFAULTS } from "../analysis/plan.js";

describe("plansDiffer", () => {
  it("treats structurally equal objects as equal regardless of key order", () => {
    expect(plansDiffer({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
  });

  it("detects a changed value", () => {
    expect(plansDiffer({ ...DEFAULTS }, { ...DEFAULTS, retireAge: 60 })).toBe(true);
  });

  it("compares nested structures, not reference identity", () => {
    expect(plansDiffer({ x: { y: [1, 2] } }, { x: { y: [1, 2] } })).toBe(false);
    expect(plansDiffer({ x: { y: [1, 2] } }, { x: { y: [2, 1] } })).toBe(true);
  });
});

describe("reconcile (local vs remote on sign-in)", () => {
  it("uploads local when there is no remote and local is customized", () => {
    const local = { ...DEFAULTS, retireAge: 60 };
    expect(reconcile(local, null)).toEqual({ action: "upload" });
  });

  it("does nothing when there is no remote and local is pristine DEFAULTS", () => {
    expect(reconcile({ ...DEFAULTS }, null)).toEqual({ action: "none" });
  });

  it("adopts remote silently when local is pristine but remote exists", () => {
    const remote = { ...DEFAULTS, retireAge: 62 };
    expect(reconcile({ ...DEFAULTS }, remote)).toEqual({ action: "adopt-remote" });
  });

  it("does nothing when local and remote already match", () => {
    const same = { ...DEFAULTS, retireAge: 58 };
    expect(reconcile(same, { ...same })).toEqual({ action: "none" });
  });

  it("flags a conflict when both are customized and differ", () => {
    const local = { ...DEFAULTS, retireAge: 60 };
    const remote = { ...DEFAULTS, retireAge: 50 };
    expect(reconcile(local, remote)).toEqual({ action: "conflict" });
  });
});
