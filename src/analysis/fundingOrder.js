// ─────────────────────────────────────────────────────────────
//  Funding order (PRD_FundingOrder_July2026): the ACCOUNT-LOCATION
//  axis — where a year's savings should go, ranked by what actually
//  helps THIS plan. Distinct from asset allocation (the stock/bond/cash
//  risk mix).
//
//  ENGINE-DERIVED (not a fixed textbook waterfall): each account's
//  priority is its *marginal effect on sustainable spending* — computed
//  by re-running the drawdown with +$BUMP/yr into that account. This is
//  bridge-aware for free: a locked 401k scores ~0 for someone retiring
//  before 59½ (they can't touch it), so it sinks below accessible Roth /
//  brokerage; past 59½ it rises. Because the order maximizes sustainable
//  spend, applying it can only raise (or match) that number — the honest
//  "feeds the retirement numbers" story a fixed order can't promise.
//
//  Two tiers stay RULES, not engine-ranked, because a deterministic
//  drawdown can't price them: the emergency cash buffer (sequence-risk
//  safety) and the employer match (free money granted regardless of the
//  sim). Everything after is ranked by the engine.
//
//  Pure of React; lives in the analysis layer (it calls sustainableSpend
//  + makePlan). `recommendedFunding` returns a priority-ordered tier list
//  + the sustainable-spend payoff; `fundingContribOverrides` maps it back
//  onto the contribution inputs so the caller can apply it.
// ─────────────────────────────────────────────────────────────

import { CONTRIB_LIMITS } from "../constants/brackets.js";
import { makePlan } from "./plan.js";
import { sustainableSpend } from "./sustainableSpend.js";

const EMERGENCY_MONTHS = 6; // cash buffer target (months of spending)
const EMERGENCY_MAX_SHARE = 0.2; // never let the buffer eat >20% of a year's savings
const BUMP = 5000; // marginal-value probe size
const RANK_ITERS = 16; // binary-search iterations for the ranking probes (coarse)
const IMPACT_ITERS = 22; // and for the reported payoff (finer)

// Tax character drives the visual color — a true fact, not decoration.
export const TAX_FREE = "free"; // Roth, HSA — tax-free growth + withdrawal
export const TAX_DEFERRED = "deferred"; // 401k — pre-tax now, ordinary income later
export const TAXABLE = "taxable"; // cash, brokerage — no shelter

/** Age-adjusted IRS caps for the year (catch-ups fold in automatically). */
export function contribCaps(age, { family = true } = {}) {
  const a = Math.floor(age ?? 0);
  const k401Catchup = a >= 60 && a <= 63 ? CONTRIB_LIMITS.k401Catchup60 : a >= 50 ? CONTRIB_LIMITS.k401Catchup50 : 0;
  const iraCatchup = a >= 50 ? CONTRIB_LIMITS.rothIraCatchup50 : 0;
  const hsaBase = family ? CONTRIB_LIMITS.hsaFamily : CONTRIB_LIMITS.hsaIndividual;
  const hsaCatchup = a >= 55 ? CONTRIB_LIMITS.hsaCatchup : 0;
  return {
    k401: CONTRIB_LIMITS.k401 + k401Catchup,
    ira: CONTRIB_LIMITS.rothIra + iraCatchup,
    hsa: hsaBase + hsaCatchup,
  };
}

/** The annual dollars the user saves (own contributions, excluding the employer
 *  match). Mirrors the "You save $X/yr" banner in essentials.jsx. */
export function annualSavingsBudget(plan) {
  return (
    (plan.k401AnnualContrib ?? 0) +
    (plan.rothAnnualContrib ?? 0) +
    (plan.hsaAnnualContrib ?? 0) +
    ((plan.brokerageMonthlyContrib ?? 0) + (plan.cashMonthlyContrib ?? 0) + (plan.muniMonthlyContrib ?? 0)) * 12
  );
}

/**
 * Engine-derived funding order for this year's savings.
 * @returns {{
 *   budget: number,
 *   tiers: Array<{ step, key, field, label, reason, tax, amount, cap, filled, marginal }>,
 *   leftover: number,
 *   available: boolean,
 *   impact: { base: number, after: number, delta: number } | null   // monthly sustainable spend
 * }}
 */
