import { useEffect, useState } from "react";

/** Current time, refreshed on an interval while `active`. Keeps Date.now() out of render. */
export function useNow(active: boolean, interval = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [active, interval]);
  return now;
}
