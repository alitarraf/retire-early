export const fmt = (n) =>
  n < 0
    ? `-$${Math.abs(Math.round(n)).toLocaleString()}`
    : `$${Math.round(n).toLocaleString()}`;

export const pct = (n) => `${Number(n).toFixed(2)}%`;