export function recommendedFunding(plan) {
  const budget = Math.round(annualSavingsBudget(plan));
  if (budget <= 0 || plan.alreadyRetired) {
    return { budget: 0, tiers: [], leftover: 0, available: false, impact: null };
  }

  const family = (plan.householdSize ?? 1) >= 2 || plan.hasSpouse;
  const caps = contribCaps(plan.currentAge, { family });
  const hasHsa = (plan.hsaBalance ?? 0) > 0 || (plan.hsaAnnualContrib ?? 0) > 0;
  const matchTarget = Math.max(0, Math.round(((plan.salary ?? 0) * (plan.employerMatchPct ?? 0)) / 100));

  let remaining = budget;
  let k401Used = 0;
  const tiers = [];
  const add = ({ key, field, label, reason, tax, cap, marginal = null }) => {
    if (remaining <= 0) return;
    const room = cap == null ? remaining : Math.max(0, cap - (key === "k401" ? k401Used : 0));
    const amount = Math.min(remaining, room);
    if (amount <= 0) return;
    remaining -= amount;
    if (key === "k401") k401Used += amount;
    tiers.push({
      step: tiers.length + 1,
      key, field, label, reason, tax, marginal,
      amount: Math.round(amount),
      cap: cap == null ? null : Math.round(cap),
      filled: cap != null && amount >= room - 0.5,
    });
  };

  // 1 — Emergency buffer (RULE, not engine-ranked): a deterministic drawdown
  //     can't price sequence-risk, so top cash toward N months of spending,
  //     capped so it never starves the growth tiers.
  const target = EMERGENCY_MONTHS * (plan.monthlyExpense ?? 0);
  const shortfall = Math.max(0, target - (plan.cashDeposit ?? 0));
  if (shortfall > 0) {
    add({ key: "cash", field: "cashMonthlyContrib", label: "Emergency buffer", reason: "safety, not return", tax: TAXABLE, cap: Math.min(shortfall, EMERGENCY_MAX_SHARE * budget) });
  }

  // 2 — Employer match (RULE): free money the sim grants regardless of the
  //     contribution, so the engine scores it ~0 — but it's a 100% instant
  //     return in reality. Grab it (honest that it's locked until 59½).
  if (matchTarget > 0) {
    add({ key: "k401", field: "k401AnnualContrib", label: "Capture 401(k) match", reason: "free money · locked to 59½", tax: TAX_DEFERRED, cap: Math.min(matchTarget, caps.k401) });
  }

  // 3+ — ENGINE-RANKED fill: score each account by the sustainable-spend gain
  //      from +$BUMP/yr, then fill highest-first to its cap. Brokerage is the
  //      uncapped overflow — anything ranked below it gets nothing (which is
  //      exactly why a locked 401k drops out for early retirees).
  const base = sustainableSpend(plan, { iterations: RANK_ITERS });
  const probe = (ov) => sustainableSpend(plan, { iterations: RANK_ITERS, overrides: { [ov]: BUMP } }) - base;
  const cand = [
    hasHsa && { key: "hsa", field: "hsaAnnualContrib", ov: "hsaAnnual", label: "Max HSA", reason: "triple tax-free", tax: TAX_FREE, cap: caps.hsa },
    { key: "roth", field: "rothAnnualContrib", ov: "rothAnnual", label: "Fund Roth IRA", reason: "tax-free growth", tax: TAX_FREE, cap: caps.ira },
    { key: "k401", field: "k401AnnualContrib", ov: "k401Annual", label: "Max 401(k)", reason: "pre-tax, locked to 59½", tax: TAX_DEFERRED, cap: caps.k401 },
    { key: "brokerage", field: "brokerageMonthlyContrib", ov: "brokerageAnnual", label: "Taxable brokerage", reason: "flexible, accessible", tax: TAXABLE, cap: null },
  ].filter(Boolean);
  for (const c of cand) c.marginal = Math.round(probe(c.ov) * 100) / 100;
  // Rank by marginal spend gain; stable tie-break keeps tax-free ahead of taxable.
  cand.sort((a, b) => b.marginal - a.marginal || rankHint(a) - rankHint(b));
  for (const c of cand) add(c);

  const leftover = Math.round(Math.max(0, remaining));

  // Payoff: sustainable spend at the recommended split vs. today's — non-negative
  // by construction for the growth tiers (the rule tiers may trim it slightly).
  const after = makePlan({ ...plan, ...fundingContribOverrides({ tiers }) });
  const afterSpend = sustainableSpend(after, { iterations: IMPACT_ITERS });
  const baseSpend = sustainableSpend(plan, { iterations: IMPACT_ITERS });
  const impact = { base: Math.round(baseSpend), after: Math.round(afterSpend), delta: Math.round(afterSpend - baseSpend) };

  return { budget, tiers, leftover, available: true, impact };
}

// Deterministic tie-break when two accounts score equal marginal value.
function rankHint(c) {
  return { hsa: 0, roth: 1, brokerage: 2, k401: 3 }[c.key] ?? 9;
}

/**
 * Collapse a recommendation's tiers onto the plan's contribution INPUT fields
 * (annual as-is; monthly ÷ 12). Zeroes the fields the router doesn't touch so
 * applying it fully re-routes the budget. Returns a patch for setInputs/makePlan.
 */
export function fundingContribOverrides(rec) {
  const patch = {
    k401AnnualContrib: 0, rothAnnualContrib: 0, hsaAnnualContrib: 0,
    brokerageMonthlyContrib: 0, cashMonthlyContrib: 0, muniMonthlyContrib: 0,
  };
  const monthly = new Set(["cashMonthlyContrib", "muniMonthlyContrib", "brokerageMonthlyContrib"]);
  for (const t of rec.tiers) {
    const add = monthly.has(t.field) ? t.amount / 12 : t.amount;
    patch[t.field] = Math.round((patch[t.field] + add) * 100) / 100;
  }
  return patch;
}

/** Per-account share of the current savings (the "where it goes now" read). */
export function currentSplit(plan) {
  const rows = [
    { key: "k401", label: "401(k)", amount: plan.k401AnnualContrib ?? 0 },
    { key: "roth", label: "Roth IRA", amount: plan.rothAnnualContrib ?? 0 },
    { key: "hsa", label: "HSA", amount: plan.hsaAnnualContrib ?? 0 },
    { key: "brokerage", label: "Brokerage", amount: (plan.brokerageMonthlyContrib ?? 0) * 12 },
    { key: "cash", label: "Cash", amount: (plan.cashMonthlyContrib ?? 0) * 12 },
    { key: "muni", label: "Muni", amount: (plan.muniMonthlyContrib ?? 0) * 12 },
  ].filter((r) => r.amount > 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { total: Math.round(total), rows: rows.map((r) => ({ ...r, amount: Math.round(r.amount), share: total > 0 ? r.amount / total : 0 })) };
}
