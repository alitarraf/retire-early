// ─────────────────────────────────────────────────────────────
//  FundingOrderCard — the ACCOUNT-LOCATION axis, woven in right below
//  the AllocationCard (asset mix). Answers "where should this year's
//  savings go?" with an order COMPUTED FROM THIS PLAN (see
//  analysis/fundingOrder.js): each account ranked by its marginal effect
//  on sustainable spend, so a locked 401k correctly sinks for early
//  retirees. Because the order maximizes safe spend, Apply can only raise
//  (or match) it.
//
//  Signature — "the cascade": priority-ordered account rows (the order IS
//  the finding). Each row carries a capacity bar (dollars routed vs. its
//  IRS cap), the % of the annual savings it takes, and its tax character
//  as color (tax-free green → deferred mint → taxable muted).
//
//  Pure display: `rec` comes memoized from App (it runs drawdown searches).
//  Read-only + one action: Apply re-routes the SAME budget onto the
//  contribution inputs. Retired / zero-savings → shows where money sits.
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { recommendedFunding, mygaAnalysis, currentSplit, fundingContribOverrides, TAX_FREE, TAX_DEFERRED } from "../../analysis/fundingOrder.js";
import { fmt, fmtK } from "../../format.js";

// Tax-character palette — encodes a true fact (which dollars grow tax-free),
// deliberately distinct from the stock/bond/cash greens above it.
const TAX_COLOR = { [TAX_FREE]: "#3d8c78", [TAX_DEFERRED]: "#7ecfbb", taxable: "#9db4ae" };
const FAINT = "#9db4ae";
const INK = "#1a2e28";

const cardStyle = { margin: "14px 14px 0", background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const eyebrowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: FAINT, marginBottom: 8 };
const mono = "'JetBrains Mono', monospace";
const roundMarks = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

// A slim horizontal split bar (the "where it goes now" read).
function SplitBar({ rows }) {
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", gap: 1, marginTop: 6 }}>
      {rows.map((r) => (
        <div key={r.key} title={`${r.label} ${Math.round(r.share * 100)}%`} style={{ width: `${r.share * 100}%`, background: TAX_COLOR[r.tax] ?? FAINT, minWidth: r.share > 0 ? 2 : 0 }} />
      ))}
    </div>
  );
}

// One tier of the cascade: rank, label, capacity bar (routed vs. cap), % + $.
function TierRow({ tier, budget }) {
  const share = budget > 0 ? tier.amount / budget : 0;
  const fill = tier.cap ? Math.min(1, tier.amount / tier.cap) : 1; // uncapped brokerage = full
  const color = TAX_COLOR[tier.tax] ?? FAINT;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "16px 1fr 46px", gap: 10, alignItems: "center", padding: "5px 0" }}>
      <div style={{ fontSize: 13, color: FAINT, fontFamily: mono }}>{roundMarks[tier.step - 1] ?? tier.step}</div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: INK, fontWeight: 600 }}>{tier.label}</span>
          <span style={{ color: FAINT }}>
            {tier.reason}
            <span style={{ fontFamily: mono, marginLeft: 6 }}>
              {fmtK(tier.amount)}{tier.cap ? (tier.filled ? " · full" : ` / ${fmtK(tier.cap)}`) : ""}
            </span>
          </span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: "#eef4f2", overflow: "hidden" }}>
          <div style={{ width: `${fill * 100}%`, height: "100%", background: color, borderRadius: 99 }} />
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: INK, fontFamily: mono }}>{Math.round(share * 100)}%</div>
    </div>
  );
}

function Dot({ color }) {
  return <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: color, marginRight: 5, verticalAlign: "middle" }} />;
}

