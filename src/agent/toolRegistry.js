// ─────────────────────────────────────────────────────────────
//  Tool registry (PRD §6) — the SINGLE source of truth for the
//  agent's tools. Each entry carries the Anthropic schema, a
//  prescriptive "call this when…" description, the handler, and the
//  documented return keys (guarded by the drift test, §14).
//
//  toolDefs.js derives the API schemas FROM this file; toolDispatch.js
//  routes to the handlers. Adding a tool = one entry here.
//
//  Read handlers:  (args, plan)            → compact JSON of numbers
//  Write builders: (args, plan)            → { changes[], kind, payload }
//  Numbers are computed by the real engine and quoted verbatim — the
//  model never does arithmetic (§4.1).
// ─────────────────────────────────────────────────────────────

import { runAt, simParamsAt, projectTo, makePlan, DEFAULTS } from "../analysis/plan.js";
import { earliestRetireAge } from "../analysis/earliestRetireAge.js";
import { sustainableSpend } from "../analysis/sustainableSpend.js";
import { dynamicOptimizer } from "../analysis/dynamicOptimizer.js";
import { stressTest } from "../analysis/stressTest.js";
import { historicalSequence } from "../analysis/historicalSequence.js";
import { sensitivity } from "../analysis/sensitivity.js";
import { marginalValues } from "../analysis/marginalValue.js";
import { retireByAge } from "../analysis/retireByAge.js";
import { recommendedFunding, fundingContribOverrides } from "../analysis/fundingOrder.js";
import { monteCarlo } from "../engine/monteCarlo.js";
import { RISK_PROFILE_KEYS } from "../engine/allocation.js";
import { HISTORICAL_SCENARIOS } from "../constants/historicalReturns.js";
import { STATE_TAXES } from "../constants/brackets.js";

// ── shared helpers ───────────────────────────────────────────

/**
 * Compact headline metrics from a simulate() result. Derived from the SAME
 * formulas the panels / buildPlanSummary use, so the agent's numbers equal the
 * panel's by construction (§4.1, §15):
 *   • survives  matches the panel verdict (depleted === null; the bridge gap is
 *     reported separately, exactly as EarlyPanel shows a separate BridgeWarning).
 *   • endEstate = lastTotal − estateGainTax (buildPlanSummary's endVal).
 * NOTE: portfolio-at-retirement is NOT taken from snaps[0] — the engine's first
 * yearly snapshot lands ~1 year into retirement, not at it. Use
 * portfolioAtRetirement() (the projectAtRetirement sum the panel renders).
 */
function headline(res) {
  const snaps = res.snaps ?? [];
  const last = snaps[snaps.length - 1];
  return {
    survives: res.depleted == null,
    depletionAge: res.depleted == null ? null : Math.ceil(res.depleted),
    bridgeShortfall: res.bridgeShortfall,
    endEstate: Math.round((last?.total ?? 0) - (res.estateGainTax ?? 0)),
  };
}

/**
 * Portfolio value AT retirement — the exact sum App.jsx renders as
 * "totalAtRetirement" (projectAtRetirement balances, excluding brokerageBasis,
 * which is cost basis not a balance). Reused here so the agent's figure equals
 * the panel's by construction.
 */
function portfolioAtRetirement(plan, age, overrides = {}) {
  const p = projectTo(plan, age - plan.currentAge, overrides);
  return Math.round(
    p.rothContributions +
      p.rothEarnings +
      p.k401 +
      p.brokerage +
      p.cashDeposit +
      p.muniBonds +
      (p.hsaBalance ?? 0),
  );
}

// Override keys the agent may pass to run_scenario (a curated subset of the
// counterfactual `overrides` already accepted by runAt/simParamsAt).
const SCENARIO_OVERRIDE_KEYS = [
  "monthlyExpense",
  "annualRothConversion",
  "conversionCeiling",
  "conversionEndAge",
  "ssAge",
  "ssBenefit",
  "rule55",
  "annualSepp",
];

function pickOverrides(args) {
  const o = {};
  for (const k of SCENARIO_OVERRIDE_KEYS) {
    if (args[k] != null) o[k] = args[k];
  }
  return o;
}

