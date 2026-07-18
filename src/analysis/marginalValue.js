// Maximize mode: marginal value of an extra $1k/yr into each account, under one
// of two lenses (the card lets the user toggle):
//
//   • "spend"  — extra SUSTAINABLE MONTHLY SPENDING it unlocks (default). The
//     "maximize what I can spend while alive" question. Bridge-aware: a 401k you
//     can't touch until 59½ scores ~0 for an early retiree. Shares its objective +
//     account set with the Funding Order card, so the two agree.
//   • "estate" — extra END-OF-LIFE ESTATE it leaves. The "maximize what I leave
//     behind" question. Rewards tax-free-at-death sleeves differently than spend.
//
// The two lenses can rank accounts differently (e.g. a locked 401k is great for
// estate, useless for early-retirement spending) — that divergence is the point
// of offering both.

import { runMain } from "./plan.js";
import { sustainableSpend } from "./sustainableSpend.js";

const BUMP = 1000; // $1k/yr extra
const ITERS = 22;

const endEstate = (res) => {
  const s = res?.snaps ?? [];
  const last = s[s.length - 1];
  return last ? last.total - (res.estateGainTax ?? 0) : 0;
};

export function marginalValues(plan, { objective = "spend" } = {}) {
  // No future contributions to add once retired / at the retirement date.
  if (plan.alreadyRetired || (plan.yearsToRetire ?? 0) <= 0) return [];
  const hasHsa = (plan.hsaBalance ?? 0) > 0 || (plan.hsaAnnualContrib ?? 0) > 0;
  const cand = [
    { label: "Extra $1k/yr → 401k", key: "k401", ov: "k401Annual" },
    { label: "Extra $1k/yr → Roth IRA", key: "roth", ov: "rothAnnual" },
    hasHsa && { label: "Extra $1k/yr → HSA", key: "hsa", ov: "hsaAnnual" },
    { label: "Extra $1k/yr → Brokerage", key: "brokerage", ov: "brokerageAnnual" },
  ].filter(Boolean);

  // Adding money can't hurt either objective → gains are clamped non-negative.
  const measure =
    objective === "estate"
      ? (() => {
          const base = endEstate(runMain(plan));
          return (ov) => Math.max(0, endEstate(runMain(plan, { [ov]: BUMP })) - base);
        })()
      : (() => {
          const base = sustainableSpend(plan, { iterations: ITERS });
          return (ov) => Math.max(0, sustainableSpend(plan, { iterations: ITERS, overrides: { [ov]: BUMP } }) - base);
        })();

  return cand
    .map(({ label, key, ov }) => ({ label, key, gain: measure(ov) }))
    .sort((a, b) => b.gain - a.gain);
}
