// Design tokens — the single source for color so the three jobs the UI was
// conflating stay separate: neutrals (structure/text), status (verdicts only),
// and phases (structural identity, never a verdict). UI layer only; never
// imported by engine/ or analysis/.

// Neutral scale (collapsed from ~10 near-identical grays to one ramp).
export const neutral = {
  ink: "#1a2e28", // brand near-black: primary text, dark fills
  text: "#4a5e58", // body copy
  textMuted: "#7C9A92", // secondary text, section labels
  textFaint: "#9db4ae", // hints, micro-labels, axis ticks
  border: "#e2e8e6", // dividers + hairline borders
  fill: "#f0f5f4", // subtle tint fills
  surface: "#fafcfc", // lightest background
};

// Status — reserved for verdicts (on-track / behind / impossible). Never used
// as a phase or decorative identity.
export const status = {
  ok: "#3d8c78",
  okSoft: "#7ecfbb", // light accent bar / fill for an OK verdict
  warn: "#c97c1a",
  warnSoft: "#f0c987",
  fail: "#c0392b",
  failSoft: "#e8a99b",
};

// Phase identity — a cool slate ramp, deliberately distinct from the status
// hues so a green/amber/red number always reads as a verdict, never a phase.
export const phase = {
  bridge: "#7e93a8",
  early: "#5c7b94",
  full: "#3a5365",
};

// Slider language — shared by the native range (RetireAtControl, via index.css
// custom properties) and the custom RangeSlider (ui.jsx), so the two match.
export const slider = {
  track: "#e2e8e6",
  active: "#1a2e28",
  thumbBorder: "#3d8c78",
};

// Caps eyebrow — reserved for TRUE section starts (Section, rail headers,
// sidebar group titles, the hero label). Don't sprinkle on every card.
export const eyebrowStyle = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: neutral.textMuted,
};

// Card title — sentence case, for secondary card headers. Replaces the
// per-card caps eyebrows so hierarchy actually means something.
export const cardTitleStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: neutral.ink,
};
