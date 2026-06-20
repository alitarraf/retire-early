// ─────────────────────────────────────────────────────────────
//  usePlanSync — account-scoped plan sync (the layer on top of the
//  localStorage baseline). When the user is signed in, their plan
//  inputs load on sign-in and autosave (debounced) on change, via the
//  server-authoritative /api/plan-{get,save} endpoints. A no-op when
//  auth isn't configured or nobody's signed in — localStorage still
//  holds the plan, exactly as before.
//
//  Reconciliation (local-vs-remote) is a pure function so it's unit-
//  testable without a network or a DB.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULTS } from "../analysis/plan.js";

// Order-insensitive structural stringify, so key ordering never reads as a diff.
function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + stableStringify(v[k]))
    .join(",")}}`;
}

/** True when two plan-input objects are not structurally equal. */
export function plansDiffer(a, b) {
  return stableStringify(a) !== stableStringify(b);
}

/**
 * Decide what to do when a signed-in user's remote plan meets the local one.
 *   upload        — no remote yet AND local is customized → push local up
 *   adopt-remote  — local is pristine DEFAULTS → load remote silently
 *   conflict      — both exist and differ → ask the user (no silent loss)
 *   none          — nothing to do (equal, or remote-absent + local pristine)
 */
export function reconcile(local, remote) {
  if (remote == null) {
    return plansDiffer(local, DEFAULTS) ? { action: "upload" } : { action: "none" };
  }
  if (!plansDiffer(local, remote)) return { action: "none" };
  if (!plansDiffer(local, DEFAULTS)) return { action: "adopt-remote" };
  return { action: "conflict" };
}

export function usePlanSync({ inputs, setInputs, ent }) {
  const [conflict, setConflict] = useState(null); // { data, updatedAt } | null
  // synced flips true ONLY after the initial remote load+reconcile resolves.
  // Autosave gates on it (never on the synchronous loadedRef) so the debounce
  // can't fire mid-load and overwrite a fresh device's saved plan with DEFAULTS.
  const [synced, setSynced] = useState(false);

  // Latest inputs without re-subscribing effects on every keystroke.
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  const prevSignedIn = useRef(false);
  const loadedRef = useRef(false); // guards against re-running the load per render

  // ent is a fresh object each render, but ent.getToken is a stable useCallback —
  // depend on that so authedFetch/save keep a stable identity and the autosave
  // debounce isn't reset by unrelated re-renders.
  const getToken = ent.getToken;
  const authedFetch = useCallback(
    (url, opts = {}) => {
      const token = getToken?.();
      const headers = { ...(opts.headers || {}) };
      if (token) headers.authorization = `Bearer ${token}`;
      return fetch(url, { ...opts, headers, credentials: "same-origin" });
    },
    [getToken],
  );

  const save = useCallback(
    async (data) => {
      try {
        await authedFetch("/api/plan-save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data }),
        });
      } catch {
        /* offline / unconfigured — localStorage still holds the plan */
      }
    },
    [authedFetch],
  );

  // Load remote + reconcile on sign-in (or once at mount if already signed in).
  useEffect(() => {
    if (!ent.configured) return;
    const signedIn = ent.signedIn;
    const justSignedIn = signedIn && !prevSignedIn.current;
    prevSignedIn.current = signedIn;
    if (!signedIn) {
      loadedRef.current = false; // re-load on next sign-in
      setSynced(false);
      return;
    }
    if (loadedRef.current && !justSignedIn) return;
    loadedRef.current = true;

    let alive = true;
    (async () => {
      let payload = null;
      try {
        const r = await authedFetch("/api/plan-get");
        if (r.ok) payload = await r.json();
      } catch {
        return; // couldn't read remote — leave synced false so autosave stays off
      }
      if (!alive) return;
      const remote = payload?.data ?? null;
      const decision = reconcile(inputsRef.current, remote);
      if (decision.action === "upload") save(inputsRef.current);
      else if (decision.action === "adopt-remote") setInputs(remote);
      else if (decision.action === "conflict") setConflict({ data: remote, updatedAt: payload?.updatedAt ?? null });
      // Remote is now known — safe to let autosave run (conflict still blocks it
      // until the user chooses; see below).
      setSynced(true);
    })();
    return () => {
      alive = false;
    };
  }, [ent.configured, ent.signedIn, authedFetch, save, setInputs]);

  // Debounced autosave — only after the initial reconcile resolved (synced), and
  // never while a conflict is pending (would clobber remote before the choice).
  useEffect(() => {
    if (!ent.configured || !ent.signedIn || !synced || conflict) return;
    const t = setTimeout(() => save(inputsRef.current), 1500);
    return () => clearTimeout(t);
  }, [inputs, ent.configured, ent.signedIn, synced, conflict, save]);

  // Conflict resolution.
  const loadRemote = useCallback(() => {
    if (conflict) setInputs(conflict.data);
    setConflict(null);
  }, [conflict, setInputs]);
  const keepLocal = useCallback(() => {
    setConflict(null);
    save(inputsRef.current); // overwrite remote with the local plan
  }, [save]);

  return { conflict, loadRemote, keepLocal };
}
