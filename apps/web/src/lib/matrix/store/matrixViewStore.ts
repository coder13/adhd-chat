import {
  clearPersistedValueAsync,
  hasPersistedValue,
  loadPersistedValueAsync,
  peekPersistedValue,
  savePersistedValueAsync,
} from '../../asyncPersistence';
import {
  clearPersistedValue,
  loadPersistedValue,
  savePersistedValue,
} from '../../persistence';
import type { AsyncPersistenceBucket } from '../../asyncPersistence';
import type {
  MatrixViewResource,
  MatrixViewResourceConfig,
  MatrixViewResourceSnapshot,
  MatrixViewResourceState,
  MatrixViewResourceStorage,
} from './types';

const resources = new Map<string, MatrixViewResource<unknown>>();

function buildStoreKey(
  cacheKey: string,
  storage: MatrixViewResourceStorage,
  bucket: AsyncPersistenceBucket
) {
  return `${storage}:${bucket}:${cacheKey}`;
}

function resolveInitialState<T>(
  cacheKey: string,
  config: MatrixViewResourceConfig<T>
): MatrixViewResourceState<T> {
  const usesIndexedDb = config.storage === 'indexeddb';
  const initialCachedValue = usesIndexedDb
    ? peekPersistedValue<T>(cacheKey, { bucket: config.bucket })
    : loadPersistedValue<T>(cacheKey);

  if (usesIndexedDb) {
    const hasCachedData =
      initialCachedValue !== null ||
      hasPersistedValue(cacheKey, { bucket: config.bucket });

    return {
      data: initialCachedValue ?? config.initialValue,
      error: null,
      hasCachedData,
      hasResolvedData: !config.enabled || initialCachedValue !== null,
      isFetching: false,
      isHydratingCache: initialCachedValue === null,
    };
  }

  return {
    data: initialCachedValue ?? config.initialValue,
    error: null,
    hasCachedData: initialCachedValue !== null,
    hasResolvedData: true,
    isFetching: config.enabled && initialCachedValue === null,
    isHydratingCache: false,
  };
}

