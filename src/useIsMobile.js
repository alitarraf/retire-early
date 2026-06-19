// Viewport breakpoint hook. Inline styles can't carry media queries, so the
// app detects "mobile" in JS and renders a dedicated single-column shell below
// the breakpoint (desktop layout is left untouched above it).
//
// SSR/test-safe: when there's no `window`/`matchMedia` (node/vitest), it returns
// false so renderToString(<App/>) stays on the desktop tree and existing
// regression assertions hold.
import { useState, useEffect } from "react";

const QUERY = "(max-width: 767px)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches); // sync in case it changed before effect ran
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
