import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { AsyncPersistenceBucket } from '../lib/asyncPersistence';
import { getMatrixViewResource } from '../lib/matrix/store/matrixViewStore';
import type { MatrixViewResourceStorage } from '../lib/matrix/store/types';

interface UseMatrixViewResourceOptions<T> {
  bucket?: AsyncPersistenceBucket;
  cacheKey: string | null;
  enabled: boolean;
  initialValue: T;
  load: () => Promise<T>;
  preserveValue?: (currentValue: T, nextValue: T) => T;
  storage?: MatrixViewResourceStorage;
}

const EMPTY_SUBSCRIBE = () => () => {};
const NOOP_CLEAR = () => {};
const NOOP_REFRESH = async () => {};
const NOOP_UPDATE_DATA = <T,>(updater: T | ((currentValue: T) => T), initialValue: T) =>
  typeof updater === 'function'
    ? (updater as (currentValue: T) => T)(initialValue)
    : updater;

export function useMatrixViewResource<T>({
  bucket = 'resources',
  cacheKey,
  enabled,
  initialValue,
  load,
  preserveValue,
  storage = 'localStorage',
}: UseMatrixViewResourceOptions<T>) {
  const config = useMemo(
    () => ({
      bucket,
      enabled,
      initialValue,
      load,
      preserveValue,
      storage,
    }),
    [bucket, enabled, initialValue, load, preserveValue, storage]
  );

  const resource = useMemo(() => {
    if (!cacheKey) {
      return null;
    }

    return getMatrixViewResource(cacheKey, config);
  }, [cacheKey, config]);

  useEffect(() => {
    if (!resource) {
      return;
    }

    resource.setConfig(config);
  }, [config, resource]);

  const emptySnapshot = useMemo(
    () => ({
      data: initialValue,
      error: null,
      hasCachedData: false,
      isLoading: false,
      isRefreshing: false,
    }),
    [initialValue]
  );

  const snapshot = useSyncExternalStore(
    resource ? resource.subscribe : EMPTY_SUBSCRIBE,
    resource ? resource.getSnapshot : () => emptySnapshot,
    resource ? resource.getSnapshot : () => emptySnapshot
  );

  const updateData = useCallback(
    (updater: T | ((currentValue: T) => T)) =>
      resource
        ? resource.updateData(updater)
        : NOOP_UPDATE_DATA(updater, initialValue),
    [initialValue, resource]
  );

  return useMemo(
    () => ({
      ...snapshot,
      clear: resource ? resource.clear : NOOP_CLEAR,
      refresh: resource ? resource.refresh : NOOP_REFRESH,
      updateData,
    }),
    [resource, snapshot, updateData]
  );
}