function ageOrDefault(args, plan) {
  const age = args.age != null ? args.age : plan.retireAge;
  if (age < plan.currentAge) {
    throw new Error(
      `Retirement age ${age} is before the current age (${plan.currentAge}). Pick an age ≥ ${plan.currentAge}.`,
    );
  }
  return age;
}

// ── the registry ─────────────────────────────────────────────

// ── update_inputs field surface ─────────────────────────────
// Patchable fields derive from DEFAULTS so every new scalar plan input is
// agent-writable automatically. Exclusions: retireAge (set_retire_age owns
// it), scenario fields (set_scenario owns them), allocation fields
// (set_allocation owns them — enum + sum-to-100 validation), and array-valued
// inputs (stream/one-time editors stay UI-only).
const UPDATE_EXCLUDED = new Set([
  "retireAge",
  "scenarioMode",
  "stressDropPct",
  "stressYears",
  "historicalScenario",
  "historicalLens",
  "allocationEnabled",
  "riskProfile",
  "pinAllocation",
  "equityPct",
  "bondPct",
  "cashPct",
  "oneTimeExpenses",
  "incomeStreams",
  "expenseStreams",
]);
export const UPDATE_PATCH_FIELDS = Object.keys(DEFAULTS).filter(
  (k) => !UPDATE_EXCLUDED.has(k) && typeof DEFAULTS[k] !== "object",
);
const FILING_STATUSES = ["single", "mfj", "hoh"];
const ALLOCATION_CHOICES = [...RISK_PROFILE_KEYS, "custom"]; // named glide profiles + pinned custom mix
// Curated descriptions for the fields the model reaches for most; the rest
// get a generic line carrying their default value.
const FIELD_DESC = {
  monthlyExpense: "Monthly spending in today's dollars.",
  currentAge: "The user's current age (always confirmed with the user).",
  lifeExpect: "Planning horizon — the age money must last to.",
  ssAge: "Social Security claiming age (62–70).",
  ssBenefit: "Monthly SS benefit at the claiming age, today's $.",
  salary: "Annual salary (drives employer match and pre-retirement MAGI).",
  k401Today: "Current 401k balance (always confirmed with the user).",
  rothTotal: "Current Roth IRA balance (always confirmed with the user).",
  existingBrokerage: "Current taxable brokerage value (always confirmed).",
  existingBrokerageBasis: "Brokerage cost basis (always confirmed).",
  cashDeposit: "Cash/CD balance (always confirmed with the user).",
  muniBonds: "Municipal bond balance (always confirmed with the user).",
  hsaBalance: "HSA balance (always confirmed with the user).",
  annualRothConversion: "Fixed annual Roth conversion amount.",
  conversionCeiling: "Bracket-fill conversion ceiling (taxable-income top).",
  conversionEndAge: "Age through which Roth conversions run.",
  stockReturn: "Assumed annual stock return (%).",
  bondReturn: "Assumed annual bond return (%) — the bond slice of the allocation glide.",
  inflationRate: "Assumed inflation rate (%).",
  rule55: "Rule-of-55: penalty-free 401k access from retirement.",
  annualSepp: "Annual 72(t) SEPP withdrawal amount.",
  filingStatus: "Tax filing status (always confirmed with the user).",
  stateKey: "State of residence — exact name from the app's state list.",
  alreadyRetired: "Life stage: true = already retired (always confirmed).",
  autoLtcg: "Derive the LTCG rate from real bracket stacking + NIIT instead of the flat ltcgBracket.",
  autoMedicare: "Model income-tested Medicare Part B + IRMAA at 65+ automatically.",
  survivorAge: "Primary's age when the spouse dies; 0 = not modeled.",
  survivorSpendFraction: "Share of base spending that continues after the spouse's death.",
  hsaQualifiedFraction: "Share of spending that is qualified medical for HSA draws (0–1).",
  guardrailUpper: "Withdrawal-rate fraction above which spending cuts 10% (e.g. 0.055; 0 = off).",
  guardrailLower: "Withdrawal-rate fraction below which spending rises 10% (0 = off).",
  monthlyAcaFullPremium: "Benchmark silver ACA premium per month (pre-65 healthcare; 0 = not modeled).",
};
function fieldSchema(k) {
  const v = DEFAULTS[k];
  const type = typeof v === "boolean" ? "boolean" : typeof v === "string" ? "string" : "number";
  const s = { type, description: FIELD_DESC[k] ?? `Plan input '${k}' (default ${JSON.stringify(v)}).` };
  if (k === "filingStatus") s.enum = FILING_STATUSES;
  return s;
}
const UPDATE_SCHEMA = Object.fromEntries(UPDATE_PATCH_FIELDS.map((k) => [k, fieldSchema(k)]));

