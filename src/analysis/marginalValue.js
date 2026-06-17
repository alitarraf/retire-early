// Maximize mode: marginal value of an extra $1k/yr into each account —
// how much additional estate value at death it produces, via a full
// simulation per account.

import { runMain } from "./plan.js";

const BUMP = 1000; // $1k/yr extra

export function marginalValues(plan) {
  const baseEnd = endTotal(runMain(plan));
  const rows = [
    { label: "Extra $1k/yr → 401k", key: "k401", ov: { k401Annual: BUMP } },
    { label: "Extra $1k/yr → Roth IRA", key: "roth", ov: { rothAnnual: BUMP } },
    { label: "Extra $1k/yr → Munis", key: "muni", ov: { muniAdd: BUMP * plan.yearsToRetire } },
  ];
  return rows.map(({ label, key, ov }) => {
    const end = endTotal(runMain(plan, ov));
    return { label, key, gain: Math.max(0, end - baseEnd) };
  });
}

function endTotal(res) {
  if (!res || !res.snaps.length) return 0;
  return res.snaps[res.snaps.length - 1].total;
}
