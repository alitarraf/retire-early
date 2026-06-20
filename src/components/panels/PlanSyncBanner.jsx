// Reconciliation banner (account sync): shown only when a signed-in user's
// saved plan differs from the plan currently in this browser. Makes the
// local-vs-remote choice explicit so signing in never silently overwrites
// either side. Renders nothing unless there's a conflict to resolve.

import { neutral, status } from "../../theme.js";

export function PlanSyncBanner({ sync }) {
  if (!sync?.conflict) return null;
  const { updatedAt } = sync.conflict;
  const when = updatedAt ? new Date(updatedAt).toLocaleDateString() : null;
  return (
    <div
      role="dialog"
      aria-label="Saved plan found"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        padding: "8px 14px",
        background: "#fffaf0",
        borderBottom: `1px solid ${status.warnSoft}`,
        fontSize: 12,
        color: neutral.text,
      }}
    >
      <span style={{ fontWeight: 600 }}>
        Found a saved plan{when ? ` from ${when}` : ""} on your account — load it or keep the one you have here?
      </span>
      <span style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
        <button
          onClick={sync.loadRemote}
          style={{ background: neutral.ink, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Load saved
        </button>
        <button
          onClick={sync.keepLocal}
          style={{ background: "transparent", color: neutral.textMuted, border: `1px solid ${neutral.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
        >
          Keep this one
        </button>
      </span>
    </div>
  );
}
