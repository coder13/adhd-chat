import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AsyncPersistenceBucket,
  clearPersistedValueAsync,
  hasPersistedValue,
  loadPersistedValueAsync,
  peekPersistedValue,
  savePersistedValueAsync,
} from '../lib/asyncPersistence';
import {
  clearPersistedValue,
  loadPersistedValue,
  savePersistedValue,
} from '../lib/persistence';

const inflightResourceLoads = new Map<string, Promise<unknown>>();
type PersistedResourceStorage = 'indexeddb' | 'localStorage';

interface UsePersistedResourceOptions<T> {
  cacheKey: string | null;
  enabled: boolean;
  initialValue: T;
  load: () => Promise<T>;
  preserveValue?: (currentValue: T, nextValue: T) => T;
  storage?: PersistedResourceStorage;
  bucket?: AsyncPersistenceBucket;
}

interface PersistedResourceSnapshot<T> {
  data: T;
  hasCachedData: boolean;
  hasResolvedData: boolean;
  isFetching: boolean;
  isHydratingCache: boolean;
}

function getPersistedResourceSnapshot<T>(
  cacheKey: string | null,
  enabled: boolean,
  initialValue: T,
  usesIndexedDb: boolean,
  bucket: AsyncPersistenceBucket
): PersistedResourceSnapshot<T> {
  if (!cacheKey) {
    return {
      data: initialValue,
      hasCachedData: false,
      hasResolvedData: !enabled,
      isFetching: false,
      isHydratingCache: false,
    };
  }

  if (!usesIndexedDb) {
    const cachedValue = loadPersistedValue<T>(cacheKey);
    const hasCachedData = cachedValue !== null;
    return {
      data: cachedValue ?? initialValue,
      hasCachedData,
      hasResolvedData: true,
      isFetching: enabled && !hasCachedData,
      isHydratingCache: false,
    };
  }

  const cachedValue = peekPersistedValue<T>(cacheKey, { bucket });
  if (cachedValue !== null) {
    return {
      data: cachedValue,
      hasCachedData: true,
      hasResolvedData: true,
      isFetching: false,
      isHydratingCache: false,
    };
  }

  const hasCachedData = hasPersistedValue(cacheKey, { bucket });
  return {
    data: initialValue,
    hasCachedData,
    hasResolvedData: !enabled && !hasCachedData,
    isFetching: false,
    isHydratingCache: true,
  };
}