// Retired / not-saving: nothing to route — show where the money sits today.
function BalanceView({ plan, style, myga }) {
  const bal = [
    { key: "k401", label: "401(k)", tax: TAX_DEFERRED, amount: plan.k401Today ?? 0 },
    { key: "roth", label: "Roth", tax: TAX_FREE, amount: plan.rothTotal ?? 0 },
    { key: "hsa", label: "HSA", tax: TAX_FREE, amount: plan.hsaBalance ?? 0 },
    { key: "brokerage", label: "Brokerage", tax: "taxable", amount: plan.existingBrokerage ?? 0 },
    { key: "cash", label: "Cash", tax: "taxable", amount: plan.cashDeposit ?? 0 },
    { key: "muni", label: "Muni", tax: "taxable", amount: plan.muniBonds ?? 0 },
  ].filter((r) => r.amount > 0);
  const total = bal.reduce((s, r) => s + r.amount, 0);
  const rows = bal.map((r) => ({ ...r, share: total > 0 ? r.amount / total : 0 }));
  return (
    <div style={style}>
      <div style={eyebrowStyle}><span>Where your money sits</span></div>
      <SplitBar rows={rows} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 11, color: "#4a5e58", marginTop: 8 }}>
        {rows.map((r) => <span key={r.key} style={{ fontFamily: mono }}>{r.label} {Math.round(r.share * 100)}%</span>)}
      </div>
      <div style={{ fontSize: 11, color: FAINT, marginTop: 8, lineHeight: 1.5 }}>
        {plan.alreadyRetired
          ? "You're no longer contributing, so there's nothing to route. This is the tax mix of what you hold."
          : "You're not adding to any account yet, so there's nothing to route. This is the tax mix of what you hold."}
      </div>
      {myga && <AnnuitiesHeading />}
      {myga && <MygaBlock myga={myga} />}
    </div>
  );
}

