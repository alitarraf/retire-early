// Renders one chat turn plus the collapsible "Actions taken" transparency
// panel (PRD §8.4): every tool the agent called, with a one-line result.
import { useState } from "react";
import { neutral, status } from "../../theme.js";
import { fmt } from "../../format.js";
import { MiniMarkdown } from "./MiniMarkdown.jsx";

const TOOL_LABELS = {
  run_scenario: "Ran scenario",
  find_earliest_retirement: "Found earliest retirement",
  max_sustainable_spend: "Max sustainable spend",
  run_monte_carlo: "Ran Monte Carlo",
  optimize_roth_conversions: "Optimized Roth conversions",
  stress_or_history: "Ran downside scenario",
  get_change_log: "Reviewed its changes",
  update_inputs: "Changed inputs",
  set_retire_age: "Set retire age",
  set_scenario: "Set scenario",
};

function oneLineResult(step) {
  const r = step.result ?? {};
  if (step.isError) return r.error ?? "error";
  if (r.status === "applied") return "applied ✓";
  if (r.status === "awaiting_confirmation") return "awaiting your confirmation";
  if (r.status === "no_change") return "no change needed";
  if ("successRate" in r) return `${Math.round(r.successRate * 100)}% success`;
  if ("survives" in r) {
    return r.survives
      ? `lasts to plan horizon · estate ${fmt(r.endEstate ?? 0)}`
      : `depletes ~age ${r.depletionAge}`;
  }
  if ("earliestAge" in r) return `age ${r.earliestAge}`;
  if ("monthlyAtRetirement" in r) return `${fmt(r.monthlyAtRetirement)}/mo`;
  if ("gain" in r) return r.type === "fill" ? `+${fmt(r.gain)} estate` : "no gain";
  return step.summary ?? "done";
}

function argSummary(args = {}) {
  const parts = Object.entries(args).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(", ") : "current plan";
}

export function ChatMessage({ message }) {
  const [open, setOpen] = useState(false);
  const isUser = message.role === "user";
  const traj = message.trajectory ?? [];

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{ maxWidth: "85%" }}>
        <div
          style={{
            background: isUser ? neutral.ink : "#fff",
            color: isUser ? "#fff" : neutral.text,
            border: isUser ? "none" : `1px solid ${neutral.border}`,
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: isUser ? "pre-wrap" : "normal",
            wordBreak: "break-word",
          }}
        >
          {isUser ? (
            message.text
          ) : message.text ? (
            <MiniMarkdown text={message.text} />
          ) : (
            <span style={{ color: neutral.textFaint }}>…</span>
          )}
          {message.incomplete && (
            <span style={{ color: status.warn, fontSize: 11, display: "block", marginTop: 4 }}>
              (response incomplete)
            </span>
          )}
        </div>

        {!isUser && traj.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setOpen((o) => !o)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: neutral.textMuted,
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 0",
              }}
              aria-expanded={open}
            >
              {open ? "▾" : "▸"} Actions taken ({traj.length})
            </button>
            {open && (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                {traj.map((step) => (
                  <div
                    key={step.id}
                    style={{
                      fontSize: 11,
                      color: step.isError ? status.fail : neutral.text,
                      background: neutral.fill,
                      borderRadius: 8,
                      padding: "5px 8px",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{TOOL_LABELS[step.name] ?? step.name}</span>
                    <span style={{ color: neutral.textFaint }}> ({argSummary(step.args)})</span>
                    {" → "}
                    {oneLineResult(step)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
