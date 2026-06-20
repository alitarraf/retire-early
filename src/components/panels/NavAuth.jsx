// ─────────────────────────────────────────────────────────────
//  NavAuth — the auth cluster in the app's top-right header. Makes
//  sign-in *visible* (the email + a Sign out when signed in) and
//  *reachable* any time (a proactive "Sign in" popover when signed
//  out — the path that used to exist only behind the 3-prompt
//  paywall). Renders nothing when auth isn't configured, so the
//  header is unchanged where Supabase isn't set up (CI/dev).
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { SignInForm } from "./Paywall.jsx";

// Header-tone buttons (the dark #1a2e28 strip).
const navBtn = {
  background: "none",
  border: "1px solid #3a5650",
  borderRadius: 8,
  color: "#aed8cd",
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 10px",
  cursor: "pointer",
};

export function NavAuth({ ent }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close the sign-in popover on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ent?.configured) return null;

  // Signed in → show who, and a way out.
  if (ent.signedIn) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span
          title={ent.email || "Signed in"}
          style={{ fontSize: 11, color: "#7ecfbb", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {ent.email || "Signed in"}
        </span>
        <button style={navBtn} onClick={ent.signOut}>Sign out</button>
      </div>
    );
  }

  // Signed out → proactive sign-in, anchored popover.
  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button style={navBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Sign in
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Sign in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 60,
            width: 300,
            background: "#fff",
            border: "1px solid #d4e0dc",
            borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          <SignInForm
            ent={ent}
            heading="Sign in to save your plan"
            subtext="Save your plan across devices and get more daily prompts — no card needed."
          />
        </div>
      )}
    </div>
  );
}
