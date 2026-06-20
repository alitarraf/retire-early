// ─────────────────────────────────────────────────────────────
//  Structured change log (PRD §4.4). The authoritative record of
//  everything the agent has changed this session — independent of
//  React state. Backs the audit trail (§4.3), powers per-change
//  revert, and is injected (compacted) into each turn's context (§5).
//
//  Pure helpers over a plain array of entries:
//    { id, ts, field, from, to, scope, status }
//  scope:  "input" | "scenario" | "age"
//  status: "applied" | "awaiting_confirmation" | "reverted" | "rejected"
// ─────────────────────────────────────────────────────────────

let _seq = 0;
/** Monotonic, collision-free id (deterministic within a session). */
export function nextChangeId() {
  _seq += 1;
  return `chg_${_seq}`;
}

// Allow tests to reset the counter for stable ids.
export function _resetChangeIds() {
  _seq = 0;
}

/** Append a change entry; returns a NEW array (never mutates). */
export function addChange(log, entry) {
  return [
    ...log,
    {
      id: entry.id ?? nextChangeId(),
      ts: entry.ts ?? Date.now(),
      field: entry.field,
      from: entry.from,
      to: entry.to,
      scope: entry.scope ?? "input",
      status: entry.status ?? "applied",
    },
  ];
}

/** Mark a single entry's status (e.g. confirm → applied, or → reverted). */
export function setChangeStatus(log, id, status) {
  return log.map((e) => (e.id === id ? { ...e, status } : e));
}

/** Entries currently in force (applied, not yet reverted). */
export function appliedChanges(log) {
  return log.filter((e) => e.status === "applied");
}

/** Entries staged and waiting on the user. */
export function pendingChanges(log) {
  return log.filter((e) => e.status === "awaiting_confirmation");
}

/**
 * Compact one-line-per-change rendering for the model's per-turn context (§5).
 * Numbers live here (authoritative), not re-summarised into prose.
 */
export function renderChangeLogForContext(log) {
  const live = appliedChanges(log);
  if (!live.length) return "No changes applied by Ask yet.";
  return live
    .map((e) => `- ${e.field}: ${fmtVal(e.from)} → ${fmtVal(e.to)} (${e.scope})`)
    .join("\n");
}

/** Structured form returned by the get_change_log tool. */
export function changeLogForTool(log) {
  return log.map((e) => ({
    id: e.id,
    field: e.field,
    from: e.from,
    to: e.to,
    scope: e.scope,
    status: e.status,
  }));
}

function fmtVal(v) {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
