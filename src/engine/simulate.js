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
//  Output: { snaps, depleted, bridgeShortfall, estateGainTax }
//    - snaps: yearly { age, roth, brokerage, k401, cd, muni, total }
//    - depleted: age money runs out, or null if it lasts to lifeExpect.
//        Fires ONLY when all funds (incl. the unlocked 401k) are gone.
//    - bridgeShortfall: count of months before 59.5 where accessible
//        funds fell short while the 401k was still locked.
//    - estateGainTax: 0 when assumeStepUpBasis=true; otherwise the LTCG
//        tax on the brokerage embedded gain at end of simulation.
//
//  Draw order (preserve / test):
//    1 Roth contributions  2 Roth earnings (59.5+)  3 Converted Roth
//    (5y elapsed, ANY age — principal only; tranche growth folds into
//    Roth earnings)  4 Munis  5 Brokerage (LTCG on gain)
//    6 401k (59.5+, effective bracket)  7 CD / cash
// ─────────────────────────────────────────────────────────────

import { federalTax, taxableSsAmount, ltcgRateAt, niitApplies } from "./tax.js";
import { rmdFactor } from "./rmd.js";
import { DEFAULT_FILING_STATUS, ACA, acaApplicablePct, STD_DEDUCTION } from "../constants/brackets.js";

