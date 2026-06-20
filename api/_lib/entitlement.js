// ─────────────────────────────────────────────────────────────
//  Entitlement core (PRD §10.1–10.3). The metering rules live here as
//  PURE functions (no I/O) so they're unit-tested without a DB (§10.7),
//  with thin Supabase-backed wrappers layered on top.
//
//  Funnel: anonymous 3/day → signed-in-free 5/day → Ask Pro unlimited.
//  Window: rolling 24h. A "prompt" = one USER TURN (not one API call);
//  the proxy derives turn boundaries from the message shape, not a
//  client flag (a continuation call's last message is a tool_result).
// ─────────────────────────────────────────────────────────────

export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const LIMITS = { anon: 3, free: 5 }; // A/B-tunable (§10.1)

/** Limit for a tier; unknown/pro tiers are unlimited (Infinity). */
export function tierLimit(tier) {
  return LIMITS[tier] ?? Infinity;
}

/**
 * Is a subscription row an active paid entitlement right now?
 * Active AND the period hasn't ended (a lapsed sub reverts to free, §10.5).
 */
export function isActiveSubscription(sub, now = Date.now()) {
  if (!sub || sub.status !== "active") return false;
  if (!sub.current_period_end) return true; // active with no end recorded yet
  return new Date(sub.current_period_end).getTime() > now;
}

/**
 * Roll the counter's window forward if it's older than 24h. Pure: returns a
 * fresh row (count reset to 0, window restarted) or the row unchanged.
 */
export function rolloverWindow(row, now = Date.now()) {
  if (!row) return { count: 0, window_start: new Date(now).toISOString() };
  const started = new Date(row.window_start).getTime();
  if (Number.isNaN(started) || now - started > WINDOW_MS) {
    return { ...row, count: 0, window_start: new Date(now).toISOString() };
  }
  return row;
}

/**
 * Decide whether a turn is allowed for a metered (non-subscriber) identity.
 * PURE — caller persists `nextRow` only after the turn successfully starts.
 *
 * @returns {{ allowed: boolean, nextRow: object, remaining: number, limit: number }}
 *   allowed  — under the limit for this window
 *   nextRow  — the row AFTER rollover with count+1 (persist on success)
 *   remaining— prompts left AFTER this one (for the UI counter)
 */
export function decide({ row, tier, now = Date.now() }) {
  const limit = tierLimit(tier);
  const rolled = rolloverWindow(row, now);
  const used = rolled.count ?? 0;
  const allowed = used < limit;
  const nextRow = { ...rolled, tier, count: used + (allowed ? 1 : 0) };
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - nextRow.count) : Infinity;
  return { allowed, nextRow, remaining, limit };
}

/**
 * Does this request body represent a NEW user turn (should be metered) or a
 * tool-result continuation of one already in flight (must not be metered)?
 * Source of truth is the message shape, never a client flag (advisor): a
 * continuation's last message is a user message carrying tool_result blocks.
 */
export function isNewUserTurn(messages) {
  if (!Array.isArray(messages) || !messages.length) return true;
  const last = messages[messages.length - 1];
  const isToolResult =
    last?.role === "user" &&
    Array.isArray(last.content) &&
    last.content.some((b) => b?.type === "tool_result");
  return !isToolResult;
}
