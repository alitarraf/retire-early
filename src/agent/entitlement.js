// ─────────────────────────────────────────────────────────────
//  useEntitlement (PRD §10.5) — client state for the Ask Pro funnel.
//
//  Owns: the Supabase session (magic-link), the tier/remaining snapshot
//  (from /api/entitlement-status, never metered), and the paywall card
//  state. Exposes the bits useAsk needs (getToken / onBlocked /
//  onTurnComplete) plus the actions the drawer renders (signIn, signOut,
//  subscribe, openPortal). A no-op shell when auth isn't configured, so
//  the chat behaves exactly as before where Supabase isn't set up.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase, isAuthConfigured } from "./supabaseClient.js";

const STATUS_ENDPOINT = "/api/entitlement-status";

async function fetchStatus(token) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const r = await fetch(STATUS_ENDPOINT, { headers, credentials: "same-origin" });
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

export function useEntitlement() {
  const configured = isAuthConfigured();
  const [session, setSession] = useState(null); // Supabase session or null
  const [status, setStatus] = useState(null); // { tier, remaining, limit, active, email }
  const [paywall, setPaywall] = useState(null); // { status: 401|402, text } | null
  const tokenRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      setStatus(await fetchStatus(tokenRef.current));
    } catch {
      /* leave the last known status; the counter just won't update */
    }
  }, [configured]);

  // Track the Supabase session; refresh the snapshot whenever it changes.
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    let unsub = () => {};
    (async () => {
      const sb = await getSupabase();
      if (!sb || !alive) return;
      const { data } = await sb.auth.getSession();
      if (!alive) return;
      tokenRef.current = data.session?.access_token ?? null;
      setSession(data.session ?? null);
      refresh();
      const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
        tokenRef.current = s?.access_token ?? null;
        setSession(s ?? null);
        refresh();
      });
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => {
      alive = false;
      unsub();
    };
  }, [configured, refresh]);

  // Post-checkout return: the webhook may lag the success_url redirect, so poll
  // a few times with backoff before giving up (the success_url race, §10.4).
  useEffect(() => {
    if (!configured) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ask_checkout") !== "success") return;
    let tries = 0;
    let timer;
    const poll = async () => {
      await refresh();
      tries += 1;
      // Stop once active, or after ~5 attempts (1s,2s,3s,4s,5s).
      const active = (await fetchStatus(tokenRef.current).catch(() => null))?.active;
      if (!active && tries < 5) timer = setTimeout(poll, (tries + 1) * 1000);
    };
    poll();
    // Clean the query string so a refresh doesn't re-trigger.
    params.delete("ask_checkout");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    return () => clearTimeout(timer);
  }, [configured, refresh]);

  const getToken = useCallback(() => tokenRef.current, []);

  const onBlocked = useCallback(({ status: code, text }) => {
    setPaywall({ status: code, text: text ?? "" });
  }, []);

  const dismissPaywall = useCallback(() => setPaywall(null), []);

  const signIn = useCallback(
    async (email) => {
      const sb = await getSupabase();
      if (!sb) return { ok: false, error: "Auth isn't configured." };
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
    tokenRef.current = null;
    setSession(null);
    refresh();
  }, [refresh]);

  const redirectTo = useCallback(async (endpoint) => {
    const headers = tokenRef.current ? { authorization: `Bearer ${tokenRef.current}` } : {};
    const r = await fetch(endpoint, { method: "POST", headers, credentials: "same-origin" });
    if (!r.ok) return { ok: false, error: `Request failed (${r.status}).` };
    const { url } = await r.json();
    if (url) window.location.assign(url);
    return { ok: true };
  }, []);

  const subscribe = useCallback(() => redirectTo("/api/stripe-checkout"), [redirectTo]);
  const openPortal = useCallback(() => redirectTo("/api/stripe-portal"), [redirectTo]);

  return {
    configured,
    session,
    signedIn: Boolean(session),
    email: status?.email ?? session?.user?.email ?? null,
    tier: status?.tier ?? "anon",
    remaining: status?.remaining ?? null,
    limit: status?.limit ?? null,
    isPro: status?.active === true,
    paywall,
    // for useAsk
    getToken,
    onBlocked,
    onTurnComplete: refresh,
    // for the drawer UI
    refresh,
    signIn,
    signOut,
    subscribe,
    openPortal,
    dismissPaywall,
  };
}
