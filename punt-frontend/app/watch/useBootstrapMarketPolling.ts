"use client";

import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 3500;

type Options = {
  intervalMs?: number;
};

export function useBootstrapMarketPolling(enabled: boolean, refresh: () => Promise<unknown>, options?: Options) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const interval = Math.max(500, options?.intervalMs ?? DEFAULT_INTERVAL_MS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) return;
    let cancelled = false;
    let timeoutId: number | null = null;

    const tick = () => {
      refreshRef.current().catch(err => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[watch] bootstrap refresh failed", err);
        }
      }).finally(() => {
        if (!cancelled) {
          timeoutId = window.setTimeout(tick, interval);
        }
      });
    };

    timeoutId = window.setTimeout(tick, 0);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, interval]);
}
