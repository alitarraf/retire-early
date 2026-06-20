// Ask Pro funnel UI (PRD §10.5): the prompt counter, the Pro badge, and the
// two-stage nudge — a sign-up card at the anonymous wall (401), a paywall card
// at the free wall (402). Cards are rendered by the drawer; the model only ever
// requested a turn. Styling reuses the app's neutral/status tokens.
import { useState } from "react";
import { neutral, status } from "../../theme.js";

const card = {
  margin: "0 14px 10px",
  background: "#fff",
  border: `1px solid ${neutral.border}`,
  borderRadius: 12,
  padding: "14px 16px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};
const title = { fontSize: 13, fontWeight: 700, color: neutral.ink, marginBottom: 4 };
const sub = { fontSize: 12, color: neutral.text, lineHeight: 1.5, marginBottom: 12 };
const primaryBtn = {
  border: "none",
  background: neutral.ink,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
};
const linkBtn = {
  border: "none",
  background: "none",
  color: neutral.textMuted,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  padding: "6px 4px",
};

/** "2 of 3 free prompts left" / Ask Pro badge. Null when auth isn't configured. */
export function PromptCounter({ ent }) {
  if (!ent?.configured) return null;
  if (ent.isPro) {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, color: status.ok, border: `1px solid ${status.okSoft}`, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.04em" }}>
        Ask Pro
      </span>
    );
  }
  if (ent.remaining == null) return null;
  const none = ent.remaining === 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: none ? status.warn : neutral.textFaint }}>
      {ent.remaining} of {ent.limit} free left
    </span>
  );
}

/** Sign-up (401) or paywall (402) card. Calls onCleared after a flow starts. */
export function PaywallCard({ ent }) {
  const isPaywall = ent?.paywall?.status === 402;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  if (!ent?.paywall) return null;

  const sendLink = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const res = await ent.signIn(email.trim());
    setBusy(false);
    if (res.ok) setSent(true);
    else setErr(res.error || "Couldn't send the link.");
  };

  const subscribe = async () => {
    setBusy(true);
    setErr(null);
    const res = await ent.subscribe();
    if (!res?.ok) {
      setBusy(false);
      setErr(res?.error || "Couldn't start checkout.");
    }
    // On success the browser redirects to Stripe.
  };

  if (isPaywall) {
    return (
      <div style={card} role="dialog" aria-label="Upgrade to Ask Pro">
        <div style={title}>Keep asking with Ask Pro</div>
        <div style={sub}>You've used your 5 prompts for today. Go unlimited for $7/month — cancel anytime.</div>
        {err && <div style={{ fontSize: 11, color: status.fail, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button style={primaryBtn} onClick={subscribe} disabled={busy}>
            {busy ? "Starting…" : "Subscribe — $7/mo"}
          </button>
          <button style={linkBtn} onClick={ent.dismissPaywall}>Maybe later</button>
        </div>
      </div>
    );
  }

  // 401 — anonymous wall → sign-up nudge (no card).
  return (
    <div style={card} role="dialog" aria-label="Sign in to keep asking">
      <div style={title}>Sign in free to keep asking</div>
      <div style={sub}>You've used your 3 free prompts for today. Sign in with email for 5 a day — no card needed.</div>
      {sent ? (
        <div style={{ fontSize: 12, color: status.ok, fontWeight: 600 }}>
          Check your email for a sign-in link, then come back here.
        </div>
      ) : (
        <>
          {err && <div style={{ fontSize: 11, color: status.fail, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="you@email.com"
              aria-label="Email address"
              style={{ flex: 1, minWidth: 0, border: `1px solid ${neutral.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12 }}
            />
            <button style={primaryBtn} onClick={sendLink} disabled={busy}>
              {busy ? "…" : "Send link"}
            </button>
          </div>
          <button style={{ ...linkBtn, marginTop: 6 }} onClick={ent.dismissPaywall}>Maybe later</button>
        </>
      )}
    </div>
  );
}
