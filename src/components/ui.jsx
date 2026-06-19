// Reusable input/output primitives. All real top-level components
// (never defined inside a render body) so React preserves input focus.
import { useState, useRef } from "react";

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

// Optionally controlled: pass `open` + `onToggle` to drive it from the parent
// (so it can be auto-opened by external triggers); omit them for self-managed state.
export const Collapsible = ({ title, hint, children, defaultOpen = false, open: openProp, onToggle }) => {
  const [openState, setOpenState] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const toggle = () => (controlled ? onToggle?.(!open) : setOpenState((v) => !v));
  return (
    <div style={{ marginBottom: 14, border: "1px solid #e2e8e6", borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={toggle}
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

// Small ⓘ that reveals a context popover on hover or keyboard focus.
// Content comes from constants/fieldHelp.js so docs and tooltips never diverge.
// The popover is viewport-fixed and edge-clamped so it never clips inside the
// sidebar's scroll container (right-column fields would otherwise be cut off).
const TIP_W = 240;
export const InfoDot = ({ context, typical }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  if (!context) return null;

  const show = () => {
    const el = btnRef.current;
    if (el && typeof window !== "undefined") {
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left, window.innerWidth - TIP_W - 12));
      setPos({ left, top: r.bottom + 6 });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span style={{ display: "inline-flex", marginLeft: 5, verticalAlign: "middle" }}>
      <button
        ref={btnRef}
        type="button"
        aria-label="More info"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        style={{
          width: 14,
          height: 14,
          padding: 0,
          borderRadius: "50%",
          border: "1px solid #b9d2ca",
          background: open ? "#1a2e28" : "#eef5f2",
          color: open ? "#7ecfbb" : "#5aada0",
          fontSize: 9,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
        }}
      >
        i
      </button>
      {open && pos && (
        <span
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            zIndex: 1000,
            width: TIP_W,
            background: "#1a2e28",
            color: "#dceee8",
            borderRadius: 8,
            padding: "9px 11px",
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: 0,
            textTransform: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          {context}
          {typical && (
            <span style={{ display: "block", marginTop: 5, color: "#7ecfbb" }}>{typical}</span>
          )}
        </span>
      )}
    </span>
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

// Dual-handle range slider, fully inline-styled (no CSS file in this project, so
// native <input type=range> thumbs can't be themed). Pointer-drag + arrow-key
// support; thumbs are real buttons so keyboard focus is visible. Values are
// clamped so the two handles never cross (lo stays <= hi - 1).
export const RangeSlider = ({ min, max, lo, hi, onChange, step = 1 }) => {
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const span = Math.max(1, max - min);
  const pctOf = (v) => ((v - min) / span) * 100;

  const valAt = (clientX) => {
    const el = trackRef.current;
    if (!el) return min;
    const r = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round((min + frac * span) / step) * step;
  };
  const apply = (which, v) => {
    if (which === "lo") onChange(Math.max(min, Math.min(v, hi - step)), hi);
    else onChange(lo, Math.min(max, Math.max(v, lo + step)));
  };
  const onDown = (which) => (e) => {
    e.preventDefault();
    dragRef.current = which;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragRef.current) return;
    apply(dragRef.current, valAt(e.clientX));
  };
  const onUp = () => {
    dragRef.current = null;
  };
  const onKey = (which, cur) => (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      apply(which, cur - step);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      apply(which, cur + step);
    }
  };

  const thumb = (which, val) => (
    <button
      type="button"
      role="slider"
      aria-label={which === "lo" ? "Start age" : "End age"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={val}
      onPointerDown={onDown(which)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onKeyDown={onKey(which, val)}
      style={{
        position: "absolute",
        left: `${pctOf(val)}%`,
        top: "50%",
        width: 14,
        height: 14,
        marginLeft: -7,
        marginTop: -7,
        borderRadius: "50%",
        border: "2px solid #3d8c78",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        cursor: "grab",
        padding: 0,
        touchAction: "none",
      }}
    />
  );

  return (
    <div style={{ position: "relative", height: 22, flex: 1, minWidth: 120 }}>
      <div
        ref={trackRef}
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 4,
          marginTop: -2,
          borderRadius: 2,
          background: "#e2e8e6",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${pctOf(lo)}%`,
            right: `${100 - pctOf(hi)}%`,
            background: "#7ecfbb",
            borderRadius: 2,
          }}
        />
      </div>
      {thumb("lo", lo)}
      {thumb("hi", hi)}
    </div>
  );
};

export const Note = ({ children, tone = "info" }) => {
  const bg = tone === "warn" ? "#fffbf0" : "#f0f5f4";
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#4a5e58" }}>
      {children}
    </div>
  );
};
