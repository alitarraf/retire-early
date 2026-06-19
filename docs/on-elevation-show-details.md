Task: simplify framing across Retire Early, and convert "Show details" to flat flow (Option A).

1. One elevation language (kill competing framing devices)

Adopt a single rule, then sweep the result components for violations:

Floating content = white + boxShadow:"0 1px 4px rgba(0,0,0,0.06)" + borderRadius:14. No border.
Grouping/secondary = flat tint fill (#f0f5f4 / #eef2f1), no shadow, no border.
Accent = a single left bar (borderLeft:3px) reserved ONLY for status (stress/warn). Don't combine it with a full border.
Concretely:

ui.jsx Card: drop the warn border:"1.5px solid #f5c0b0" — signal warn with the #fff3f0 fill alone.
EarlyPanel.jsx KpiChip: drop the warn border:"1px solid #f5c0b0" — keep the #fff3f0 fill + red text only.
EarlyPanel.jsx BridgeWarning: keep the fill, drop the border:"1px solid #f5d9a0" (or convert to a borderLeft:3px accent — pick one, not both).
Audit for any element carrying both a shadow and a border; remove the border.
2. Show details → Option A (flat flow, no shell)

In EarlyPanel.jsx, replace the <Collapsible> block with an inline disclosure:

Keep the detailsOpen state + the useEffect auto-open.
Trigger: a borderless hairline-rule row, not a button-box — Show/Hide details label (#3d8c78, 12px/700) on the left, a flex:1; height:1px; background:#dde7e3 rule in the middle, muted caption + chevron on the right.
When open: render MonteCarloCard / StressCard / TaxTransparency / LegacyGap directly (no wrapper). They already use cardStyle (margin:12px 14px 0, white, r14, shadow), so they'll flow in the exact same rhythm as the Hero and PortfolioChartCard above — that's the whole point.
Delete the Collapsible wrapper's border, borderRadius:10, overflow:hidden, the header background swap (#f0f5f4/#fafcfc), and the open-body borderTop. If Collapsible is unused elsewhere after this, leave it; otherwise just stop using it here.
Net effect: the details section stops being a bordered box-of-boxes and becomes more of the same column — one framing layer, not three.
