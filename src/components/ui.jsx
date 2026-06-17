// Reusable input/output primitives. All real top-level components
// (never defined inside a render body) so React preserves input focus.
import { useState } from "react";

export const Section = ({ title, children, accent }) => (
  <div style={{ marginBottom: 22 }}>
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        color: accent || "#7C9A92",
        marginBottom: 9,
        borderBottom: "1px solid #e2e8e6",
        paddingBottom: 5,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

export const Row = ({ label, children, hint }) => (
  <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 9, gap: 10 }}>
    <div style={{ flex: "0 0 170px", fontSize: 12, color: "#4a5e58", paddingTop: 7 }}>
      {label}
      {hint && (
        <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 1, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

export const NumInput = ({ value, onChange, prefix, suffix, step = 1, min = 0, max, width = 105 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
    {prefix && <span style={{ fontSize: 12, color: "#7C9A92", fontWeight: 600 }}>{prefix}</span>}
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width,
        padding: "6px 8px",
        border: "1px solid #d0deda",
        borderRadius: 6,
        fontSize: 13,
        color: "#1a2e28",
        background: "#f7faf9",
        outline: "none",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    />
    {suffix && <span style={{ fontSize: 12, color: "#7C9A92" }}>{suffix}</span>}
  </div>
);

export const Select = ({ value, onChange, options, width = 190 }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width,
      minWidth: 0,
      maxWidth: "100%",
      padding: "6px 8px",
      border: "1px solid #d0deda",
      borderRadius: 6,
      fontSize: 12,
      color: "#1a2e28",
      background: "#f7faf9",
      outline: "none",
    }}
  >
    {options.map((o) => (
      <option key={o.value ?? o} value={o.value ?? o}>
        {o.label ?? o}
      </option>
    ))}
  </select>
);

export const Toggle = ({ value, onChange, options }) => (
  <div
    style={{ display: "flex", background: "#eef2f1", borderRadius: 8, padding: 3, gap: 2, flexWrap: "wrap" }}
  >
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          background: value === opt.value ? "#fff" : "transparent",
          color: value === opt.value ? "#1a2e28" : "#7C9A92",
          boxShadow: value === opt.value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.15s",
        }}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export const Collapsible = ({ title, hint, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 14, border: "1px solid #e2e8e6", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: open ? "#f0f5f4" : "#fafcfc",
          border: "none",
          cursor: "pointer",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2e28" }}>{title}</div>
          {hint && <div style={{ fontSize: 10, color: "#9db4ae", marginTop: 1 }}>{hint}</div>}
        </div>
        <span
          style={{
            fontSize: 14,
            color: "#7C9A92",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>
      {open && <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8e6" }}>{children}</div>}
    </div>
  );
};

export const Card = ({ children, accent, warn, style = {} }) => (
  <div
    style={{
      background: accent ? "#1a2e28" : warn ? "#fff3f0" : "#fff",
      borderRadius: 14,
      padding: 18,
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      border: warn ? "1.5px solid #f5c0b0" : "none",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Label = ({ children, accent, warn }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: accent ? "#7ecfbb" : warn ? "#c0392b" : "#7C9A92",
      marginBottom: 6,
    }}
  >
    {children}
  </div>
);

export const BigNum = ({ children, accent, warn, small }) => (
  <div
    style={{
      fontSize: small ? 18 : 24,
      fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace",
      color: accent ? "#fff" : warn ? "#c0392b" : "#1a2e28",
    }}
  >
    {children}
  </div>
);

export const Note = ({ children, tone = "info" }) => {
  const bg = tone === "warn" ? "#fffbf0" : "#f0f5f4";
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#4a5e58" }}>
      {children}
    </div>
  );
};
