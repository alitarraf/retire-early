// ─────────────────────────────────────────────────────────────
//  /api/chat — stateless serverless proxy (PRD §2, §9, §11).
//
//  Holds the Anthropic API key (NEVER in the client bundle), injects
//  it, forwards one turn to POST /v1/messages with stream:true, and
//  pipes the SSE back unchanged. Runs no agent loop and holds no
//  conversation state.
//
//  Ship-blocker abuse controls (§9): origin allowlist, per-IP rate
//  limit (best-effort in-memory backstop), server-enforced max_tokens,
//  and request logging WITHOUT message content.
//
//  Netlify "modern" function (Web Request → Response); supports SSE
//  streaming by returning the upstream body. Exposed at /api/chat via
//  the redirect in netlify.toml.
//
//  §10 entitlement: checkEntitlement meters NEW user turns (anon 3/day →
//  signed-in-free 5/day → Pro unlimited), issues the anon device cookie,
//  and returns 401/402 at the walls. It's a no-op when Supabase isn't
//  configured, and fails OPEN on a gate error (availability over DRM —
//  this is a soft conversion nudge, not airtight metering). The dev proxy
//  in vite.config.js has no gate, so `npm run dev` is unmetered; the gate
//  runs under `netlify dev` and in production.
// ─────────────────────────────────────────────────────────────

import { checkEntitlement } from "./_lib/gate.js";

const MAX_TOKENS_CAP = 1024; // server-enforced per turn (§9)
const RATE_LIMIT = { windowMs: 60_000, max: 30 }; // per IP, best-effort
const HAIKU = "claude-haiku-4-5";

// In-memory sliding window. Persists only within a warm instance — a backstop,
// not airtight (real durable limits need the §10 KV store).
const hits = new Map();

function rateOk(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= RATE_LIMIT.max;
}

function corsHeaders(origin) {
  const h = { "cache-control": "no-store" };
  if (origin) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-methods"] = "POST, OPTIONS";
    h["access-control-allow-headers"] = "content-type, authorization";
    h["access-control-allow-credentials"] = "true";
    h.vary = "Origin";
  }
  return h;
}

function json(status, obj, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

// Netlify "modern" function routing: serve this directly at /api/chat.
export const config = { path: "/api/chat" };

export default async function handler(req) {
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.ASK_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Origin allowlist: an Origin header that isn't allowed is rejected. A missing
  // Origin (same-origin navigations, server-to-server) passes.
  if (origin && allowed.length && !allowed.includes(origin)) {
    return json(403, { error: "origin_not_allowed" }, "");
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "server_misconfigured" }, origin);

  const ip =
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  if (!rateOk(ip)) return json(429, { error: "rate_limited" }, origin);

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" }, origin);
  }

  const { model, max_tokens, system, tools, messages } = body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return json(400, { error: "messages_required" }, origin);
  }
  const cappedMaxTokens = Math.min(Number(max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

  // §10 entitlement gate. Meters only NEW user turns; no-op without Supabase;
  // fails OPEN so a DB blip never blocks chat (soft nudge, not DRM).
  let gate = { allow: true };
  try {
    gate = await checkEntitlement(req, messages);
  } catch (e) {
    console.error(JSON.stringify({ evt: "ask_gate_error", detail: String(e?.message || e) }));
    gate = { allow: true };
  }
  if (!gate.allow) {
    const headers = { "content-type": "application/json", ...corsHeaders(origin) };
    if (gate.setCookie) headers["set-cookie"] = gate.setCookie;
    return new Response(JSON.stringify(gate.body), { status: gate.status, headers });
  }

  // Logging WITHOUT message content (§9).
  console.log(
    JSON.stringify({ evt: "ask_chat", model: model || HAIKU, messages: messages.length, ts: Date.now() }),
  );

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || HAIKU,
        max_tokens: cappedMaxTokens,
        system,
        tools,
        messages,
        stream: true,
      }),
    });
  } catch (e) {
    return json(502, { error: "upstream_unreachable", detail: String(e?.message || e) }, origin);
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      detail = (await upstream.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    return json(upstream.status || 502, { error: "upstream_error", detail }, origin);
  }

  // Turn started successfully → burn one prompt (only now, so a credits/network
  // failure above doesn't consume quota, §10.1). Best-effort; never block the stream.
  if (gate.commit) {
    try {
      await gate.commit();
    } catch (e) {
      console.error(JSON.stringify({ evt: "ask_commit_error", detail: String(e?.message || e) }));
    }
  }

  const headers = {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    ...corsHeaders(origin),
  };
  if (gate.setCookie) headers["set-cookie"] = gate.setCookie;
  return new Response(upstream.body, { status: 200, headers });
}