export function usePersistedResource<T>({
  cacheKey,
  enabled,
  initialValue,
  load,
  preserveValue,
  storage = 'localStorage',
  bucket = 'resources',
}: UsePersistedResourceOptions<T>) {
  const usesIndexedDb = storage === 'indexeddb';
  const initialValueRef = useRef(initialValue);
  const loadRef = useRef(load);
  const preserveValueRef = useRef(preserveValue);
  const hasCachedDataRef = useRef(false);
  const initialSnapshot = getPersistedResourceSnapshot(
    cacheKey,
    enabled,
    initialValue,
    usesIndexedDb,
    bucket
  );
  const currentSnapshot = getPersistedResourceSnapshot(
    cacheKey,
    enabled,
    initialValue,
    usesIndexedDb,
    bucket
  );
  const resourceIdentity = `${storage}:${bucket}:${cacheKey ?? '__null__'}`;
  const previousResourceIdentityRef = useRef(resourceIdentity);
  const hasResourceIdentityChanged =
    previousResourceIdentityRef.current !== resourceIdentity;
  const dataRef = useRef(initialSnapshot.data);
  const [hasCachedData, setHasCachedData] = useState(
    initialSnapshot.hasCachedData
  );
  const [data, setResourceData] = useState<T>(initialSnapshot.data);
  const [error, setError] = useState<string | null>(null);
  const [isHydratingCache, setIsHydratingCache] = useState(
    initialSnapshot.isHydratingCache
  );
  const [hasResolvedData, setHasResolvedData] = useState(
    initialSnapshot.hasResolvedData
  );
  const [isFetching, setIsFetching] = useState(initialSnapshot.isFetching);
  const effectiveData = hasResourceIdentityChanged ? currentSnapshot.data : data;
  const effectiveHasCachedData = hasResourceIdentityChanged
    ? currentSnapshot.hasCachedData
    : hasCachedData;
  const effectiveHasResolvedData = hasResourceIdentityChanged
    ? currentSnapshot.hasResolvedData
    : hasResolvedData;
  const effectiveIsHydratingCache = hasResourceIdentityChanged
    ? currentSnapshot.isHydratingCache
    : isHydratingCache;
  const effectiveIsFetching = hasResourceIdentityChanged
    ? currentSnapshot.isFetching
    : isFetching;

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
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!hasResourceIdentityChanged) {
      return;
    }

    previousResourceIdentityRef.current = resourceIdentity;
    setResourceData(currentSnapshot.data);
    setError(null);
    setIsHydratingCache(currentSnapshot.isHydratingCache);
    setHasResolvedData(currentSnapshot.hasResolvedData);
    setIsFetching(currentSnapshot.isFetching);
    setHasCachedData(currentSnapshot.hasCachedData);
    hasCachedDataRef.current = currentSnapshot.hasCachedData;
    dataRef.current = currentSnapshot.data;
  }, [currentSnapshot, hasResourceIdentityChanged, resourceIdentity]);

  useEffect(() => {
    if (!usesIndexedDb) {
      return;
    }

    if (!cacheKey) {
      setResourceData(initialValueRef.current);
      setError(null);
      setIsHydratingCache(false);
      setHasResolvedData(!enabled);
      setIsFetching(false);
      setHasCachedData(false);
      hasCachedDataRef.current = false;
      dataRef.current = initialValueRef.current;
      return;
    }

    const cachedValue = peekPersistedValue<T>(cacheKey, { bucket });
    if (cachedValue !== null) {
      setResourceData(cachedValue);
      setError(null);
      setIsHydratingCache(false);
      setHasResolvedData(true);
      setIsFetching(false);
      setHasCachedData(true);
      hasCachedDataRef.current = true;
      dataRef.current = cachedValue;
      return;
    }

    const nextHasCachedData = hasPersistedValue(cacheKey, { bucket });
    let cancelled = false;
    setIsHydratingCache(true);
    setError(null);
    setIsFetching(false);
    setHasResolvedData(!enabled && !nextHasCachedData);
    setHasCachedData(nextHasCachedData);
    hasCachedDataRef.current = nextHasCachedData;
    dataRef.current = initialValueRef.current;
    setResourceData(initialValueRef.current);

    void loadPersistedValueAsync<T>(cacheKey, { bucket })
      .then((cachedValue) => {
        if (cancelled) {
          return;
        }

        const nextHasCachedData = cachedValue !== null;
        const nextValue = cachedValue ?? initialValueRef.current;
        setResourceData(nextValue);
        setHasCachedData(nextHasCachedData);
        hasCachedDataRef.current = nextHasCachedData;
        dataRef.current = nextValue;
      })
      .catch((cause) => {
        if (cancelled) {
          return;
        }

        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsHydratingCache(false);
        setHasResolvedData((currentValue) => currentValue || !enabled);
      });

    return () => {
      cancelled = true;
    };
  }, [bucket, cacheKey, enabled, usesIndexedDb]);

  useEffect(() => {
    if (usesIndexedDb) {
      return;
    }

    if (!cacheKey) {
      setResourceData(initialValueRef.current);
      setError(null);
      setIsFetching(false);
      setIsHydratingCache(false);
      setHasResolvedData(!enabled);
      setHasCachedData(false);
      hasCachedDataRef.current = false;
      dataRef.current = initialValueRef.current;
      return;
    }

    const cachedValue = loadPersistedValue<T>(cacheKey);
    const nextHasCachedData = cachedValue !== null;
    const nextValue = cachedValue ?? initialValueRef.current;
    setResourceData(nextValue);
    setError(null);
    setIsFetching(enabled && !nextHasCachedData);
    setIsHydratingCache(false);
    setHasResolvedData(true);
    setHasCachedData(nextHasCachedData);
    hasCachedDataRef.current = nextHasCachedData;
    dataRef.current = nextValue;
  }, [cacheKey, enabled, usesIndexedDb]);

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
      setResourceData((currentValue) => {
        resolvedValue = preserveValueRef.current
          ? preserveValueRef.current(currentValue, nextValue)
          : nextValue;
        return resolvedValue;
      });
      dataRef.current = resolvedValue;
      setHasResolvedData(true);
      setError(null);
      if (usesIndexedDb) {
        void savePersistedValueAsync(cacheKey, resolvedValue, { bucket });
      } else {
        savePersistedValue(cacheKey, resolvedValue);
      }
      setHasCachedData(true);
      hasCachedDataRef.current = true;
    } catch (cause) {
      setHasResolvedData(true);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsFetching(false);
    }
  }, [bucket, cacheKey, enabled, usesIndexedDb]);

  const updateData = useCallback(
    (updater: T | ((currentValue: T) => T)) => {
      const currentValue = dataRef.current;
      const nextValue =
        typeof updater === 'function'
          ? (updater as (currentValue: T) => T)(currentValue)
          : updater;

      dataRef.current = nextValue;
      setResourceData(nextValue);
      setHasResolvedData(true);
      setError(null);

      if (!cacheKey) {
        return nextValue;
      }

      if (usesIndexedDb) {
        void savePersistedValueAsync(cacheKey, nextValue, { bucket });
      } else {
        savePersistedValue(cacheKey, nextValue);
      }
      setHasCachedData(true);
      hasCachedDataRef.current = true;
      return nextValue;
    },
    [bucket, cacheKey, usesIndexedDb]
  );

  useEffect(() => {
    if (!enabled || !cacheKey || (usesIndexedDb && effectiveIsHydratingCache)) {
      return;
    }

    void refresh();
  }, [cacheKey, effectiveIsHydratingCache, enabled, refresh, usesIndexedDb]);

  const clear = useCallback(() => {
    if (!cacheKey) {
      return;
    }

    if (usesIndexedDb) {
      void clearPersistedValueAsync(cacheKey, { bucket });
    } else {
      clearPersistedValue(cacheKey);
    }
    setResourceData(initialValueRef.current);
    setError(null);
    setIsFetching(false);
    setIsHydratingCache(false);
    setHasResolvedData(!enabled);
    setHasCachedData(false);
    hasCachedDataRef.current = false;
    dataRef.current = initialValueRef.current;
  }, [bucket, cacheKey, enabled, usesIndexedDb]);

  const isLoading =
    usesIndexedDb
      ? (effectiveIsHydratingCache || effectiveIsFetching) &&
        !effectiveHasResolvedData
      : effectiveIsFetching && !effectiveHasCachedData;
  const isRefreshing =
    usesIndexedDb
      ? effectiveIsFetching && effectiveHasResolvedData
      : effectiveIsFetching && effectiveHasCachedData;

  return {
    data: effectiveData,
    error,
    isLoading,
    isRefreshing,
    refresh,
    updateData,
    clear,
    hasCachedData: effectiveHasCachedData,
  };
}
