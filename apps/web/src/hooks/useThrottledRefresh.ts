import { useCallback, useEffect, useRef } from 'react';

interface UseThrottledRefreshOptions {
  intervalMs?: number;
}

export function useThrottledRefresh(
  refresh: () => Promise<unknown>,
  options?: UseThrottledRefreshOptions
) {
  const intervalMs = options?.intervalMs ?? 3000;
  const refreshRef = useRef(refresh);
  const lastRunAtRef = useRef(0);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  return useCallback(
    (force = false) => {
      const now = Date.now();
      const elapsed = now - lastRunAtRef.current;

      if (!force && elapsed < intervalMs) {
        if (timeoutIdRef.current === null) {
          timeoutIdRef.current = window.setTimeout(() => {
            timeoutIdRef.current = null;
            void refreshRef.current();
            lastRunAtRef.current = Date.now();
          }, intervalMs - elapsed);
        }
        return;
      }

      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      if (inFlightRef.current) {
        return;
      }

      lastRunAtRef.current = now;
      const nextRefresh = refreshRef.current();
      inFlightRef.current = nextRefresh;
      void nextRefresh.finally(() => {
        if (inFlightRef.current === nextRefresh) {
          inFlightRef.current = null;
        }
      });
    },
    [intervalMs]
  );
}
