// ─────────────────────────────────────────────────────────────
//  Derives the Anthropic `tools` array FROM toolRegistry.js (PRD §6).
//  Single source of truth → no schema drift. Every property in each
//  tool's input_schema comes straight from the registry entry.
// ─────────────────────────────────────────────────────────────

import { TOOL_REGISTRY } from "./toolRegistry.js";

/** Build the Anthropic Messages API `tools` array from the registry. */
export function buildToolDefs() {
  return Object.entries(TOOL_REGISTRY).map(([name, entry]) => ({
    name,
    description: entry.description,
    input_schema: {
      type: "object",
      properties: entry.schema ?? {},
      // All registry args are optional (the handlers default sensibly); no
      // `required` so Haiku can call e.g. run_scenario with just `age`.
      additionalProperties: false,
    },
  }));
}

/** Names of every tool, for validation. */
export function toolNames() {
  return Object.keys(TOOL_REGISTRY);
}
