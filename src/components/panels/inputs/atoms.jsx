// Shared layout atoms + the expert-mode switch for the input sections.
// Extracted from the old 990-line InputsSidebar.jsx; both the desktop
// accordion and the mobile shell render section bodies built from these.
import { useState, useEffect } from "react";
import { NumInput, Toggle, InfoDot } from "../../ui.jsx";
import { FIELD_HELP } from "../../../constants/fieldHelp.js";

export function Field({ label, hint, help, children }) {
  const h = help ? FIELD_HELP[help] : null;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#7C9A92", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        {h && <InfoDot context={h.context} typical={h.typical} />}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9db4ae", marginBottom: 2 }}>{hint}</div>}
      {children}
    </div>
  );
}

export function Grid2({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
      {children}
    </div>
  );
}

export function Grid3({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 4 }}>
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ borderTop: "1px solid #e2e8e6", margin: "10px 0" }} />;
}

export function SubTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5aada0", marginBottom: 7, marginTop: 2 }}>
      {children}
    </div>
  );
}

// One-click chip that fills a capped contribution to its IRS limit.
export function MaxChip({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Set to the annual IRS limit"
      style={{
        border: "1px solid #b9d2ca",
        background: "#eef5f2",
        color: "#3d8c78",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 10,
        fontWeight: 700,
        padding: "5px 8px",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      Max
    </button>
  );
}

// Small banner that labels a tier of sections.
export function GroupLabel({ children }) {
  return (
    <div style={{ padding: "9px 16px 6px", background: "#fafcfc", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9db4ae" }}>
      {children}
    </div>
  );
}

export function AccSection({ title, summary, isOpen, onToggle, children }) {
  return (
    <div style={{ borderBottom: "1px solid #e2e8e6" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          border: "none",
          cursor: "pointer",
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: isOpen ? "#1a2e28" : "#fafcfc",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: isOpen ? "#fff" : "#1a2e28", flexShrink: 0, minWidth: 70 }}>
          {title}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: isOpen ? "#7ecfbb" : "#9db4ae",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <span style={{ fontSize: 13, color: isOpen ? "#7ecfbb" : "#9db4ae", flexShrink: 0, lineHeight: 1 }}>
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: "14px 16px 16px", background: "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Header that reveals/hides the optional fine-tuning sections.
export function FineTuningHeader({ isOpen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%",
        border: "none",
        borderTop: "1px solid #e2e8e6",
        borderBottom: isOpen ? "1px solid #e2e8e6" : "none",
        cursor: "pointer",
        padding: "11px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#f0f5f4",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5aada0", flexShrink: 0 }}>
        Fine-tuning <span style={{ color: "#9db4ae" }}>(optional)</span>
      </span>
      <span style={{ flex: 1, fontSize: 11, color: "#9db4ae", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isOpen ? "" : "Taxes · Strategy · Healthcare · Estate · Levers · Advanced · Scenario"}
      </span>
      <span style={{ fontSize: 13, color: "#5aada0", flexShrink: 0, lineHeight: 1 }}>{isOpen ? "−" : "+"}</span>
    </button>
  );
}

// ─── Expert mode ─────────────────────────────────────────────
// A single global switch for the deeper layer of inputs (streams, survivor
// scenario, auto tax/Medicare models, account minutiae). Persisted in
// localStorage and broadcast via a window event so every mounted section —
// desktop accordion or mobile sheet — updates together. SSR-safe.

const EXPERT_KEY = "retire-early.expertMode";
const EXPERT_EVENT = "retire-early:expertMode";

function readExpert() {
  try {
    return localStorage.getItem(EXPERT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setExpertMode(v) {
  try {
    localStorage.setItem(EXPERT_KEY, v ? "1" : "0");
    window.dispatchEvent(new Event(EXPERT_EVENT));
  } catch {
    /* SSR / storage unavailable */
  }
}

export function useExpertMode() {
  const [expert, setExpert] = useState(readExpert);
  useEffect(() => {
    const sync = () => setExpert(readExpert());
    window.addEventListener(EXPERT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EXPERT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return expert;
}

export function ExpertToggle() {
  const expert = useExpertMode();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#f0f5f4" }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9db4ae" }}>
        Detail level
      </span>
      <Toggle
        value={expert ? "expert" : "simple"}
        onChange={(v) => setExpertMode(v === "expert")}
        options={[
          { value: "simple", label: "Simple" },
          { value: "expert", label: "Expert" },
        ]}
      />
    </div>
  );
}

// ─── List editors ────────────────────────────────────────────

// Repeater for one-time expenses & windfalls: { age, amount }. Negative
// amounts are windfalls (inheritance, downsizing proceeds) banked into cash.
export function OneTimeExpenses({ value, onChange, defaultAge }) {
  const list = value ?? [];
  const update = (i, patch) => onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = (amount) => onChange([...list, { age: defaultAge, amount }]);
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  return (
    <div>
      {list.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#7C9A92", flexShrink: 0 }}>at age</span>
          <NumInput value={e.age} onChange={(v) => update(i, { age: v })} min={1} max={105} width={48} />
          <NumInput value={e.amount} onChange={(v) => update(i, { amount: v })} prefix="$" step={5000} width={88} />
          {e.amount < 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#3d8c78", flexShrink: 0 }}>windfall</span>
          )}
          <button
            onClick={() => remove(i)}
            style={{ border: "none", background: "#f0f5f4", color: "#c0392b", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1, width: 24, height: 26, flexShrink: 0 }}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        <button
          onClick={() => add(25000)}
          style={{ border: "1px dashed #9db4ae", background: "#fafcfc", color: "#3d8c78", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px" }}
        >
          + Expense
        </button>
        <button
          onClick={() => add(-100000)}
          title="Negative amount — banked into cash when it lands (inheritance, home downsizing)"
          style={{ border: "1px dashed #9db4ae", background: "#fafcfc", color: "#3d8c78", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px" }}
        >
          + Windfall
        </button>
      </div>
    </div>
  );
}

// Minimal styled text input for stream labels (ui.jsx has no text primitive).
function LabelInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: "1px solid #d5e0dc",
        borderRadius: 6,
        padding: "4px 7px",
        fontSize: 11,
        color: "#1a2e28",
        width: 86,
        background: "#fff",
        fontFamily: "inherit",
      }}
    />
  );
}

// Repeater for income streams (pension / annuity / part-time / rental) and
// expense streams (mortgage, loans). kind: "income" | "expense".
export function StreamEditor({ value, onChange, kind, defaultStartAge }) {
  const list = value ?? [];
  const income = kind === "income";
  const update = (i, patch) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...list,
      income
        ? { label: "Pension", monthly: 1000, startAge: defaultStartAge, cola: false, taxType: "ordinary" }
        : { label: "Mortgage", monthly: 1500, startAge: 0, endAge: defaultStartAge + 10, inflate: false },
    ]);
  return (
    <div>
      {list.map((s, i) => (
        <div key={i} style={{ border: "1px solid #e2e8e6", borderRadius: 8, padding: "8px 9px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <LabelInput value={s.label} onChange={(v) => update(i, { label: v })} placeholder={income ? "Pension" : "Mortgage"} />
            <NumInput value={s.monthly} onChange={(v) => update(i, { monthly: v })} prefix="$" step={100} width={78} />
            <span style={{ fontSize: 10, color: "#7C9A92" }}>/mo</span>
            <button
              onClick={() => remove(i)}
              style={{ marginLeft: "auto", border: "none", background: "#f0f5f4", color: "#c0392b", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1, width: 24, height: 26, flexShrink: 0 }}
              title="Remove"
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {income && (
              <>
                <span style={{ fontSize: 10, color: "#7C9A92" }}>from</span>
                <NumInput value={s.startAge ?? 0} onChange={(v) => update(i, { startAge: v })} min={0} max={105} width={48} />
              </>
            )}
            <span style={{ fontSize: 10, color: "#7C9A92" }}>until</span>
            <NumInput
              value={s.endAge ?? 0}
              onChange={(v) => update(i, { endAge: v > 0 ? v : undefined })}
              min={0}
              max={110}
              width={48}
            />
            <span style={{ fontSize: 9, color: "#9db4ae" }}>(0 = for life)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {income ? (
              <>
                <Toggle
                  value={s.taxType === "free" ? "free" : "ordinary"}
                  onChange={(v) => update(i, { taxType: v })}
                  options={[{ value: "ordinary", label: "Taxable" }, { value: "free", label: "Tax-free" }]}
                />
                <Toggle
                  value={s.cola === true ? "cola" : "flat"}
                  onChange={(v) => update(i, { cola: v === "cola" })}
                  options={[{ value: "flat", label: "Fixed $" }, { value: "cola", label: "COLA" }]}
                />
              </>
            ) : (
              <Toggle
                value={s.inflate === true ? "inflate" : "flat"}
                onChange={(v) => update(i, { inflate: v === "inflate" })}
                options={[{ value: "flat", label: "Fixed payment" }, { value: "inflate", label: "Grows with CPI" }]}
              />
            )}
          </div>
        </div>
      ))}
      <button
        onClick={add}
        style={{ border: "1px dashed #9db4ae", background: "#fafcfc", color: "#3d8c78", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "5px 10px", marginTop: 2 }}
      >
        {income ? "+ Add income stream" : "+ Add ending expense"}
      </button>
    </div>
  );
}
