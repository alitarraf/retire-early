// ─────────────────────────────────────────────────────────────
//  The crown jewel: a pure, side-effect-free month-by-month
//  drawdown simulation. Everything else (earliest-age search,
//  sensitivity, marginal value, optimal conversion, sustainable
//  spend) calls this repeatedly with varied inputs.
//
//  Inputs are balances/assumptions AT THE RETIREMENT DATE.
//    - monthlyExpense is ALREADY inflated to the retirement date.
//    - ssBenefit is in TODAY's dollars; the engine inflates it.
//
//  Output: { snaps, depleted, bridgeShortfall }
//    - snaps: yearly { age, roth, brokerage, k401, cd, muni, total }
//    - depleted: age money runs out, or null if it lasts to lifeExpect.
//        Fires ONLY when all funds (incl. the unlocked 401k) are gone.
//    - bridgeShortfall: count of months before 59.5 where accessible
//        funds fell short while the 401k was still locked.
//
//  Draw order (preserve / test):
//    1 Roth contributions  2 Roth earnings (59.5+)  3 Converted Roth
//    (59.5+ AND 5y lock)  4 Munis  5 Brokerage (LTCG on gain)
//    6 401k (59.5+, effective bracket)  7 CD / cash
// ─────────────────────────────────────────────────────────────

import { effectiveFedRate, marginalFedRate } from "./tax.js";
import { DEFAULT_FILING_STATUS } from "../constants/brackets.js";

export function simulate({
  retireAge,
  lifeExpect,
  ssAge,
  monthlyExpense,
  inflationRate,
  stockReturn,
  rothContributions,
  rothEarnings,
  brokerage,
  brokerageBasis,
  brokerageLtcgRate,
  k401,
  cashDeposit,
  muniBonds,
  stateTaxRate,
  ssBenefit,
  ss2Benefit = 0, // spouse SS (combined household pool); 0 = none
  ss2Age = ssAge,
  annualRothConversion = 0,
  filingStatus = DEFAULT_FILING_STATUS,
}) {
  const mr = stockReturn / 100 / 12;
  const mi = inflationRate / 100 / 12;

  let rc = rothContributions; // Roth contributions
  let re = rothEarnings; // Roth earnings
  let rv = 0; // converted Roth that has fully unlocked
  let bk = brokerage;
  let bb = brokerageBasis;
  let k = k401;
  let cd = cashDeposit;
  let mn = muniBonds;
  let spend = monthlyExpense;
  let depleted = null;
  let bridgeShortfall = 0;

  const tranches = []; // converted-Roth tranches awaiting their 5y unlock
  const scheduled = new Set();
  const snaps = [];
  const totalMonths = (lifeExpect - retireAge) * 12;

  for (let m = 0; m < totalMonths; m++) {
    const age = retireAge + m / 12;
    const yr = Math.floor(age - retireAge);

    // Roth conversion ladder — once per bridge year.
    if (annualRothConversion > 0 && age < 59.5 && !scheduled.has(yr) && m % 12 === 0) {
      scheduled.add(yr);
      const conv = Math.min(annualRothConversion, k);
      if (conv > 0) {
        k -= conv;
        const tax = conv * (marginalFedRate(conv, filingStatus) + stateTaxRate / 100);
        cd = Math.max(0, cd - Math.min(tax, cd));
        tranches.push({ avail: age + 5, amt: conv });
      }
    }

    // Monthly growth on every bucket.
    rc = Math.max(0, rc) * (1 + mr);
    re = Math.max(0, re) * (1 + mr);
    rv = Math.max(0, rv) * (1 + mr);
    bk = Math.max(0, bk) * (1 + mr);
    k = Math.max(0, k) * (1 + mr);
    cd = Math.max(0, cd) * (1 + mr);
    mn = Math.max(0, mn) * (1 + mr);
    for (const t of tranches) if (t.amt > 0) t.amt *= 1 + mr;
    // Unlock tranches that have cleared both the 5y lock and 59.5.
    for (const t of tranches) if (age >= t.avail && t.amt > 0) { rv += t.amt; t.amt = 0; }

    // Social Security, inflated; up to 85% of the household total taxable.
    const ss1 = age >= ssAge ? ssBenefit * Math.pow(1 + mi, m) : 0;
    const ss2 = age >= ss2Age ? ss2Benefit * Math.pow(1 + mi, m) : 0;
    const grossSS = ss1 + ss2;
    const ss = grossSS > 0
      ? grossSS * (1 - 0.85 * (effectiveFedRate(grossSS * 12, filingStatus) + stateTaxRate / 100))
      : 0;
    let need = Math.max(0, spend - ss);

    // ── Draw order ──
    if (need > 0 && rc > 0) { const d = Math.min(need, rc); rc -= d; need -= d; }
    if (need > 0 && age >= 59.5 && re > 0) { const d = Math.min(need, re); re -= d; need -= d; }
    if (need > 0 && age >= 59.5 && rv > 0) { const d = Math.min(need, rv); rv -= d; need -= d; }
    if (need > 0 && mn > 0) { const d = Math.min(need, mn); mn -= d; need -= d; }
    if (need > 0 && bk > 0) {
      const gainFrac = Math.max(0, (bk - bb) / bk);
      const effTax = gainFrac * brokerageLtcgRate / 100;
      const gross = need / Math.max(0.01, 1 - effTax);
      const draw = Math.min(gross, bk);
      bb = Math.max(0, bb - draw * (bb / Math.max(bk, 1)));
      bk -= draw;
      need -= draw * (1 - effTax);
    }
    if (need > 0 && age >= 59.5 && k > 0) {
      const eff = Math.min(0.9, effectiveFedRate(need * 12, filingStatus) + stateTaxRate / 100);
      const draw = Math.min(need / Math.max(0.01, 1 - eff), k);
      k -= draw;
      need -= draw * (1 - eff);
    }
    if (need > 0 && cd > 0) { const d = Math.min(need, cd); cd -= d; need -= d; }

    // Depletion / bridge-shortfall accounting.
    const lockedK = age < 59.5 ? k : 0;
    const accessible = rc + re + rv + mn + bk + cd + (age >= 59.5 ? k : 0);
    if (need > 0.5 && accessible < 0.5 && lockedK < 0.5 && !depleted) depleted = age;
    if (need > 0.5 && age < 59.5 && lockedK > 0.5) bridgeShortfall++;

    spend *= 1 + mi;

    // Yearly snapshot.
    if (m % 12 === 11 || m === totalMonths - 1) {
      const pendingConv = tranches.reduce((s, t) => s + t.amt, 0);
      snaps.push({
        age: Math.round(retireAge + m / 12),
        roth: Math.max(0, rc + re + rv + pendingConv),
        brokerage: Math.max(0, bk),
        k401: Math.max(0, k),
        cd: Math.max(0, cd),
        muni: Math.max(0, mn),
        total: Math.max(0, rc + re + rv + pendingConv + bk + k + cd + mn),
      });
    }
  }

  return { snaps, depleted, bridgeShortfall };
}
