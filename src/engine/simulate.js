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
import { rmdFactor } from "./rmd.js";
import { DEFAULT_FILING_STATUS, ACA } from "../constants/brackets.js";

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
  rmdAge = 0, // 0 = disabled; set to 73 or 75 (SECURE 2.0) to enforce RMDs
  monthlyAcaFullPremium = 0, // full unsubsidized ACA premium; 0 = not tracked
  householdSize = 2, // for FPL cliff calculation; affects ACA threshold
  rule55 = false, // unlock 401k penalty-free from retireAge (must have left employer at ≥55)
  annualSepp = 0, // annual 72(t) SEPP amount; 0 = disabled; period ends at max(retireAge+5, 59.5)
  returnSeries = null, // optional per-year returns array (percent); overrides stockReturn when set
  guardrailUpper = 0, // withdrawal rate above which spending is cut 10% (e.g. 0.055); 0 = off
  guardrailLower = 0, // withdrawal rate below which spending is raised 10% (e.g. 0.035); 0 = off
  hsaBalance = 0,     // HSA at retirement; grows at stockReturn; draws are tax-free (medical)
  monthlyIrmaaSurcharge = 0, // IRMAA Medicare surcharge added to expenses at age 65+
  stateSsExemptRate = 0,     // fraction of SS income exempt from state tax (0=none, 1=full)
}) {
  let mr = stockReturn / 100 / 12; // updated per year when returnSeries is provided
  const mi = inflationRate / 100 / 12;
  // 72(t): SEPP must continue for 5 years OR until 59.5, whichever is LONGER.
  const seppEnd = annualSepp > 0 ? Math.max(retireAge + 5, 59.5) : Infinity;

  let rc = rothContributions; // Roth contributions
  let re = rothEarnings; // Roth earnings
  let rv = 0; // converted Roth that has fully unlocked
  let bk = brokerage;
  let bb = brokerageBasis;
  let k = k401;
  let cd = cashDeposit;
  let mn = muniBonds;
  let hsa = hsaBalance; // HSA: grows at mr, draws are tax-free
  let spend = monthlyExpense;
  let depleted = null;
  let bridgeShortfall = 0;

  let priorYearEndK = k;   // 401k balance at end of prior year; used for RMD calculation
  let rmdForThisYear = 0;  // gross annual RMD target set at each year start
  let rmdWithdrawnThisYear = 0; // gross 401k drawn so far this calendar year

  // ACA MAGI tracking — trailing model: prior-year MAGI determines current-year premium status.
  // MAGI sources: traditional 401k draws, Roth conversions, brokerage gains, 85% of SS.
  // Roth draws and muni income do NOT count. Applies to ages 55–64 (pre-Medicare) only.
  let magiYearAccum = 0;     // running MAGI total for the current calendar year
  let priorYearMagi = 0;     // MAGI from the prior year; used at year start to set premium status
  let acaPremiumActive = false; // true when prior-year MAGI crossed the FPL cliff

  const tranches = []; // converted-Roth tranches awaiting their 5y unlock
  const scheduled = new Set();
  const snaps = [];
  const totalMonths = (lifeExpect - retireAge) * 12;

  for (let m = 0; m < totalMonths; m++) {
    const age = retireAge + m / 12;
    const yr = Math.floor(age - retireAge);

    // Year-start resets and setup.
    if (m % 12 === 0) {
      // Update monthly return rate for this year (Monte Carlo: per-year stochastic returns).
      if (returnSeries) mr = (returnSeries[yr] ?? stockReturn) / 100 / 12;

      // RMD: reset annual tracker and set this year's minimum.
      rmdWithdrawnThisYear = 0;
      rmdForThisYear = (rmdAge > 0 && age >= rmdAge && priorYearEndK > 0)
        ? priorYearEndK / rmdFactor(Math.floor(age))
        : 0;

      // ACA: determine premium status from prior year's MAGI.
      if (monthlyAcaFullPremium > 0) {
        const fpl = ACA.fplBase + Math.max(0, householdSize - 1) * ACA.fplPerAdditionalPerson;
        acaPremiumActive = priorYearMagi >= fpl * ACA.cliffMultiple;
        magiYearAccum = 0;
      }
    }

    // Roth conversion ladder — once per bridge year.
    if (annualRothConversion > 0 && age < 59.5 && !scheduled.has(yr) && m % 12 === 0) {
      scheduled.add(yr);
      const conv = Math.min(annualRothConversion, k);
      if (conv > 0) {
        k -= conv;
        const tax = conv * (marginalFedRate(conv, filingStatus) + stateTaxRate / 100);
        cd = Math.max(0, cd - Math.min(tax, cd));
        tranches.push({ avail: age + 5, amt: conv });
        // Roth conversions are ordinary income → count toward ACA MAGI.
        if (monthlyAcaFullPremium > 0) magiYearAccum += conv;
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
    hsa = Math.max(0, hsa) * (1 + mr);
    for (const t of tranches) if (t.amt > 0) t.amt *= 1 + mr;
    // Unlock tranches that have cleared both the 5y lock and 59.5.
    for (const t of tranches) if (age >= t.avail && t.amt > 0) { rv += t.amt; t.amt = 0; }

    // Social Security, inflated; up to 85% of the household total taxable.
    const ss1 = age >= ssAge ? ssBenefit * Math.pow(1 + mi, m) : 0;
    const ss2 = age >= ss2Age ? ss2Benefit * Math.pow(1 + mi, m) : 0;
    const grossSS = ss1 + ss2;
    const effectiveSsStateTaxRate = stateTaxRate * (1 - stateSsExemptRate);
    const ss = grossSS > 0
      ? grossSS * (1 - 0.85 * (effectiveFedRate(grossSS * 12, filingStatus) + effectiveSsStateTaxRate / 100))
      : 0;
    // SS is taxable income: up to 85% counts toward ACA MAGI.
    if (monthlyAcaFullPremium > 0 && grossSS > 0) magiYearAccum += 0.85 * grossSS;

    let need = Math.max(0, spend - ss);
    // ACA healthcare premium: full price when prior-year MAGI crossed the FPL cliff.
    // Applies pre-Medicare only (age < 65). Simplified: below cliff = fully subsidized.
    if (monthlyAcaFullPremium > 0 && age < 65 && acaPremiumActive) need += monthlyAcaFullPremium;
    // IRMAA Medicare surcharge: added to expenses at age 65+ when income exceeds thresholds.
    if (monthlyIrmaaSurcharge > 0 && age >= 65) need += monthlyIrmaaSurcharge;

    // 72(t) SEPP: forced monthly 401k draw during the SEPP period (before normal draw order).
    // After-tax income reduces need; any excess is banked in CD for later use.
    if (annualSepp > 0 && age < seppEnd && k > 0) {
      const seppGross = Math.min(annualSepp / 12, k);
      const seppEff = Math.min(0.9, effectiveFedRate(seppGross * 12, filingStatus) + stateTaxRate / 100);
      k -= seppGross;
      const seppNet = seppGross * (1 - seppEff);
      const applied = Math.min(need, seppNet);
      need -= applied;
      cd += seppNet - applied; // excess SEPP income → CD
      if (monthlyAcaFullPremium > 0) magiYearAccum += seppGross;
    }

    // ── Draw order ──
    if (need > 0 && rc > 0) { const d = Math.min(need, rc); rc -= d; need -= d; }
    if (need > 0 && age >= 59.5 && re > 0) { const d = Math.min(need, re); re -= d; need -= d; }
    if (need > 0 && age >= 59.5 && rv > 0) { const d = Math.min(need, rv); rv -= d; need -= d; }
    if (need > 0 && mn > 0) { const d = Math.min(need, mn); mn -= d; need -= d; }
    // HSA: tax-free draw (treating all spend as qualified medical, the common retirement assumption).
    if (need > 0 && hsa > 0) { const d = Math.min(need, hsa); hsa -= d; need -= d; }
    if (need > 0 && bk > 0) {
      const gainFrac = Math.max(0, (bk - bb) / bk);
      const effTax = gainFrac * brokerageLtcgRate / 100;
      const gross = need / Math.max(0.01, 1 - effTax);
      const draw = Math.min(gross, bk);
      bb = Math.max(0, bb - draw * (bb / Math.max(bk, 1)));
      bk -= draw;
      need -= draw * (1 - effTax);
      // Only the gain portion of a brokerage draw counts toward ACA MAGI.
      if (monthlyAcaFullPremium > 0) magiYearAccum += draw * gainFrac;
    }
    // Rule of 55 unlocks the 401k from retireAge; otherwise locked until 59.5.
    const k401Accessible = age >= 59.5 || rule55;
    if (need > 0 && k401Accessible && k > 0) {
      const eff = Math.min(0.9, effectiveFedRate(need * 12, filingStatus) + stateTaxRate / 100);
      const draw = Math.min(need / Math.max(0.01, 1 - eff), k);
      k -= draw;
      need -= draw * (1 - eff);
      rmdWithdrawnThisYear += draw;
      // Traditional 401k withdrawals are ordinary income → count toward ACA MAGI.
      if (monthlyAcaFullPremium > 0) magiYearAccum += draw;
    }
    if (need > 0 && cd > 0) { const d = Math.min(need, cd); cd -= d; need -= d; }

    // Depletion / bridge-shortfall accounting.
    const lockedK = k401Accessible ? 0 : k;
    const accessible = rc + re + rv + mn + hsa + bk + cd + (k401Accessible ? k : 0);
    if (need > 0.5 && accessible < 0.5 && lockedK < 0.5 && !depleted) depleted = age;
    if (need > 0.5 && age < 59.5 && lockedK > 0.5) bridgeShortfall++;

    spend *= 1 + mi;

    // At year end: force any remaining RMD shortfall from 401k → brokerage (after tax).
    // This must run before the snapshot so the snapshot reflects the forced draw.
    if (m % 12 === 11 && rmdForThisYear > rmdWithdrawnThisYear && k > 0) {
      const shortfall = Math.min(rmdForThisYear - rmdWithdrawnThisYear, k);
      const eff = Math.min(0.9, effectiveFedRate(shortfall, filingStatus) + stateTaxRate / 100);
      const net = shortfall * (1 - eff);
      k -= shortfall;
      bk += net;
      bb += net; // basis = value added (no embedded gain on new cash)
    }
    // Guyton-Klinger guardrails: annual spending adjustment based on withdrawal rate.
    // WR = net annual portfolio draw (spending minus guaranteed income) / portfolio total.
    // Using gross spending would inflate WR for plans with significant SS income.
    if (m % 12 === 11 && (guardrailUpper > 0 || guardrailLower > 0)) {
      const pendingGuard = tranches.reduce((s, t) => s + t.amt, 0);
      const total = rc + re + rv + pendingGuard + bk + hsa + k + cd + mn;
      if (total > 0) {
        const netDraw = Math.max(0, spend - grossSS) * 12; // annualized portfolio-only draw
        const wr = netDraw / total;
        if (guardrailUpper > 0 && wr > guardrailUpper) spend *= 0.9;
        else if (guardrailLower > 0 && wr < guardrailLower) spend *= 1.1;
      }
    }

    // Save year-end balances for next year's calculations.
    if (m % 12 === 11) {
      priorYearEndK = k;
      if (monthlyAcaFullPremium > 0) priorYearMagi = magiYearAccum;
    }

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
        hsa: Math.max(0, hsa),
        total: Math.max(0, rc + re + rv + pendingConv + bk + hsa + k + cd + mn),
      });
    }
  }

  return { snaps, depleted, bridgeShortfall };
}
