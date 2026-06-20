// Tiny HTTP helpers shared by the Stripe/auth functions (modern Netlify
// functions: Web Request → Response). The chat proxy predates this and keeps
// its own copy; new endpoints share these.

export function corsHeaders(origin) {
  const h = { "cache-control": "no-store" };
  if (origin) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-methods"] = "GET, POST, OPTIONS";
    h["access-control-allow-headers"] = "content-type, authorization";
    h["access-control-allow-credentials"] = "true";
    h.vary = "Origin";
  }
  return h;
}

export function json(status, obj, origin = "", extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin), ...extra },
  });
}

export function readOrigin(req) {
  return req.headers.get("origin") || "";
}

/** False only when an Origin header is present AND not in the allowlist. */
export function originAllowed(origin) {
  const allowed = (process.env.ASK_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return !(origin && allowed.length && !allowed.includes(origin));
}
