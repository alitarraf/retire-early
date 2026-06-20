// ─────────────────────────────────────────────────────────────
//  Feature flags for the "Ask" agent (PRD §9). The whole feature
//  ships behind a flag so it can be disabled instantly. The same
//  config carries the write-tool confirmation mode (§4.2).
//
//  Resolution order (first hit wins):
//    1. localStorage  "retire-early.ask.*"   (per-browser override)
//    2. Vite build env VITE_ASK_ENABLED       (deploy default)
//    3. hard default below
// ─────────────────────────────────────────────────────────────

const LS_ENABLED = "retire-early.ask.enabled";
const LS_CONFIRM = "retire-early.ask.confirmMode";

function readLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function envFlag(name) {
  // import.meta.env is replaced at build time by Vite; guard for non-Vite (test) envs.
  try {
    return import.meta.env?.[name];
  } catch {
    return undefined;
  }
}

/** Is the agent enabled? Default ON in dev, overridable per-browser / per-deploy. */
export function isAskEnabled() {
  const ls = readLS(LS_ENABLED);
  if (ls === "1" || ls === "true") return true;
  if (ls === "0" || ls === "false") return false;
  const env = envFlag("VITE_ASK_ENABLED");
  if (env === "0" || env === "false") return false;
  if (env === "1" || env === "true") return true;
  return true; // default-on; flip the env var to disable in a given deploy
}

/**
 * Confirmation mode for write tools (§4.2):
 *   "graduated" (default) — small reversible changes apply directly; large /
 *                           multi-change turns stage a confirmation card.
 *   "always"  — every write is confirmed first.
 *   "never"   — pure direct mutation (no confirmation cards).
 */
export function getConfirmMode() {
  const ls = readLS(LS_CONFIRM);
  if (ls === "always" || ls === "never" || ls === "graduated") return ls;
  const env = envFlag("VITE_ASK_CONFIRM_MODE");
  if (env === "always" || env === "never" || env === "graduated") return env;
  return "graduated";
}

// Per-session soft/hard token budgets (§9).
export const TOKEN_BUDGET = {
  warnAt: 50_000,
  hardStopAt: 100_000,
};

// Write-op budget per user turn (§4.2) and tool-loop ceiling (§7).
export const WRITE_OPS_PER_TURN = 3;
export const MAX_TOOL_ITERATIONS = 8;
