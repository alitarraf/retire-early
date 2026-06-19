// "Get advice" tab. Helps the user connect with an advice-only / flat-fee
// fiduciary CFP for a second opinion — the persona who doesn't want a 0.5–1%
// AUM advisor — and export a summary to bring to that planner.
import { buildPlanSummary } from "../../analysis/planSummary.js";
import { fmt, fmtK } from "../../format.js";

const NETWORKS = [
  {
    name: "NAPFA",
    url: "https://www.napfa.org/find-an-advisor",
    tag: "Fee-only fiduciary directory",
    desc: "Every advisor is a CFP®, fee-only, and signs an annual fiduciary oath. The strictest vetting; search by location and specialty.",
  },
  {
    name: "XY Planning Network",
    url: "https://www.xyplanningnetwork.com/find-an-advisor",
    tag: "Flat monthly / virtual",
    desc: "Fee-only planners who work on a flat monthly or annual retainer — no assets-under-management cut. Most work virtually.",
  },
  {
    name: "Garrett Planning Network",
    url: "https://www.garrettplanningnetwork.com",
    tag: "Hourly / as-needed",
    desc: "Fee-only planners who charge by the hour, so you can buy a one-time plan review or a periodic check-in rather than ongoing management.",
  },
  {
    name: "Wealthramp",
    url: "https://www.wealthramp.com",
    tag: "Vetted matching service",
    desc: "Free matching service that screens fee-only fiduciaries (drawing on NAPFA, XYPN and Garrett) and introduces a short list that fits your needs.",
  },
];

function download(filename, text) {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AdvicePanel({ inputs, plan, result, earliest, sustainable, mcResult, totalAtRetirement }) {
  const currentTotal =
    (inputs.k401Today ?? 0) + (inputs.rothTotal ?? 0) + (inputs.cashDeposit ?? 0) +
    (inputs.muniBonds ?? 0) + (inputs.existingBrokerage ?? 0) + (inputs.hsaBalance ?? 0);

  const onExport = () => {
    const text = buildPlanSummary(inputs, plan, result, { earliest, sustainable, mcResult, totalAtRetirement });
    download("retirement-plan-summary.md", text);
  };
  const onPrint = () => { if (typeof window !== "undefined") window.print(); };

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: "8px 4px 60px" }}>

      {/* ── Header ── */}
      <div style={{ background: "#1a2e28", borderRadius: 14, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#7ecfbb", textTransform: "uppercase", marginBottom: 8 }}>
          Get a second opinion
        </div>
        <p style={{ fontSize: 14, color: "#c8e6e0", lineHeight: 1.7, margin: 0 }}>
          You don't have to hand over a percentage of your savings every year to get professional
          guidance. <strong style={{ color: "#fff" }}>Advice-only and flat-fee fiduciary planners</strong> charge
          a fixed price — hourly, a one-time plan, or a flat annual retainer — for the same expertise,
          and they're legally bound to act in your interest. Use this planner to do the analysis, then
          take it to a fiduciary to confirm.
        </p>
      </div>

      {/* ── Fee illustration (static) ── */}
      {currentTotal > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8e6", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9db4ae", marginBottom: 8 }}>
            What an AUM fee would cost you
          </div>
          <p style={{ fontSize: 13, color: "#4a5e58", lineHeight: 1.6, margin: "0 0 8px" }}>
            On your <strong>{fmtK(currentTotal)}</strong> portfolio, a typical assets-under-management
            advisor charging a yearly percentage would bill roughly:
          </p>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#c97c1a" }}>{fmt(Math.round(currentTotal * 0.005))}/yr</div>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>at 0.5% AUM</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#c0392b" }}>{fmt(Math.round(currentTotal * 0.01))}/yr</div>
              <div style={{ fontSize: 10, color: "#9db4ae" }}>at 1% AUM</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#9db4ae", lineHeight: 1.6, marginTop: 10 }}>
            A flat-fee or hourly fiduciary typically charges a few thousand dollars for a full plan —
            often a fraction of an AUM fee, especially on a larger portfolio. Illustrative only.
          </div>
        </div>
      )}

      {/* ── Networks ── */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e28", marginBottom: 12 }}>
        Where to find a fee-only fiduciary
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {NETWORKS.map((n) => (
          <a
            key={n.name}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", textDecoration: "none", background: "#fff", border: "1px solid #e2e8e6", borderRadius: 12, padding: "16px 18px" }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2e28", marginBottom: 2 }}>{n.name} ↗</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#3d8c78", marginBottom: 8 }}>{n.tag}</div>
            <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>{n.desc}</div>
          </a>
        ))}
      </div>

      {/* ── Export ── */}
      <div style={{ background: "#f0faf6", border: "1px solid #a3d9c7", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e28", marginBottom: 4 }}>
          Take your plan with you
        </div>
        <p style={{ fontSize: 13, color: "#4a5e58", lineHeight: 1.6, margin: "0 0 14px" }}>
          Export a summary of your inputs, results, and key questions to bring to a planner — so your
          first meeting starts from your real numbers, not a blank page.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onExport}
            style={{ border: "none", borderRadius: 10, cursor: "pointer", background: "#1a2e28", color: "#7ecfbb", fontSize: 13, fontWeight: 700, padding: "11px 18px" }}
          >
            ↓ Export plan summary
          </button>
          <button
            onClick={onPrint}
            style={{ border: "1px solid #a3d9c7", borderRadius: 10, cursor: "pointer", background: "#fff", color: "#2a6e56", fontSize: 13, fontWeight: 700, padding: "11px 18px" }}
          >
            ⎙ Print / Save as PDF
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#9db4ae", lineHeight: 1.7 }}>
        This planner is an educational tool, not financial advice, and is not affiliated with any of
        the networks above. Always confirm an advisor's fiduciary status and fee structure before
        engaging. Verify Social Security at ssa.gov and taxes with a CPA.
      </div>
    </div>
  );
}
