import { describe, it, expect, beforeEach } from "vitest";
import {
  addChange,
  setChangeStatus,
  appliedChanges,
  pendingChanges,
  renderChangeLogForContext,
  changeLogForTool,
  _resetChangeIds,
  nextChangeId,
} from "../agent/changeLog.js";

beforeEach(() => _resetChangeIds());

describe("changeLog — structured log + partial revert (§4.4)", () => {
  it("ids are monotonic and unique", () => {
    expect(nextChangeId()).toBe("chg_1");
    expect(nextChangeId()).toBe("chg_2");
  });

  it("addChange is immutable and stamps defaults", () => {
    const a = [];
    const b = addChange(a, { field: "retireAge", from: 55, to: 57, scope: "age" });
    expect(a).toHaveLength(0);
    expect(b[0]).toMatchObject({ field: "retireAge", from: 55, to: 57, scope: "age", status: "applied" });
    expect(b[0].id).toBeTruthy();
  });

  it("applying two then reverting one by id leaves the other intact", () => {
    let log = [];
    log = addChange(log, { id: "a", field: "monthlyExpense", from: 10000, to: 8000, scope: "input", status: "applied" });
    log = addChange(log, { id: "b", field: "retireAge", from: 55, to: 56, scope: "age", status: "applied" });
    log = setChangeStatus(log, "a", "reverted");

    expect(appliedChanges(log).map((e) => e.id)).toEqual(["b"]);
    const tool = changeLogForTool(log);
    expect(tool.find((e) => e.id === "a").status).toBe("reverted");
    expect(tool.find((e) => e.id === "b").status).toBe("applied");
  });

  it("renderChangeLogForContext only shows applied entries", () => {
    let log = [];
    log = addChange(log, { id: "a", field: "monthlyExpense", from: 10000, to: 8000, scope: "input", status: "applied" });
    log = addChange(log, { id: "b", field: "ssAge", from: 67, to: 70, scope: "input", status: "awaiting_confirmation" });
    const txt = renderChangeLogForContext(log);
    expect(txt).toMatch(/monthlyExpense: 10000 → 8000/);
    expect(txt).not.toMatch(/ssAge/);
    expect(pendingChanges(log)).toHaveLength(1);
  });

  it("empty log renders a clear message", () => {
    expect(renderChangeLogForContext([])).toMatch(/No changes/i);
  });
});