export const TOOL_REGISTRY = {
  // ── READ TOOLS ──────────────────────────────────────────────
  run_scenario: {
    kind: "read",
    description:
      "Run the retirement simulation for a hypothetical change and return real, engine-computed numbers. Call this whenever the user asks what happens if they retire at a different age, spend a different amount, convert a different amount to Roth, or claim Social Security at a different age. Pass ONLY the fields that change as arguments; everything else uses the user's current plan. This does NOT modify the user's inputs — it is a pure what-if.",
    schema: {
      age: { type: "number", description: "Retirement age to test. Omit to use the user's configured retire age." },
      monthlyExpense: { type: "number", description: "Monthly spending in today's dollars to test." },
      annualRothConversion: { type: "number", description: "Fixed annual Roth conversion amount to test." },
      conversionCeiling: { type: "number", description: "Bracket-fill conversion ceiling (top of taxable income) to test." },
      conversionEndAge: { type: "number", description: "Age through which conversions run." },
      ssAge: { type: "number", description: "Social Security claiming age to test." },
      ssBenefit: { type: "number", description: "Monthly Social Security benefit to test." },
      rule55: { type: "boolean", description: "Whether to use Rule of 55 early 401k access." },
      annualSepp: { type: "number", description: "Annual 72(t) SEPP withdrawal to test." },
    },
    returnKeys: ["survives", "depletionAge", "bridgeShortfall", "portfolioAtRetirement", "endEstate"],
    handler(args, plan) {
      const age = ageOrDefault(args, plan);
      const overrides = pickOverrides(args);
      const res = runAt(plan, age, overrides);
      if (!res) throw new Error("Simulation returned no result for that age.");
      return { age, portfolioAtRetirement: portfolioAtRetirement(plan, age, overrides), ...headline(res) };
    },
  },

  find_earliest_retirement: {
    kind: "read",
    description:
      "Find the earliest age at which the user's money safely lasts to life expectancy with no pre-59½ bridge shortfall. Call this for 'how early can I retire?' / safe-exit questions.",
    schema: {},
    returnKeys: ["earliestAge", "targetAge"],
    handler(args, plan) {
      if (plan.alreadyRetired) {
        return {
          alreadyRetired: true,
          note: "The user is already retired — there is no earliest retirement age to find. Discuss sustainable spend, conversions, or RMDs instead.",
        };
      }
      const earliestAge = earliestRetireAge(plan);
      return { earliestAge, targetAge: plan.retireAge };
    },
  },

  max_sustainable_spend: {
    kind: "read",
    description:
      "Find the maximum monthly spend (at retirement) the plan can sustain to life expectancy. Call this for 'how much can I safely spend per month?'.",
    schema: {},
    returnKeys: ["monthlyAtRetirement", "currentMonthlyAtRetirement"],
    handler(args, plan) {
      const monthlyAtRetirement = Math.round(sustainableSpend(plan));
      return { monthlyAtRetirement, currentMonthlyAtRetirement: Math.round(plan.monthlyAtRetirement) };
    },
  },

  run_monte_carlo: {
    kind: "read",
    description:
      "Run 500 seeded Monte Carlo simulations with random market returns and return the probability of success and final-wealth percentiles. Call this when the user asks about probability of success, market risk, or 'what are the odds'.",
    schema: {
      age: { type: "number", description: "Retirement age to test. Omit to use the configured retire age." },
    },
    returnKeys: ["successRate", "medianEndTotal", "p10EndTotal", "p90EndTotal"],
    handler(args, plan) {
      const age = ageOrDefault(args, plan);
      const mc = monteCarlo(simParamsAt(plan, age), { n: 500, seed: 42 });
      return {
        age,
        successRate: Math.round(mc.successRate * 1000) / 1000,
        medianEndTotal: Math.round(mc.medianEndTotal),
        p10EndTotal: Math.round(mc.p10EndTotal),
        p90EndTotal: Math.round(mc.p90EndTotal),
      };
    },
  },

  optimize_roth_conversions: {
    kind: "read",
    description:
      "Search Roth conversion strategies and return the bracket-fill ceiling that maximizes the net estate, along with the estate gain vs no conversions. Call this for tax-efficiency / Roth conversion questions. To APPLY the recommendation to the user's plan, follow up with update_inputs { conversionCeiling, conversionEndAge, annualRothConversion: 0 }.",
    schema: {},
    returnKeys: ["type", "ceiling", "rate", "endAge", "estateBase", "estateWith", "gain", "totalConverted"],
    handler(args, plan) {
      const o = dynamicOptimizer(plan);
      return {
        type: o.type,
        ceiling: Math.round(o.ceiling),
        rate: o.rate,
        endAge: o.endAge,
        estateBase: Math.round(o.estateBase),
        estateWith: Math.round(o.estateWith),
        gain: Math.round(o.gain),
        totalConverted: Math.round(o.totalConverted),
      };
    },
  },

  stress_or_history: {
    kind: "read",
    description:
      "Run a single downside scenario — either a synthetic early-crash stress test or a real historical market sequence (2000 dot-com, 2007 GFC, 2022 inflation, 1973 stagflation) — and return how the plan holds up. Call this for 'what if the market crashes when I retire?' / specific historical-crash questions.",
    schema: {
      type: { type: "string", enum: ["stress", "historical"], description: "'stress' for a synthetic early crash, 'historical' to replay a real sequence." },
      age: { type: "number", description: "Retirement age to test. Omit to use the configured retire age." },
      dropPct: { type: "number", description: "(stress) Annual crash percentage for the early years, e.g. 30." },
      years: { type: "number", description: "(stress) Number of consecutive crash years." },
      scenario: { type: "string", enum: ["dotcom2000", "gfc2007", "inflation2022", "stagflation1973"], description: "(historical) Which recorded sequence to replay." },
      lens: { type: "string", enum: ["sp", "balanced"], description: "(historical) Return series: 'sp' all-equity or 'balanced' 60/40." },
    },
    returnKeys: ["scenarioType", "survives", "depletionAge", "endEstate"],
    handler(args, plan) {
      const age = ageOrDefault(args, plan);
      const params = simParamsAt(plan, age);
      let res;
      let scenarioType;
      if (args.type === "historical") {
        const key = args.scenario ?? plan.historicalScenario;
        const sc = HISTORICAL_SCENARIOS.find((s) => s.key === key);
        if (!sc) throw new Error(`Unknown historical scenario '${key}'.`);
        res = historicalSequence(params, { startYear: sc.startYear, lens: args.lens ?? "balanced" });
        scenarioType = `historical:${key}`;
      } else {
        res = stressTest(params, { dropPct: args.dropPct ?? 30, years: args.years ?? 3 });
        scenarioType = `stress:${args.dropPct ?? 30}%/${args.years ?? 3}y`;
      }
      const h = headline(res);
      return { age, scenarioType, survives: h.survives, depletionAge: h.depletionAge, endEstate: h.endEstate };
    },
  },

  get_change_log: {
    kind: "read",
    description:
      "Return the structured list of every change Ask has made to the plan this session (field, from → to, status). Call this when the user asks what you changed earlier, or before reverting a specific past change.",
    schema: {},
    returnKeys: ["changes"],
    // Special-cased in the dispatcher (needs the change log, not the plan).
    handler() {
      return { changes: [] };
    },
  },

  // ── WRITE TOOLS (gated per §4.2) ────────────────────────────
  update_inputs: {
    kind: "write",
    description:
      "Apply a change to the user's actual plan inputs so the dashboard updates live. Use ONLY when the user asks to change their plan (not for what-ifs — use run_scenario for those). Pass a partial patch of the fields to change. Account balances, ages, filing status, and other identity-level fields are ALWAYS staged for the user's confirmation; large or multi-field changes are staged too.",
    schema: UPDATE_SCHEMA,
    returnKeys: ["status", "changes"],
    writeKind: "inputs",
    // Allowed patch fields — derived from DEFAULTS so new plan inputs become
    // agent-writable automatically (checked by the drift test).
    patchFields: UPDATE_PATCH_FIELDS,
    buildProposal(args, plan) {
      const changes = [];
      const payload = {};
      for (const f of this.patchFields) {
        if (args[f] == null || args[f] === plan[f]) continue;
        const want = typeof DEFAULTS[f];
        if (typeof args[f] !== want) {
          throw new Error(`'${f}' must be a ${want}, got ${typeof args[f]}.`);
        }
        if (f === "filingStatus" && !FILING_STATUSES.includes(args[f])) {
          throw new Error(`filingStatus must be one of: ${FILING_STATUSES.join(", ")}.`);
        }
        if (f === "stateKey" && !STATE_TAXES.some((s) => s.name === args[f])) {
          throw new Error(
            `Unknown state '${args[f]}'. Use an exact name from the app's list, e.g. "Oregon", "California", or "No state tax".`,
          );
        }
        changes.push({ field: f, from: plan[f], to: args[f], scope: "input" });
        payload[f] = args[f];
      }
      return { kind: "inputs", changes, payload };
    },
  },

  set_retire_age: {
    kind: "write",
    description:
      "Set the user's actual target retirement age so the Retire-at control and all panels recompute. Use only when the user asks to change their retire age (not for what-ifs).",
    schema: {
      age: { type: "number", description: "New target retirement age." },
    },
    returnKeys: ["status", "changes"],
    writeKind: "age",
    buildProposal(args, plan) {
      if (plan.alreadyRetired) {
        throw new Error(
          "The user is already retired — the retirement age is pinned to their current age. Suggest adjusting spending, conversions, or scenario settings instead.",
        );
      }
      const to = args.age;
      const changes =
        to != null && to !== plan.retireAge
          ? [{ field: "retireAge", from: plan.retireAge, to, scope: "age" }]
          : [];
      return { kind: "age", changes, payload: to };
    },
  },

  set_scenario: {
    kind: "write",
    description:
      "Switch the dashboard's scenario overlay between deterministic, an early-crash stress test, or a historical market sequence, so the chart shows that downside. Use when the user wants to SEE a scenario on the dashboard.",
    schema: {
      mode: { type: "string", enum: ["deterministic", "stress", "historical"], description: "Which scenario overlay to show." },
      stressDropPct: { type: "number", description: "(stress) Annual crash percentage." },
      stressYears: { type: "number", description: "(stress) Number of crash years." },
      historicalScenario: { type: "string", enum: ["dotcom2000", "gfc2007", "inflation2022", "stagflation1973"], description: "(historical) Which sequence." },
      historicalLens: { type: "string", enum: ["sp", "balanced"], description: "(historical) Return series." },
    },
    returnKeys: ["status", "changes"],
    writeKind: "scenario",
    buildProposal(args, plan) {
      const changes = [];
      const payload = {};
      if (args.mode != null && args.mode !== plan.scenarioMode) {
        changes.push({ field: "scenarioMode", from: plan.scenarioMode, to: args.mode, scope: "scenario" });
        payload.scenarioMode = args.mode;
      }
      for (const f of ["stressDropPct", "stressYears", "historicalScenario", "historicalLens"]) {
        if (args[f] != null && args[f] !== plan[f]) {
          changes.push({ field: f, from: plan[f], to: args[f], scope: "scenario" });
          payload[f] = args[f];
        }
      }
      return { kind: "scenario", changes, payload };
    },
  },

  set_allocation: {
    kind: "write",
    description:
      "Set the user's asset allocation / risk profile — the stock/bond/cash mix that drives portfolio growth. Turn allocation modeling on and choose a named risk profile ('conservative' | 'moderate' | 'aggressive'), whose equity share glides down with age like a target-date fund, OR pin a fixed 'custom' equity/bond/cash split. Use when the user asks how a more (or less) aggressive allocation, or a specific stock/bond split, changes when they can retire. Read tools (earliest retirement, scenarios, Monte Carlo) then reflect the new mix automatically.",
    schema: {
      enabled: { type: "boolean", description: "Turn allocation modeling on or off. Off = a flat stock return (legacy behavior)." },
      riskProfile: {
        type: "string",
        enum: ALLOCATION_CHOICES,
        description: "Named glide profile, or 'custom' to pin the equity/bond/cash mix below.",
      },
      equityPct: { type: "number", description: "(custom) Equity % of the mix; equity + bond + cash must total 100." },
      bondPct: { type: "number", description: "(custom) Bond % of the mix." },
      cashPct: { type: "number", description: "(custom) Cash % of the mix." },
    },
    returnKeys: ["status", "changes"],
    writeKind: "inputs",
    buildProposal(args, plan) {
      const changes = [];
      const payload = {};
      const put = (f, v) => {
        if (v != null && v !== plan[f]) {
          changes.push({ field: f, from: plan[f], to: v, scope: "input" });
          payload[f] = v;
        }
      };
      if (args.riskProfile != null && !ALLOCATION_CHOICES.includes(args.riskProfile)) {
        throw new Error(`riskProfile must be one of: ${ALLOCATION_CHOICES.join(", ")}.`);
      }
      const wantsCustom =
        args.riskProfile === "custom" ||
        args.equityPct != null || args.bondPct != null || args.cashPct != null;
      if (wantsCustom) {
        const eq = args.equityPct ?? plan.equityPct;
        const bd = args.bondPct ?? plan.bondPct;
        const csh = args.cashPct ?? plan.cashPct;
        if (Math.abs(eq + bd + csh - 100) > 0.5) {
          throw new Error(
            `Custom allocation must total 100% (got equity ${eq} + bond ${bd} + cash ${csh} = ${eq + bd + csh}).`,
          );
        }
        put("riskProfile", "custom");
        put("pinAllocation", true);
        put("equityPct", eq);
        put("bondPct", bd);
        put("cashPct", csh);
      } else if (args.riskProfile != null) {
        put("riskProfile", args.riskProfile);
        put("pinAllocation", false);
      }
      // Explicit `enabled` wins; otherwise setting any allocation implies on.
      const enable = args.enabled != null ? args.enabled : changes.length > 0 ? true : undefined;
      put("allocationEnabled", enable);
      if (changes.length === 0) {
        throw new Error("Nothing to change — specify enabled, a riskProfile, or a custom equity/bond/cash mix.");
      }
      return { kind: "inputs", changes, payload };
    },
  },

  run_analysis: {
    kind: "read",
    description:
      "Run one of the dashboard's deeper analyses: 'sensitivity' = which levers buy the most years of earlier retirement; 'marginal_value' = where the next $1k/yr of savings adds the most SUSTAINABLE MONTHLY SPENDING (bridge-aware — a 401k locked until 59½ scores low for an early retiree; shares its objective with the funding-order card); 'retire_by_age' = what it takes (extra monthly savings or lower spending) to retire at a target age. Returns compact rows.",
    schema: {
      type: {
        type: "string",
        enum: ["sensitivity", "marginal_value", "retire_by_age"],
        description: "Which analysis to run.",
      },
      targetAge: { type: "number", description: "(retire_by_age) Target age; defaults to the plan's retire age." },
    },
    returnKeys: ["type", "rows"],
    handler(args, plan) {
      const type = args.type;
      if (type === "sensitivity") {
        if (plan.alreadyRetired) {
          return { type, note: "The user is already retired — retirement-age levers do not apply. Discuss sustainable spend or conversions instead." };
        }
        const rows = sensitivity(plan)
          .map((r) => ({ label: r.label, yearsEarlier: r.delta, newEarliestAge: r.newEarliest }))
          .slice(0, 10);
        return { type, rows };
      }
      if (type === "marginal_value") {
        const rows = marginalValues(plan)
          .map((r) => ({ label: r.label, monthlySpendGain: Math.round(r.gain) }))
          .slice(0, 10);
        return { type, rows };
      }
      if (type === "retire_by_age") {
        if (plan.alreadyRetired) {
          return { type, note: "The user is already retired — there is no future retirement age to plan for." };
        }
        const r = retireByAge(plan, args.targetAge ?? plan.retireAge);
        return {
          type,
          targetAge: args.targetAge ?? plan.retireAge,
          onTrack: r.onTrack,
          feasible: r.feasible,
          extraMonthlySavingsNeeded: Math.round(r.extraMonthly ?? 0),
          orReduceSpendingToMonthly: Math.round(r.altSpendMonthlyToday ?? 0),
        };
      }
      throw new Error("type must be one of: sensitivity, marginal_value, retire_by_age.");
    },
  },

  route_savings: {
    kind: "write",
    description:
      "Route the user's ANNUAL SAVINGS across accounts in tax-optimal order (the 'funding order' waterfall): emergency cash buffer → capture the employer 401k match → max the HSA → fund the Roth IRA → max the 401k → overflow to taxable brokerage, each filled to its IRS limit. Re-allocates the SAME total savings (no new saving) to cut tax drag. Use when the user asks where to put their money, how to split their contributions, or which accounts to prioritize. Respects the risk profile (aggressive fills Roth before maxing the 401k). Rejects if the user is already retired / not saving. Writes the per-account contribution inputs; staged for confirmation.",
    schema: {},
    returnKeys: ["status", "changes"],
    writeKind: "inputs",
    buildProposal(_args, plan) {
      const rec = recommendedFunding(plan);
      if (!rec.available) {
        throw new Error("There's nothing to route — this plan has no annual savings (already retired or zero contributions).");
      }
      const patch = fundingContribOverrides(rec);
      const changes = [];
      const payload = {};
      for (const [field, to] of Object.entries(patch)) {
        const from = plan[field] ?? 0;
        if (Math.abs(to - from) > 0.5) {
          changes.push({ field, from, to, scope: "input" });
          payload[field] = to;
        }
      }
      if (changes.length === 0) {
        throw new Error("The savings are already routed in the recommended tax-optimal order — no change needed.");
      }
      return { kind: "inputs", changes, payload };
    },
  },

  set_view: {
    kind: "write",
    description:
      "Switch the dashboard to a different tab so the user sees the panel you're discussing: 'early' (Retire Early / My Retirement), 'maximize' (optimizer + where-to-save), 'advice', or 'docs'. Optionally trigger the Maximize tab's on-demand Monte Carlo run. Never needs confirmation.",
    schema: {
      tab: { type: "string", enum: ["early", "maximize", "advice", "docs"], description: "Tab to show." },
      runMonteCarlo: { type: "boolean", description: "Also run the Maximize tab's 500-path Monte Carlo." },
    },
    returnKeys: ["status", "changes"],
    writeKind: "view",
    buildProposal(args) {
      const changes = args.tab
        ? [{ field: "view", from: null, to: args.tab, scope: "view" }]
        : [];
      return { kind: "view", changes, payload: { tab: args.tab, runMonteCarlo: args.runMonteCarlo === true } };
    },
  },

  apply_lever: {
    kind: "write",
    description:
      "Apply one of the sensitivity levers (from run_analysis type='sensitivity') to the user's REAL plan by its exact label — e.g. after the user picks 'Spend −$1,000/mo'. Flows through the normal confirmation and undo machinery.",
    schema: {
      label: { type: "string", description: "Exact lever label as returned by run_analysis." },
    },
    returnKeys: ["status", "changes"],
    writeKind: "inputs",
    buildProposal(args, plan) {
      if (plan.alreadyRetired) {
        throw new Error("The user is already retired — retirement-age levers do not apply.");
      }
      const rows = sensitivity(plan);
      const want = (args.label ?? "").trim().toLowerCase();
      const row = rows.find((r) => r.label.toLowerCase() === want);
      if (!row) {
        throw new Error(`Unknown lever '${args.label}'. Valid levers: ${rows.map((r) => r.label).join("; ")}.`);
      }
      const changes = Object.entries(row.apply)
        .filter(([f, v]) => v !== plan[f])
        .map(([f, v]) => ({ field: f, from: plan[f], to: v, scope: "input" }));
      return { kind: "inputs", changes, payload: row.apply };
    },
  },

  revert_changes: {
    kind: "write",
    description:
      "Undo ALL changes this conversation has made to the user's plan, restoring the snapshot taken before the first change. Use when the user asks to undo/revert everything. Always staged for confirmation.",
    schema: {},
    returnKeys: ["status", "changes"],
    writeKind: "revert",
    buildProposal() {
      return {
        kind: "revert",
        changes: [{ field: "(all agent changes)", from: "current plan", to: "pre-conversation baseline", scope: "revert" }],
        payload: null,
      };
    },
  },
};

// Re-export for tests / dispatcher.
export { headline, portfolioAtRetirement, makePlan, DEFAULTS };
