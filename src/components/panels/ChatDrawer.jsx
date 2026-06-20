// ─────────────────────────────────────────────────────────────
//  ChatDrawer — the docked, collapsible "Ask" panel (PRD §8).
//  Owns the conversation via useAsk. Always mounted (when the feature
//  flag is on) so the in-memory transcript survives collapse. Renders
//  the message list + "Actions taken", dynamic suggested prompts,
//  graduated-confirmation cards with per-change diffs, the "Changes
//  made by Ask" audit trail with per-row + undo-all revert, the soft
//  token-budget notices, and an accessible input.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { neutral, status } from "../../theme.js";
import { fmt } from "../../format.js";
import { useAsk, suggestedPrompts, followUpChips } from "../../agent/useAsk.js";
import { ChatMessage } from "./ChatMessage.jsx";

function fmtVal(v) {
  if (v == null) return "—";
  if (typeof v === "number" && Math.abs(v) >= 100) return fmt(v);
  return String(v);
}

function ConfirmCard({ card, onConfirm, onReject }) {
  return (
    <div
      style={{
        border: `1px solid ${status.warnSoft}`,
        background: "#fffaf0",
        borderRadius: 12,
        padding: "10px 12px",
        marginBottom: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: status.warn, marginBottom: 6 }}>
        Apply these changes?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {card.changes.map((ch) => (
          <div key={ch.id} style={{ fontSize: 12, color: neutral.text, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontWeight: 700 }}>{ch.field}</span>: {fmtVal(ch.from)} →{" "}
            <span style={{ color: neutral.ink, fontWeight: 700 }}>{fmtVal(ch.to)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onConfirm(card.id)}
          style={{ background: status.ok, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Apply
        </button>
        <button
          onClick={() => onReject(card.id)}
          style={{ background: "transparent", color: neutral.textMuted, border: `1px solid ${neutral.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AuditTrail({ changeLog, onRevert, onUndoAll, appliedCount }) {
  const [open, setOpen] = useState(false);
  const visible = changeLog.filter((e) => e.status === "applied" || e.status === "reverted");
  if (!visible.length) return null;
  return (
    <div style={{ borderTop: `1px solid ${neutral.border}`, padding: "8px 12px", background: neutral.surface }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: neutral.ink, display: "flex", alignItems: "center", gap: 6 }}
        >
          {open ? "▾" : "▸"} Changes made by Ask
          {appliedCount > 0 && (
            <span style={{ background: status.okSoft, color: neutral.ink, borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>
              {appliedCount}
            </span>
          )}
        </button>
        {appliedCount > 0 && (
          <button
            onClick={onUndoAll}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: status.fail }}
          >
            Undo all
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {visible.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: e.status === "reverted" ? neutral.textFaint : neutral.text }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", textDecoration: e.status === "reverted" ? "line-through" : "none" }}>
                {e.field}: {fmtVal(e.from)} → {fmtVal(e.to)}
              </span>
              {e.status === "applied" && (
                <button
                  onClick={() => onRevert(e.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: status.fail }}
                  aria-label={`Revert ${e.field}`}
                >
                  revert
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatDrawer({ inputs, plan, results, actions, variant = "dock" }) {
  const [open, setOpen] = useState(false);
  const ask = useAsk({ inputs, plan, results, actions });
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [ask.display, ask.streaming, ask.pending, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    ask.send(t);
  };

  // Start a fresh conversation in place (no page reload) and refocus the input.
  const startFresh = () => {
    ask.reset();
    inputRef.current?.focus();
  };

  const prompts = suggestedPrompts(results, inputs);

  // ── collapsed launcher ──────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Ask assistant"
        style={
          variant === "sheet"
            ? { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: neutral.ink, color: "#fff", border: "none", borderRadius: 28, height: 52, padding: "0 18px", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", cursor: "pointer" }
            : { position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 40, background: neutral.ink, color: "#fff", border: "none", borderRadius: "10px 0 0 10px", padding: "14px 10px", writingMode: "vertical-rl", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", cursor: "pointer", boxShadow: "-2px 0 10px rgba(0,0,0,0.15)" }
        }
      >
        💬 Ask{ask.appliedCount > 0 ? ` · ${ask.appliedCount}` : ""}
      </button>
    );
  }

  const panelStyle =
    variant === "sheet"
      ? { position: "fixed", inset: 0, zIndex: 50, background: "#fff", display: "flex", flexDirection: "column" }
      : { position: "fixed", right: 0, top: 0, bottom: 0, width: 400, maxWidth: "100vw", zIndex: 50, background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" };

  return (
    <div role="dialog" aria-label="Ask assistant" aria-modal={variant === "sheet"} style={panelStyle}>
      {/* Header */}
      <div style={{ background: neutral.ink, color: "#fff", padding: "10px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>Ask</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {ask.display.length > 0 && (
              <button
                onClick={startFresh}
                disabled={ask.streaming}
                title="Clear this conversation and start over (your plan changes are kept)"
                style={{ background: "none", border: "1px solid #3a4f49", color: ask.streaming ? "#5f726c" : "#9db4ae", fontSize: 11, fontWeight: 600, borderRadius: 8, padding: "3px 9px", cursor: ask.streaming ? "default" : "pointer" }}
              >
                New chat
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#9db4ae", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#7ecfbb", marginTop: 2 }}>Educational — not financial advice</div>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        style={{ flex: 1, overflowY: "auto", padding: "12px 14px", minHeight: 0, background: neutral.fill }}
      >
        {ask.display.length === 0 && (
          <div style={{ color: neutral.textMuted, fontSize: 12, lineHeight: 1.6 }}>
            Ask about your plan — every number comes from the real engine. Try:
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => ask.send(p)}
                  style={{ textAlign: "left", background: "#fff", border: `1px solid ${neutral.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, color: neutral.text, cursor: "pointer" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {ask.display.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}

        {(() => {
          const last = ask.display[ask.display.length - 1];
          if (ask.streaming || !last || last.role !== "assistant" || !last.text) return null;
          const chips = followUpChips(last.text, results, inputs);
          if (!chips.length) return null;
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2, marginBottom: 6 }}>
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => ask.send(c)}
                  style={{ background: "#fff", border: `1px solid ${status.okSoft}`, color: neutral.ink, borderRadius: 14, padding: "5px 11px", fontSize: 12, cursor: "pointer", textAlign: "left" }}
                >
                  {c}
                </button>
              ))}
            </div>
          );
        })()}

        {ask.streaming && (
          <div style={{ fontSize: 11, color: neutral.textMuted, fontStyle: "italic" }}>thinking…</div>
        )}

        {ask.pending.map((card) => (
          <ConfirmCard key={card.id} card={card} onConfirm={ask.confirm} onReject={ask.reject} />
        ))}

        {ask.error && (
          <div style={{ border: `1px solid ${status.failSoft}`, background: "#fdf0ee", borderRadius: 10, padding: "8px 10px", fontSize: 12, color: status.fail }}>
            {ask.error.message}{" "}
            {ask.error.retryable && (
              <button onClick={ask.retry} style={{ marginLeft: 4, background: "none", border: "none", color: status.fail, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Token budget notices (§9) */}
      {ask.tokenWarn && !ask.tokenStopped && (
        <div style={{ fontSize: 11, color: status.warn, padding: "6px 14px", background: "#fffaf0", borderTop: `1px solid ${neutral.border}` }}>
          This conversation is getting long — consider{" "}
          <button onClick={startFresh} style={{ background: "none", border: "none", color: status.warn, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: 11 }}>
            starting fresh
          </button>{" "}
          for best results.
        </div>
      )}
      {ask.tokenStopped && (
        <div style={{ fontSize: 11, color: status.fail, padding: "6px 14px", background: "#fdf0ee", borderTop: `1px solid ${neutral.border}` }}>
          This session reached its length limit.{" "}
          <button onClick={startFresh} style={{ background: "none", border: "none", color: status.fail, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: 11 }}>
            Start fresh
          </button>{" "}
          to keep going. (Your plan changes are kept.)
        </div>
      )}

      {/* Audit trail */}
      <AuditTrail
        changeLog={ask.changeLog}
        appliedCount={ask.appliedCount}
        onRevert={ask.revertChange}
        onUndoAll={ask.undoAll}
      />

      {/* Input */}
      <div style={{ borderTop: `1px solid ${neutral.border}`, padding: 10, flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={ask.tokenStopped ? "Session ended — start fresh to continue" : "Ask about your plan…"}
          disabled={ask.streaming || ask.tokenStopped}
          rows={2}
          aria-label="Ask a question"
          style={{ flex: 1, resize: "none", border: `1px solid ${neutral.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
        <button
          onClick={submit}
          disabled={ask.streaming || ask.tokenStopped || !draft.trim()}
          aria-label="Send"
          style={{ background: draft.trim() && !ask.streaming ? neutral.ink : neutral.border, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: draft.trim() && !ask.streaming ? "pointer" : "default" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
