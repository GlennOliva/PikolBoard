import { useCallback, useEffect, useRef, useState } from "react";

import { messageFrom } from "@/lib/errors";

export interface AsyncData<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Re-runs the loader; keeps the previous data visible until it resolves. */
  reload: () => Promise<void>;
  setData: (updater: T | null) => void;
}

/**
 * Loads async data for a screen with a manual `reload` for pull-to-refresh and
 * realtime triggers. A late response from a superseded call is discarded so a
 * fast second refetch cannot be overwritten by a slow first one.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  options: { pollMs?: number } = {},
): AsyncData<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await loaderRef.current();
      if (id !== requestId.current) return;
      setDataState(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(messageFrom(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!options.pollMs) return;
    const timer = setInterval(() => {
      void run();
    }, options.pollMs);
    return () => clearInterval(timer);
  }, [options.pollMs, run]);

  return {
    data,
    error,
    loading,
    reload: run,
    setData: (updater) =>
      setDataState((current) =>
        typeof updater === "function"
          ? (updater as (prev: T | null) => T | null)(current)
          : updater,
      ),
  };
}
