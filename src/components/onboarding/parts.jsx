// Shared onboarding atoms. All real top-level components (never nested in a
// render body) so React preserves input focus on every keystroke. Kept in a
// standalone file so Onboarding.jsx and steps.jsx can both import without a
// circular dependency.

export const GREEN = "#1a2e28";
export const MINT = "#7ecfbb";
export const MUTE = "#7C9A92";

export const lbl = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTE, marginBottom: 7 };

export function StepTitle({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {eyebrow && (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "#3d8c78", textTransform: "uppercase", marginBottom: 8 }}>
          {eyebrow}
        </div>
      )}
      <div style={{ fontSize: 21, fontWeight: 800, color: GREEN, lineHeight: 1.2, marginBottom: sub ? 8 : 0 }}>
        {title}
      </div>
      {sub && <div style={{ fontSize: 13, color: MUTE, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// Large single-select card (life stage, etc.).
export function OptionCard({ emoji, title, sub, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "16px 18px", borderRadius: 12, cursor: "pointer", marginBottom: 10,
        background: selected ? "rgba(126,207,187,0.14)" : "#f7faf9",
        border: `1.5px solid ${selected ? MINT : "#e2e8e6"}`,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 26 }}>{emoji}</span>
      <span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: GREEN }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 12, color: MUTE, marginTop: 2 }}>{sub}</span>}
      </span>
    </button>
  );
}

export function WizField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={lbl}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#9db4ae", marginTop: 5, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

// One teaching one-liner. Purely informational; never blocks.
export function Guide({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, background: "#f2f7f5", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
      <span style={{ fontSize: 13 }}>💡</span>
      <span style={{ fontSize: 11.5, color: "#4a5e58", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// Primary + optional secondary CTA row shared by every step.
export function CtaRow({ primary, onPrimary, primaryDisabled, secondary, onSecondary }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 24 }}>
      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        style={{
          flex: 1, border: "none", borderRadius: 10, cursor: primaryDisabled ? "not-allowed" : "pointer",
          background: primaryDisabled ? "#c8d6d1" : GREEN, color: primaryDisabled ? "#eef4f2" : MINT,
          fontSize: 13, fontWeight: 700, padding: "13px 0",
        }}
      >
        {primary}
      </button>
      {secondary && (
        <button onClick={onSecondary} style={{ border: "none", background: "transparent", color: "#9db4ae", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "13px 8px" }}>
          {secondary}
        </button>
      )}
    </div>
  );
}