function createMatrixViewResource<T>(
  cacheKey: string,
  initialConfig: MatrixViewResourceConfig<T>
): MatrixViewResource<T> {
  let config = initialConfig;
  let state = resolveInitialState(cacheKey, initialConfig);
  let snapshot = buildSnapshot(state, initialConfig.storage);
  let hydratePromise: Promise<void> | null = null;
  let startedInitialRefresh = false;
  let refreshPromise: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const setState = (
    updater:
      | MatrixViewResourceState<T>
      | ((currentState: MatrixViewResourceState<T>) => MatrixViewResourceState<T>)
  ) => {
    state =
      typeof updater === 'function'
        ? (updater as (currentState: MatrixViewResourceState<T>) => MatrixViewResourceState<T>)(state)
        : updater;
    snapshot = buildSnapshot(state, config.storage);
    emit();
  };

  const persistValue = (value: T) => {
    if (config.storage === 'indexeddb') {
      void savePersistedValueAsync(cacheKey, value, { bucket: config.bucket });
      return;
    }

    savePersistedValue(cacheKey, value);
  };

  const hydrateIndexedDbCache = () => {
    if (config.storage !== 'indexeddb' || hydratePromise) {
      return hydratePromise;
    }

    if (!state.isHydratingCache) {
      return null;
    }

    hydratePromise = loadPersistedValueAsync<T>(cacheKey, {
      bucket: config.bucket,
    })
      .then((cachedValue) => {
        setState((currentState) => ({
          ...currentState,
          data: cachedValue ?? currentState.data,
          error: null,
          hasCachedData: cachedValue !== null,
        }));
      })
      .catch((cause) => {
        setState((currentState) => ({
          ...currentState,
          error: cause instanceof Error ? cause.message : String(cause),
        }));
      })
      .finally(() => {
        hydratePromise = null;
        setState((currentState) => ({
          ...currentState,
          hasResolvedData: currentState.hasResolvedData || !config.enabled,
          isHydratingCache: false,
        }));
        ensureStarted();
      });

    return hydratePromise;
  };

  const refresh = async () => {
    if (!config.enabled) {
      return;
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    setState((currentState) => ({
      ...currentState,
      isFetching: true,
    }));

    refreshPromise = config
      .load()
      .then((nextValue) => {
        let resolvedValue = nextValue;

        setState((currentState) => {
          resolvedValue = config.preserveValue
            ? config.preserveValue(currentState.data, nextValue)
            : nextValue;

          return {
            ...currentState,
            data: resolvedValue,
            error: null,
            hasCachedData: true,
            hasResolvedData: true,
          };
        });

        persistValue(resolvedValue);
      })
      .catch((cause) => {
        setState((currentState) => ({
          ...currentState,
          error: cause instanceof Error ? cause.message : String(cause),
          hasResolvedData: true,
        }));
      })
      .finally(() => {
        refreshPromise = null;
        setState((currentState) => ({
          ...currentState,
          isFetching: false,
        }));
      });

    return refreshPromise;
  };

  const ensureStarted = () => {
    if (!config.enabled) {
      return;
    }

    if (config.storage === 'indexeddb' && state.isHydratingCache) {
      void hydrateIndexedDbCache();
      return;
    }

    if (startedInitialRefresh) {
      return;
    }

    startedInitialRefresh = true;
    void refresh();
  };

  return {
    clear: () => {
      if (config.storage === 'indexeddb') {
        void clearPersistedValueAsync(cacheKey, { bucket: config.bucket });
      } else {
        clearPersistedValue(cacheKey);
      }

      startedInitialRefresh = false;
      setState({
        data: config.initialValue,
        error: null,
        hasCachedData: false,
        hasResolvedData: !config.enabled,
        isFetching: false,
        isHydratingCache: false,
      });
    },
    getSnapshot: () => snapshot,
    refresh,
    setConfig: (nextConfig) => {
      const storageChanged =
        nextConfig.storage !== config.storage || nextConfig.bucket !== config.bucket;

      config = nextConfig;

      if (storageChanged) {
        state = resolveInitialState(cacheKey, nextConfig);
        snapshot = buildSnapshot(state, nextConfig.storage);
        startedInitialRefresh = false;
        emit();
      }

      ensureStarted();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      ensureStarted();

      return () => {
        listeners.delete(listener);
      };
    },
    updateData: (updater) => {
      let resolvedValue = state.data;

      setState((currentState) => {
        resolvedValue =
          typeof updater === 'function'
            ? (updater as (currentValue: T) => T)(currentState.data)
            : updater;

        return {
          ...currentState,
          data: resolvedValue,
          error: null,
          hasCachedData: true,
          hasResolvedData: true,
        };
      });

      persistValue(resolvedValue);
      return resolvedValue;
    },
  };
}

function buildSnapshot<T>(
  state: MatrixViewResourceState<T>,
  storage: MatrixViewResourceStorage
): MatrixViewResourceSnapshot<T> {
  return {
    data: state.data,
    error: state.error,
    hasCachedData: state.hasCachedData,
    isLoading:
      storage === 'indexeddb'
        ? (state.isHydratingCache || state.isFetching) && !state.hasResolvedData
        : state.isFetching && !state.hasCachedData,
    isRefreshing:
      storage === 'indexeddb'
        ? state.isFetching && state.hasResolvedData
        : state.isFetching && state.hasCachedData,
  };
}

export function getMatrixViewResource<T>(
  cacheKey: string,
  config: MatrixViewResourceConfig<T>
) {
  const storeKey = buildStoreKey(cacheKey, config.storage, config.bucket);
  const existingResource = resources.get(storeKey) as
    | MatrixViewResource<T>
    | undefined;

  if (existingResource) {
    return existingResource;
  }

  const resource = createMatrixViewResource(cacheKey, config);
  resources.set(storeKey, resource as MatrixViewResource<unknown>);
  return resource;
}
