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
import { monteCarlo } from "../engine/monteCarlo.js";
import { HISTORICAL_SCENARIOS } from "../constants/historicalReturns.js";

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
      "Search Roth conversion strategies and return the bracket-fill ceiling that maximizes the net estate, along with the estate gain vs no conversions. Call this for tax-efficiency / Roth conversion questions.",
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
      "Apply a change to the user's actual plan inputs so the dashboard updates live. Use ONLY when the user asks to change their plan (not for what-ifs — use run_scenario for those). Pass a partial patch of the fields to change. Large or multi-field changes are staged for the user's confirmation before they take effect.",
    schema: {
      monthlyExpense: { type: "number", description: "New monthly spending in today's dollars." },
      annualRothConversion: { type: "number", description: "New fixed annual Roth conversion amount." },
      conversionCeiling: { type: "number", description: "New bracket-fill conversion ceiling." },
      conversionEndAge: { type: "number", description: "New age through which conversions run." },
      ssAge: { type: "number", description: "New Social Security claiming age." },
      stockReturn: { type: "number", description: "New assumed annual stock return (%)." },
      inflationRate: { type: "number", description: "New assumed inflation rate (%)." },
    },
    returnKeys: ["status", "changes"],
    writeKind: "inputs",
    // Allowed patch fields (must be real DEFAULTS keys — checked by the drift test).
    patchFields: ["monthlyExpense", "annualRothConversion", "conversionCeiling", "conversionEndAge", "ssAge", "stockReturn", "inflationRate"],
    buildProposal(args, plan) {
      const changes = [];
      const payload = {};
      for (const f of this.patchFields) {
        if (args[f] != null && args[f] !== plan[f]) {
          changes.push({ field: f, from: plan[f], to: args[f], scope: "input" });
          payload[f] = args[f];
        }
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
};

// Re-export for tests / dispatcher.
export { headline, portfolioAtRetirement, makePlan, DEFAULTS };
