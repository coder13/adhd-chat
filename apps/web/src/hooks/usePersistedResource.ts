import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearPersistedValue,
  loadPersistedValue,
  savePersistedValue,
} from '../lib/persistence';

const inflightResourceLoads = new Map<string, Promise<unknown>>();

interface UsePersistedResourceOptions<T> {
  cacheKey: string | null;
  enabled: boolean;
  initialValue: T;
  load: () => Promise<T>;
  preserveValue?: (currentValue: T, nextValue: T) => T;
}

export function usePersistedResource<T>({
  cacheKey,
  enabled,
  initialValue,
  load,
  preserveValue,
}: UsePersistedResourceOptions<T>) {
  const initialValueRef = useRef(initialValue);
  const loadRef = useRef(load);
  const preserveValueRef = useRef(preserveValue);
  const hasCachedDataRef = useRef(false);
  const [hasCachedData, setHasCachedData] = useState(() =>
    cacheKey ? loadPersistedValue<T>(cacheKey) !== null : false
  );
  const [data, setData] = useState<T>(() => {
    if (!cacheKey) {
      return initialValueRef.current;
    }

    return loadPersistedValue<T>(cacheKey) ?? initialValueRef.current;
  });
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(enabled && !hasCachedData);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    preserveValueRef.current = preserveValue;
  }, [preserveValue]);

  useEffect(() => {
    if (!cacheKey) {
      setData(initialValueRef.current);
      setError(null);
      setIsFetching(false);
      setHasCachedData(false);
      hasCachedDataRef.current = false;
      return;
    }

    const cachedValue = loadPersistedValue<T>(cacheKey);
    const nextHasCachedData = cachedValue !== null;
    setData(cachedValue ?? initialValueRef.current);
    setError(null);
    setIsFetching(enabled && !nextHasCachedData);
    setHasCachedData(nextHasCachedData);
    hasCachedDataRef.current = nextHasCachedData;
  }, [cacheKey, enabled]);

  const refresh = useCallback(async () => {
    if (!enabled || !cacheKey) {
      return;
    }

    setIsFetching(true);

    try {
      const existingLoad = inflightResourceLoads.get(cacheKey) as
        | Promise<T>
        | undefined;
      const loadPromise =
        existingLoad ??
        loadRef.current().finally(() => {
          if (inflightResourceLoads.get(cacheKey) === loadPromise) {
            inflightResourceLoads.delete(cacheKey);
          }
        });

      if (!existingLoad) {
        inflightResourceLoads.set(cacheKey, loadPromise);
      }

      const nextValue: T = await loadPromise;
      let resolvedValue: T = nextValue;
      setData((currentValue) => {
        resolvedValue = preserveValueRef.current
          ? preserveValueRef.current(currentValue, nextValue)
          : nextValue;
        return resolvedValue;
      });
      setError(null);
      savePersistedValue(cacheKey, resolvedValue);
      setHasCachedData(true);
      hasCachedDataRef.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsFetching(false);
    }
  }, [cacheKey, enabled]);

  useEffect(() => {
    if (!enabled || !cacheKey) {
      return;
    }

    void refresh();
  }, [cacheKey, enabled, refresh]);

  const clear = useCallback(() => {
    if (!cacheKey) {
      return;
    }

    clearPersistedValue(cacheKey);
    setData(initialValueRef.current);
    setError(null);
    setIsFetching(false);
    setHasCachedData(false);
    hasCachedDataRef.current = false;
  }, [cacheKey]);

  const isLoading = isFetching && !hasCachedData;
  const isRefreshing = isFetching && hasCachedData;

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
    clear,
    hasCachedData,
  };
}