export function FundingOrderCard({ plan, onApply, embedded = false }) {
  // Computed here (not in App) so the drawdown searches only run when this card
  // is actually mounted — it lives inside "Show details", collapsed by default,
  // so a slider drag with details closed costs nothing.
  const rec = useMemo(() => recommendedFunding(plan), [plan]);
  const myga = useMemo(() => mygaAnalysis(plan), [plan]); // pure — shows in any mode
  const style = { ...cardStyle, ...(embedded ? { margin: "14px 0 0" } : null) };
  if (!rec || !rec.available) return <BalanceView plan={plan} style={style} myga={myga} />;

  const now = currentSplit(plan);
  const TAX_OF = { k401: TAX_DEFERRED, roth: TAX_FREE, hsa: TAX_FREE };
  const nowRows = now.rows.map((r) => ({ ...r, tax: TAX_OF[r.key] ?? "taxable" }));
  const gain = rec.impact?.delta ?? 0; // monthly sustainable-spend change
  // Does applying actually change the split? (cheap, no sim) — so we never show a
  // live "Apply" next to falsely-reassuring copy when there's a real move to make.
  const patch = fundingContribOverrides(rec);
  const changed = Object.entries(patch).some(([f, v]) => Math.abs((plan[f] ?? 0) - v) > 0.5);

  return (
    <div style={style}>
      <div style={eyebrowStyle}>
        <span>Funding order</span>
        <span style={{ color: FAINT, letterSpacing: 0 }}>computed from your plan</span>
      </div>

      {now.total > 0 && (
        <>
          <div style={{ fontSize: 12, color: "#4a5e58" }}>
            Where your <strong style={{ color: INK, fontFamily: mono }}>{fmtK(rec.budget)}/yr</strong> goes now:
          </div>
          <SplitBar rows={nowRows} />
        </>
      )}

      <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "14px 0 2px" }}>
        Best order for your plan
      </div>
      {rec.tiers.map((t) => <TierRow key={`${t.key}-${t.step}`} tier={t} budget={rec.budget} />)}

      {/* Color key: which dollars grow tax-free. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 10.5, color: "#4a5e58", marginTop: 10 }}>
        <span><Dot color={TAX_COLOR[TAX_FREE]} />Tax-free</span>
        <span><Dot color={TAX_COLOR[TAX_DEFERRED]} />Tax-deferred</span>
        <span><Dot color={TAX_COLOR.taxable} />Taxable</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        {changed && (
          <button type="button" onClick={onApply} style={{ border: "none", background: INK, color: "#dceee8", fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 9, cursor: "pointer" }}>
            Apply this split
          </button>
        )}
        <div style={{ fontSize: 11.5, color: "#4a5e58", flex: 1, minWidth: 170 }}>
          {!changed ? (
            <>This is already how your {fmtK(rec.budget)}/yr is split — nothing to change.</>
          ) : gain > 60 ? (
            <>Same {fmtK(rec.budget)}/yr → safe spend <strong style={{ color: "#3d8c78", fontFamily: mono }}>+{fmt(gain)}/mo</strong> (to {fmt(rec.impact.after)}/mo).</>
          ) : (
            <>Mostly this just captures your employer match — free money. The model shows little else, since it's locked until 59½.</>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: FAINT, marginTop: 10, lineHeight: 1.5 }}>
        Ranked by how much each account lifts your safe spending, from your plan — not a fixed rule.
        The model scores the drawdown only (it doesn't credit the upfront deduction on pre-tax
        401(k) beyond the match, so that can rank higher for you in a high bracket).
        {rec.tiers.some((t) => t.key === "hsa" && t.needsOpen) && (
          <> An <strong>HSA</strong> is your strongest account here but needs an HSA-eligible (high-deductible) health plan to open.</>
        )}
      </div>

      {rec.kids && rec.kids.tiers.length > 0 && <KidsBlock kids={rec.kids} plan={plan} />}
      {(rec.annuity || myga) && <AnnuitiesHeading />}
      {rec.annuity && <AnnuityBlock annuity={rec.annuity} plan={plan} />}
      {myga && <MygaBlock myga={myga} />}
    </div>
  );
}

function AnnuitiesHeading() {
  return (
    <div style={{ marginTop: 16, fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
      Annuities — should you?
    </div>
  );
}

// Deferred annuity: an honest "should I?" comparison. The model reuses the income-
// stream machinery, so it shows what the app believes — annuities usually lag a
// diversified portfolio; their value is guaranteed income you can't outlive.
function AnnuityBlock({ annuity, plan }) {
  const lags = annuity.delta < 0;
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #dbe6e2" }}>
      <div style={{ fontSize: 11.5, color: INK, fontWeight: 700, marginBottom: 4 }}>
        1 · Lifetime income annuity
      </div>
      <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
        {fmtK(annuity.contrib)}/yr would buy about <strong style={{ color: INK, fontFamily: mono }}>{fmt(annuity.income)}/mo</strong> of
        guaranteed income from age {annuity.startAge}.
      </div>
      <div style={{ display: "flex", gap: 18, margin: "8px 0 6px", flexWrap: "wrap" }}>
        <Stat label="Annuity route" value={`${fmt(annuity.sAnnuity)}/mo`} />
        <Stat label="Invest it instead" value={`${fmt(annuity.sPortfolio)}/mo`} accent />
      </div>
      <div style={{ fontSize: 11.5, color: "#4a5e58", lineHeight: 1.5 }}>
        {lags ? (
          <>In this model, investing the same money supports <strong style={{ color: "#3d8c78", fontFamily: mono }}>{fmt(-annuity.delta)}/mo</strong> more
          safe spending than the annuity — its gains are taxed as ordinary income with no step-up. The annuity's real edge is
          guaranteed income you can't outlive (a longevity hedge), not growth.</>
        ) : (
          <>Here the annuity edges out investing by <strong style={{ color: "#3d8c78", fontFamily: mono }}>{fmt(annuity.delta)}/mo</strong> —
          usually that means a long horizon or heavy reliance on guaranteed income. Still a longevity hedge, not a growth play.</>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: mono, color: accent ? "#3d8c78" : INK }}>{value}</div>
      <div style={{ fontSize: 10, color: FAINT }}>{label}</div>
    </div>
  );
}

// Fixed annuity / MYGA — a "tax-deferred CD". Pure after-tax comparison: the MYGA
// vs. a taxable CD (its real rival) vs. investing (higher but risky).
function MygaBlock({ myga }) {
  const beatsSafe = myga.vsBestSafe > 0;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #dbe6e2" }}>
      <div style={{ fontSize: 11.5, color: INK, fontWeight: 700, marginBottom: 4 }}>
        2 · Fixed annuity (MYGA)
      </div>
      <div style={{ fontSize: 12, color: "#4a5e58", lineHeight: 1.6 }}>
        <strong style={{ color: INK, fontFamily: mono }}>{fmtK(myga.capital)}</strong> at {myga.rate}% for {myga.years} {myga.years === 1 ? "year" : "years"}, cashed out at age {myga.cashOutAge} — after-tax value vs. your other options:
      </div>
      <div style={{ display: "flex", gap: 14, margin: "8px 0 6px", flexWrap: "wrap" }}>
        <Stat label={`MYGA ${myga.rate}%`} value={fmt(myga.mygaNet)} accent />
        <Stat label={`CD ${myga.cdRate}%`} value={fmt(myga.cdNet)} />
        <Stat label={`Munis ${myga.muniRate}%`} value={fmt(myga.muniNet)} />
        <Stat label={`Stocks ${myga.stockRate}%`} value={fmt(myga.eqNet)} />
      </div>
      <div style={{ fontSize: 11.5, color: "#4a5e58", lineHeight: 1.5 }}>
        {beatsSafe ? (
          <>Best safe option: the MYGA nets <strong style={{ color: "#3d8c78", fontFamily: mono }}>{fmt(myga.vsBestSafe)}</strong> more than {myga.bestSafeLabel} here — the tax-deferral edge grows the longer you hold and the lower your bracket at cash-out.</>
        ) : (
          <>Here <strong>{myga.bestSafeLabel}</strong> actually beat the MYGA by <strong style={{ color: "#c97c1a", fontFamily: mono }}>{fmt(-myga.vsBestSafe)}</strong>{myga.penaltyHit ? " — the 10% penalty for cashing out before 59½ outweighs the deferral." : " (tax-free munis or a liquid CD, no surrender lock-up)."}</>
        )}{" "}
        All three are safe; <strong>stocks</strong> could reach <span style={{ fontFamily: mono }}>{fmt(myga.eqNet)}</span> but with market risk and no guarantee.
      </div>
    </div>
  );
}

// Kids' education: a diverted goal shown with its own tax-optimal split + the
// honest retirement cost (safe spend forgone). Fixed order — the engine can't
// rank the child's own accounts.
function KidsBlock({ kids, plan }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #dbe6e2" }}>
      <div style={{ fontSize: 11, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
        Kids' education · {kids.dependents} {kids.dependents === 1 ? "child" : "children"}
      </div>
      <div style={{ fontSize: 12, color: "#4a5e58", marginBottom: 8 }}>
        Your <strong style={{ color: INK, fontFamily: mono }}>{fmtK(kids.contrib)}/yr</strong> for education, in tax-smart order:
      </div>
      {kids.tiers.map((t, i) => {
        const share = kids.contrib > 0 ? t.amount / kids.contrib : 0;
        return (
          <div key={t.key} style={{ display: "grid", gridTemplateColumns: "16px 1fr 46px", gap: 10, alignItems: "center", padding: "4px 0" }}>
            <div style={{ fontSize: 13, color: FAINT, fontFamily: mono }}>{roundMarks[i] ?? i + 1}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: INK, fontWeight: 600 }}>{t.label}</span>
              <span style={{ color: FAINT }}>
                {t.reason}
                <span style={{ fontFamily: mono, marginLeft: 6 }}>{fmtK(t.amount)}{t.cap ? (t.filled ? " · full" : ` / ${fmtK(t.cap)}`) : ""}</span>
              </span>
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: INK, fontFamily: mono }}>{Math.round(share * 100)}%</div>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, color: "#4a5e58", marginTop: 8, lineHeight: 1.5 }}>
        {kids.cost > 60 ? (
          <>This is money the kids get, not you — it costs your own retirement about <strong style={{ color: "#c97c1a", fontFamily: mono }}>−{fmt(kids.cost)}/mo</strong> of safe spending.</>
        ) : (
          <>At this plan it barely dents your own retirement spending.</>
        )}
      </div>
    </div>
  );
}
