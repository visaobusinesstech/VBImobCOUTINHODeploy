import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1280; // matches Tailwind xl

function useMediaBelow(breakpoint: number) {
  const [matches, setMatches] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setMatches(window.innerWidth < breakpoint);
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [breakpoint]);

  return matches;
}

export function useIsMobile() {
  return useMediaBelow(MOBILE_BREAKPOINT);
}

/** True for anything below Tailwind `xl` (i.e. mobile + tablet + small laptop). */
export function useIsBelowDesktop() {
  return useMediaBelow(DESKTOP_BREAKPOINT);
}