// Gross-up solver for a tax-deferred (401k) withdrawal: find the monthly PRE-tax draw
// whose after-tax value equals `needMonthly`, where the effective rate is the marginal
// federal rate over [base, base + annualized draw] plus the flat state rate.
//
// net(gross) is monotonically increasing in gross (marginal tax < 100%), so a bisection
// converges robustly. The previous 3-iteration fixed point could stall when the draw
// straddled a bracket boundary (the marginal rate jumps mid-interval); bisection does not.
export function grossUpMonthly(needMonthly, base, filingStatus, stateRateFrac, indexFactor = 1) {
  if (needMonthly <= 0) return 0;
  const netOf = (g) => {
    const d = g * 12;
    const fedRate = d > 0
      ? (federalTax(base + d, filingStatus, indexFactor) - federalTax(base, filingStatus, indexFactor)) / d
      : 0;
    return g * (1 - fedRate - stateRateFrac);
  };
  let lo = needMonthly; // net ≤ gross, so the answer is at least the net needed
  let hi = needMonthly / Math.max(0.01, 1 - 0.37 - stateRateFrac) + 1; // top-bracket upper bound
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (netOf(mid) < needMonthly) lo = mid;
    else hi = mid;
  }
  return hi; // bias to the high side so we never under-withdraw to cover the need
}

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
  monthlyAcaFullPremium = 0, // benchmark silver-plan premium (unsubsidized); 0 = not tracked
  householdSize = 2, // for FPL cliff calculation; affects ACA threshold
  rule55 = false, // unlock 401k penalty-free from retireAge (must have left employer at ≥55)
  annualSepp = 0, // annual 72(t) SEPP amount; 0 = disabled; period ends at max(retireAge+5, 59.5)
  returnSeries = null, // optional per-year returns array (percent); overrides stockReturn when set
  guardrailUpper = 0, // withdrawal rate above which spending is cut 10% (e.g. 0.055); 0 = off
  guardrailLower = 0, // withdrawal rate below which spending is raised 10% (e.g. 0.035); 0 = off
  hsaBalance = 0,     // HSA at retirement; grows at stockReturn; draws are tax-free (medical)
  monthlyIrmaaSurcharge = 0, // IRMAA Medicare surcharge added to expenses at age 65+
  stateSsExemptRate = 0,     // fraction of SS income exempt from state tax (0=none, 1=full)
  assumeStepUpBasis = true,  // heirs inherit brokerage at market value; false = gains taxed at ltcgRate
  oneTimeExpenses = [],      // [{ age, amount }] lump expenses in RETIRE-DATE $; inflated per month like spend
  goGoMult = 1,              // spending multiplier, retireAge → slowGoAge (active/"go-go" years)
  slowGoMult = 1,            // spending multiplier, slowGoAge → noGoAge (slower years)
  noGoMult = 1,              // spending multiplier, noGoAge+ (low-activity years)
  slowGoAge = Infinity,      // age the slow-go phase begins
  noGoAge = Infinity,        // age the no-go phase begins
  conversionCeiling = 0,     // bracket-fill: convert up to this TAXABLE-income top each year; 0 = use fixed amount
  conversionEndAge = 59.5,   // conversions allowed while age < this (59.5 = bridge only; raise for RMD-prep years)
  taxIndexYears = null,      // years between TAX_YEAR and the retirement date; brackets/deduction/FPL
                             // inflation-index from that offset and keep indexing through retirement.
                             // null = legacy behavior: frozen at TAX_YEAR figures for the whole sim.
  cashReturn = null,         // annual % yield on CD/cash in retirement; null = grow at stockReturn (legacy)
  muniYield = null,          // annual % yield on munis in retirement; null = grow at stockReturn (legacy)
  autoLtcg = false,          // true: derive the brokerage gain rate each year from real LTCG brackets
                             // (stacked on trailing ordinary income) + state + NIIT, instead of the
                             // flat user-picked brokerageLtcgRate
}) {
  let mr = stockReturn / 100 / 12; // updated per year when returnSeries is provided
  const cdMr = cashReturn == null ? null : cashReturn / 100 / 12;
  const mnMr = muniYield == null ? null : muniYield / 100 / 12;
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

  // Ordinary-income tracking — trailing-year model for marginal-rate calculations.
  // Captures gross 401k draws + SEPP + Roth conversions (not SS, not LTCG gains).
  let priorYearOrdIncome = 0; // prior year total ordinary income; feeds next year's rate base
  let yearOrdAccum = 0;       // current year accumulator; saved to priorYearOrdIncome at year end
  let taxableSsFrac = 0;      // fraction of gross SS that is federally taxable (set at year start)
  let drawBase = 0;           // annual income base for marginal-delta rate calc (set at year start)
  let taxIdx = 1;             // this year's bracket/deduction/FPL inflation index (set at year start)

  // ACA MAGI tracking — trailing model: prior-year MAGI determines current-year premium status.
  // MAGI sources: traditional 401k draws, Roth conversions, brokerage gains, actual taxable SS.
  // Roth draws and muni income do NOT count. Applies to ages 55–64 (pre-Medicare) only.
  let magiYearAccum = 0;     // running MAGI total for the current calendar year
  let priorYearMagi = 0;     // MAGI from the prior year; used at year start to set premium status
  let acaMonthlyDue = 0; // this year's monthly ACA premium after the credit (set at year start)
  // MAGI is tracked whenever any consumer needs it (ACA premium status, NIIT).
  const trackMagi = monthlyAcaFullPremium > 0 || autoLtcg;
  // Effective % rate applied to the gain portion of brokerage draws this year.
  // autoLtcg recomputes it each year start; otherwise it's the flat input.
  let ltcgRateNow = brokerageLtcgRate;

  const tranches = []; // converted-Roth tranches awaiting their 5y unlock
  const scheduled = new Set();
  const conversions = []; // per-year Roth conversions actually performed: { age, amount }
  const firedOneTime = new Set(); // one-time expenses already applied (by index)
  const snaps = [];
  // Phase-based spending: multiply the base monthly spend by the phase factor for the current age.
  const phaseMult = (a) => (a >= noGoAge ? noGoMult : a >= slowGoAge ? slowGoMult : goGoMult);
  // Transparency capture — first SS-active taxable fraction and first 401k effective draw rate.
  const taxSummary = { ssTaxableFrac: null, k401EffRate: null };
  const totalMonths = (lifeExpect - retireAge) * 12;

  for (let m = 0; m < totalMonths; m++) {
    const age = retireAge + m / 12;
    const yr = Math.floor(age - retireAge);

    // Year-start resets and setup.
    if (m % 12 === 0) {
      // Update monthly return rate for this year (Monte Carlo: per-year stochastic returns).
      if (returnSeries) mr = (returnSeries[yr] ?? stockReturn) / 100 / 12;

      // Tax-code inflation index for this year: brackets, standard deduction, and FPL
      // are adjusted annually by the IRS/HHS. SS provisional thresholds stay frozen (law).
      taxIdx = taxIndexYears == null ? 1 : Math.pow(1 + inflationRate / 100, taxIndexYears + yr);

      // RMD: reset annual tracker and set this year's minimum.
      rmdWithdrawnThisYear = 0;
      rmdForThisYear = (rmdAge > 0 && age >= rmdAge && priorYearEndK > 0)
        ? priorYearEndK / rmdFactor(Math.floor(age))
        : 0;

      // ACA sliding scale: prior-year MAGI sets this year's premium.
      // monthlyAcaFullPremium is the BENCHMARK SILVER premium; below 400% FPL
      // the household pays min(full, applicablePct × MAGI); at/above the
      // cliff there is no credit and the full premium is due.
      if (monthlyAcaFullPremium > 0) {
        const fpl = (ACA.fplBase + Math.max(0, householdSize - 1) * ACA.fplPerAdditionalPerson) * taxIdx;
        const pct = acaApplicablePct(priorYearMagi / fpl);
        acaMonthlyDue = pct == null
          ? monthlyAcaFullPremium
          : Math.min(monthlyAcaFullPremium, (priorYearMagi * pct) / 12);
      }
      if (trackMagi) magiYearAccum = 0;

      // SS provisional income — compute taxable fraction for this year using prior-year
      // ordinary income as the "other income" base (trailing-year model, same as ACA).
      const ss1Est = age >= ssAge ? ssBenefit * Math.pow(1 + mi, m) : 0;
      const ss2Est = age >= ss2Age ? ss2Benefit * Math.pow(1 + mi, m) : 0;
      const annualSsEst = (ss1Est + ss2Est) * 12;
      const taxableSsAnnualEst = taxableSsAmount(annualSsEst, priorYearOrdIncome, filingStatus);
      taxableSsFrac = annualSsEst > 0 ? taxableSsAnnualEst / annualSsEst : 0;
      // drawBase: taxable SS is the only income that stacks BELOW 401k draws.
      // Prior-year 401k income is NOT added here — it is the same income category and
      // double-counting it would inflate the marginal rate on year-2+ draws.
      // priorYearOrdIncome is still used for SS provisional income above (taxableSsAnnualEst).
      drawBase = taxableSsAnnualEst;
      yearOrdAccum = 0;

      // autoLtcg: this year's effective rate on the gain portion of brokerage
      // draws. Federal rate = LTCG brackets with gains stacked on trailing
      // ordinary income (prior-year draws/conversions + this year's taxable
      // SS), + flat state rate, + NIIT when trailing MAGI crosses the
      // (non-indexed) threshold. Trailing-year model, same as SS/ACA.
      if (autoLtcg) {
        const fedLtcg = ltcgRateAt(priorYearOrdIncome + taxableSsAnnualEst, filingStatus, taxIdx) * 100;
        const niit = niitApplies(priorYearMagi, filingStatus) ? 3.8 : 0;
        ltcgRateNow = fedLtcg + stateTaxRate + niit;
      }
      // Transparency: record the SS taxable fraction the first year SS is active.
      if (annualSsEst > 0 && taxSummary.ssTaxableFrac === null) taxSummary.ssTaxableFrac = taxableSsFrac;
    }

    // Roth conversion ladder — once per eligible year. Two modes:
    //   • Fixed: convert `annualRothConversion` each year.
    //   • Bracket-fill (conversionCeiling > 0): convert up to the amount that brings this year's
    //     ordinary income to (ceiling taxable income + standard deduction), net of income already
    //     stacked below (drawBase ≈ taxable SS). This "fills the bracket" cheaply.
    // Eligible while age < conversionEndAge (default 59.5 = bridge only; the optimizer raises it
    // to capture RMD-prep years). drawBase same-year 401k draws are not subtracted (approximation).
    const convMode = conversionCeiling > 0 ? "fill" : annualRothConversion > 0 ? "fixed" : null;
    if (convMode && age < conversionEndAge && !scheduled.has(yr) && m % 12 === 0) {
      scheduled.add(yr);
      const target = convMode === "fill"
        ? Math.max(0, (conversionCeiling + (STD_DEDUCTION[filingStatus] ?? STD_DEDUCTION[DEFAULT_FILING_STATUS])) * taxIdx - drawBase)
        : annualRothConversion;
      let conv = Math.min(target, k);
      if (conv > 0) {
        // Tax on conversion: marginal delta from drawBase (stacked on other income this year).
        const taxOf = (amt) =>
          (federalTax(drawBase + amt, filingStatus, taxIdx) - federalTax(drawBase, filingStatus, taxIdx)) + amt * stateTaxRate / 100;
        let tax = taxOf(conv);
        // You can only convert as much as you can pay tax on from liquid funds (cd + bk). Without
        // this, a large bracket-fill with little cash would be silently under-taxed — and the
        // optimizer would "discover" that fiction. Scale the conversion down to what's affordable.
        const liquid = cd + bk;
        if (tax > liquid && tax > 0) {
          conv *= liquid / tax;
          tax = taxOf(conv);
        }
        if (conv > 0) {
          k -= conv;
          // Pay the conversion tax from cash (cd) first, then brokerage (bk).
          let taxDue = tax;
          const fromCd = Math.min(taxDue, cd);
          cd -= fromCd;
          taxDue -= fromCd;
          if (taxDue > 0) {
            const fromBk = Math.min(taxDue, bk);
            bk -= fromBk;
            bb = Math.max(0, bb - fromBk);
            taxDue -= fromBk;
          }
          tranches.push({ avail: age + 5, amt: conv, principal: conv });
          yearOrdAccum += conv;
          conversions.push({ age: Math.round(age), amount: conv });
          if (trackMagi) magiYearAccum += conv;
        }
      }
    }

    // Monthly growth on every bucket.
    rc = Math.max(0, rc) * (1 + mr);
    re = Math.max(0, re) * (1 + mr);
    rv = Math.max(0, rv) * (1 + mr);
    bk = Math.max(0, bk) * (1 + mr);
    k = Math.max(0, k) * (1 + mr);
    // Cash and munis compound at their own yields when provided. These stay
    // fixed even under a stochastic/historical returnSeries — cash doesn't
    // crash with equities, which is what makes a cash buffer worth modeling.
    cd = Math.max(0, cd) * (1 + (cdMr ?? mr));
    mn = Math.max(0, mn) * (1 + (mnMr ?? mr));
    hsa = Math.max(0, hsa) * (1 + mr);
    for (const t of tranches) if (t.amt > 0) t.amt *= 1 + mr;
    // Unlock tranches that have cleared the 5y lock: converted PRINCIPAL is
    // penalty-free at any age (the Roth-ladder bridge); growth on the tranche
    // folds into Roth earnings and stays 59.5-gated.
    for (const t of tranches) if (age >= t.avail && t.amt > 0) {
      rv += Math.min(t.amt, t.principal);
      re += Math.max(0, t.amt - t.principal);
      t.amt = 0;
    }

    // Social Security, inflated; taxable fraction from provisional income formula (IRC §86).
    const ss1 = age >= ssAge ? ssBenefit * Math.pow(1 + mi, m) : 0;
    const ss2 = age >= ss2Age ? ss2Benefit * Math.pow(1 + mi, m) : 0;
    const grossSS = ss1 + ss2;
    const effectiveSsStateTaxRate = stateTaxRate * (1 - stateSsExemptRate);
    let ss = 0;
    if (grossSS > 0) {
      const taxableMonthly = grossSS * taxableSsFrac;
      const taxableAnnual = taxableMonthly * 12;
      // Federal tax: SS occupies [0, taxableSS]; draws occupy [taxableSS, taxableSS+draw].
      // Using base=0 here avoids double-counting the priorYearOrdIncome bracket slice.
      // priorYearOrdIncome is still used above for provisional income (taxable fraction).
      const ssFedTax = federalTax(taxableAnnual, filingStatus, taxIdx) / 12;
      ss = grossSS - ssFedTax - grossSS * effectiveSsStateTaxRate / 100;
      if (trackMagi) magiYearAccum += taxableMonthly;
    }

    // Phase-based spending: scale the inflating base spend by the active phase multiplier.
    const effSpend = spend * phaseMult(age);
    let need = Math.max(0, effSpend - ss);
    // One-time / lump-sum expenses: fire once when age reaches the entry's age.
    // Amounts are in retire-date $; inflate per month like spend, then add to this month's need.
    for (let i = 0; i < oneTimeExpenses.length; i++) {
      const e = oneTimeExpenses[i];
      if (!firedOneTime.has(i) && e && e.amount > 0 && age >= e.age) {
        firedOneTime.add(i);
        need += e.amount * Math.pow(1 + mi, m);
      }
    }
    // ACA healthcare premium: this year's post-credit amount (full at/above the cliff).
    // Applies pre-Medicare only (age < 65). Simplified: below cliff = fully subsidized.
    if (monthlyAcaFullPremium > 0 && age < 65) need += acaMonthlyDue;
    // IRMAA Medicare surcharge: added to expenses at age 65+ when income exceeds thresholds.
    if (monthlyIrmaaSurcharge > 0 && age >= 65) need += monthlyIrmaaSurcharge;

    // 72(t) SEPP: forced monthly 401k draw during the SEPP period (before normal draw order).
    // After-tax income reduces need; any excess is banked in CD for later use.
    if (annualSepp > 0 && age < seppEnd && k > 0) {
      const seppGross = Math.min(annualSepp / 12, k);
      const seppD = seppGross * 12;
      const seppFedRate = seppD > 0
        ? (federalTax(drawBase + seppD, filingStatus, taxIdx) - federalTax(drawBase, filingStatus, taxIdx)) / seppD
        : 0;
      const seppEff = seppFedRate + stateTaxRate / 100;
      k -= seppGross;
      const seppNet = seppGross * (1 - seppEff);
      const applied = Math.min(need, seppNet);
      need -= applied;
      cd += seppNet - applied; // excess SEPP income → CD
      yearOrdAccum += seppGross;
      if (trackMagi) magiYearAccum += seppGross;
    }

    // ── Draw order ──
    if (need > 0 && rc > 0) { const d = Math.min(need, rc); rc -= d; need -= d; }
    if (need > 0 && age >= 59.5 && re > 0) { const d = Math.min(need, re); re -= d; need -= d; }
    if (need > 0 && rv > 0) { const d = Math.min(need, rv); rv -= d; need -= d; }
    if (need > 0 && mn > 0) { const d = Math.min(need, mn); mn -= d; need -= d; }
    // HSA: tax-free draw (treating all spend as qualified medical, the common retirement assumption).
    if (need > 0 && hsa > 0) { const d = Math.min(need, hsa); hsa -= d; need -= d; }
    if (need > 0 && bk > 0) {
      const gainFrac = Math.max(0, (bk - bb) / bk);
      const effTax = gainFrac * ltcgRateNow / 100;
      const gross = need / Math.max(0.01, 1 - effTax);
      const draw = Math.min(gross, bk);
      bb = Math.max(0, bb - draw * (bb / Math.max(bk, 1)));
      bk -= draw;
      need -= draw * (1 - effTax);
      // Only the gain portion of a brokerage draw counts toward ACA MAGI.
      if (trackMagi) magiYearAccum += draw * gainFrac;
    }
    // Rule of 55 unlocks the 401k from retireAge; otherwise locked until 59.5.
    const k401Accessible = age >= 59.5 || rule55;
    if (need > 0 && k401Accessible && k > 0) {
      // Gross-up via bisection: rate = marginal delta at (drawBase + annualized draw).
      const gross = grossUpMonthly(need, drawBase, filingStatus, stateTaxRate / 100, taxIdx);
      const draw = Math.min(gross, k);
      k -= draw;
      const d = draw * 12;
      const fedRate = d > 0
        ? (federalTax(drawBase + d, filingStatus, taxIdx) - federalTax(drawBase, filingStatus, taxIdx)) / d
        : 0;
      need -= draw * (1 - fedRate - stateTaxRate / 100);
      if (taxSummary.k401EffRate === null) taxSummary.k401EffRate = fedRate + stateTaxRate / 100;
      rmdWithdrawnThisYear += draw;
      yearOrdAccum += draw;
      if (trackMagi) magiYearAccum += draw;
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
      const rmdFedRate = shortfall > 0
        ? (federalTax(drawBase + shortfall, filingStatus, taxIdx) - federalTax(drawBase, filingStatus, taxIdx)) / shortfall
        : 0;
      const tax = shortfall * (rmdFedRate + stateTaxRate / 100);
      k -= shortfall;
      // Cash-flow model: reinvest the FULL gross RMD into the taxable brokerage (new cash, so
      // basis = value, no embedded gain), then pay the income tax explicitly from cash (cd)
      // first, then brokerage (bk). This is slightly more conservative than netting the tax out
      // of the RMD proceeds, because it parks the un-needed RMD in an LTCG-exposed account while
      // draining tax-free cash to settle the bill — total wealth still drops by exactly `tax`.
      bk += shortfall;
      bb += shortfall;
      let taxDue = tax;
      const fromCd = Math.min(taxDue, cd);
      cd -= fromCd;
      taxDue -= fromCd;
      if (taxDue > 0) {
        const fromBk = Math.min(taxDue, bk);
        bk -= fromBk;
        bb = Math.max(0, bb - fromBk); // tax settled from the just-added basis (no LTCG on it)
        taxDue -= fromBk;
      }
      yearOrdAccum += shortfall;
    }
    // Guyton-Klinger guardrails: annual spending adjustment based on withdrawal rate.
    // WR = net annual portfolio draw (spending minus guaranteed income) / portfolio total.
    // Using gross spending would inflate WR for plans with significant SS income.
    if (m % 12 === 11 && (guardrailUpper > 0 || guardrailLower > 0)) {
      const pendingGuard = tranches.reduce((s, t) => s + t.amt, 0);
      const total = rc + re + rv + pendingGuard + bk + hsa + k + cd + mn;
      if (total > 0) {
        const netDraw = Math.max(0, effSpend - grossSS) * 12; // annualized portfolio-only draw
        const wr = netDraw / total;
        if (guardrailUpper > 0 && wr > guardrailUpper) spend *= 0.9;
        else if (guardrailLower > 0 && wr < guardrailLower) spend *= 1.1;
      }
    }

    // Save year-end balances for next year's calculations.
    if (m % 12 === 11) {
      priorYearEndK = k;
      priorYearOrdIncome = yearOrdAccum;
      if (trackMagi) priorYearMagi = magiYearAccum;
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

  // Estate gain tax uses the final year's effective rate (equals the flat
  // input when autoLtcg is off).
  const estateGainTax = assumeStepUpBasis ? 0 : Math.max(0, bk - bb) * ltcgRateNow / 100;
  return { snaps, depleted, bridgeShortfall, estateGainTax, taxSummary, conversions };
}
