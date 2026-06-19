// ─────────────────────────────────────────────────────────────
//  Historical annual market returns, for "Historical Sequence Testing"
//  (replay a real bad retirement-start sequence through the drawdown sim).
//
//  Two lenses per year, both NOMINAL total returns in percent:
//    • sp        — S&P 500 total return (price + dividends).
//    • balanced  — a 60/40 blend: 0.6 · S&P 500 + 0.4 · US aggregate bonds.
//
//  The drawdown engine applies ONE return to the whole portfolio, so the lens
//  the user picks is applied to every bucket (same basis as the Stress Test).
//  Spending still inflates at the user's own inflationRate — these returns are
//  nominal, and era-specific inflation (e.g. the 1970s) is NOT modeled here.
//
//  Figures are representative, compiled from public total-return series, and
//  rounded. Verify against an authoritative source (e.g. NYU Stern / Bloomberg
//  Agg) before relying on them for real decisions.
// ─────────────────────────────────────────────────────────────

export const HISTORICAL_RETURNS = {
  1973: { sp: -14.7, balanced: -7.9 },
  1974: { sp: -26.5, balanced: -15.8 },
  1975: { sp: 37.2, balanced: 24.3 },
  1976: { sp: 23.8, balanced: 21.0 },
  1977: { sp: -7.2, balanced: -3.8 },
  1978: { sp: 6.6, balanced: 5.3 },
  1979: { sp: 18.4, balanced: 12.7 },
  1980: { sp: 32.5, balanced: 20.6 },
  1981: { sp: -4.9, balanced: -0.4 },
  1982: { sp: 21.6, balanced: 26.0 },
  1983: { sp: 22.6, balanced: 16.9 },
  1984: { sp: 6.3, balanced: 9.8 },
  1985: { sp: 31.7, balanced: 27.9 },
  1986: { sp: 18.7, balanced: 17.3 },
  1987: { sp: 5.3, balanced: 4.3 },
  1988: { sp: 16.6, balanced: 13.1 },
  1989: { sp: 31.7, balanced: 24.8 },
  1990: { sp: -3.1, balanced: 1.7 },
  1991: { sp: 30.5, balanced: 24.7 },
  1992: { sp: 7.6, balanced: 7.5 },
  1993: { sp: 10.1, balanced: 10.0 },
  1994: { sp: 1.3, balanced: -0.4 },
  1995: { sp: 37.6, balanced: 29.9 },
  1996: { sp: 23.0, balanced: 15.2 },
  1997: { sp: 33.4, balanced: 23.9 },
  1998: { sp: 28.6, balanced: 20.6 },
  1999: { sp: 21.0, balanced: 12.3 },
  2000: { sp: -9.1, balanced: -0.8 },
  2001: { sp: -11.9, balanced: -3.8 },
  2002: { sp: -22.1, balanced: -9.1 },
  2003: { sp: 28.7, balanced: 18.8 },
  2004: { sp: 10.9, balanced: 8.3 },
  2005: { sp: 4.9, balanced: 3.9 },
  2006: { sp: 15.8, balanced: 11.2 },
  2007: { sp: 5.5, balanced: 6.1 },
  2008: { sp: -37.0, balanced: -20.1 },
  2009: { sp: 26.5, balanced: 18.2 },
  2010: { sp: 15.1, balanced: 11.6 },
  2011: { sp: 2.1, balanced: 4.4 },
  2012: { sp: 16.0, balanced: 11.3 },
  2013: { sp: 32.4, balanced: 18.6 },
  2014: { sp: 13.7, balanced: 10.6 },
  2015: { sp: 1.4, balanced: 1.0 },
  2016: { sp: 12.0, balanced: 8.2 },
  2017: { sp: 21.8, balanced: 14.5 },
  2018: { sp: -4.4, balanced: -2.6 },
  2019: { sp: 31.5, balanced: 22.4 },
  2020: { sp: 18.4, balanced: 14.0 },
  2021: { sp: 28.7, balanced: 16.6 },
  2022: { sp: -18.1, balanced: -16.1 },
  2023: { sp: 26.3, balanced: 18.0 },
  2024: { sp: 25.0, balanced: 15.5 },
};

// The named periods the picker offers. `startYear` is the first retirement year,
// so the sequence lands the bad early years right at retirement (the worst case
// for sequence-of-returns risk). `blurb` is shown on the results card.
export const HISTORICAL_SCENARIOS = [
  {
    key: "dotcom2000",
    startYear: 2000,
    label: "Dot-com bust (2000)",
    blurb:
      "Retiring in 2000 meant three straight losing years (−9%, −12%, −22%) as the dot-com bubble unwound — a textbook bad start.",
  },
  {
    key: "gfc2007",
    startYear: 2007,
    label: "Global financial crisis (2007)",
    blurb:
      "Retiring in 2007 put the 2008 −37% crash in year two — the deepest single-year loss since the Great Depression.",
  },
  {
    key: "inflation2022",
    startYear: 2022,
    label: "2022 inflation shock",
    blurb:
      "Retiring in 2022 hit the rare year stocks and bonds fell together, so even a balanced portfolio dropped sharply.",
  },
  {
    key: "stagflation1973",
    startYear: 1973,
    label: "1973 stagflation",
    blurb:
      "Retiring in 1973 ran straight into the '73–74 bear market (−15%, −26%) and a decade of weak returns. Note: the era's high inflation is not separately modeled — only the market sequence.",
  },
];
