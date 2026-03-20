import {
  clearPersistedValue,
  loadPersistedValue,
  savePersistedValue,
} from './persistence';

const DB_NAME = 'adhd-chat-cache-v1';
const DB_VERSION = 2;
const METADATA_PREFIX = 'adhd-chat.cache-meta.v1';
const DEFAULT_BUCKET = 'resources';

export const ASYNC_PERSISTENCE_BUCKETS = [
  'resources',
  'drafts',
  'pending-actions',
  'shared-data',
] as const;

export type AsyncPersistenceBucket = (typeof ASYNC_PERSISTENCE_BUCKETS)[number];

interface AsyncPersistenceOptions {
  bucket?: AsyncPersistenceBucket;
}

interface PersistedValue<T> {
  updatedAt: number;
  value: T;
}

const memoryCache = new Map<string, PersistedValue<unknown>>();
let openDatabasePromise: Promise<IDBDatabase> | null = null;
let indexedDbFailed = false;

function resolveBucket(bucket?: AsyncPersistenceBucket) {
  return bucket ?? DEFAULT_BUCKET;
}

function getMemoryCacheKey(key: string, bucket?: AsyncPersistenceBucket) {
  return `${resolveBucket(bucket)}:${key}`;
}

function getMetadataKey(key: string, bucket?: AsyncPersistenceBucket) {
  return `${METADATA_PREFIX}:${resolveBucket(bucket)}:${key}`;
}

function getFallbackStorageKey(key: string, bucket?: AsyncPersistenceBucket) {
  const resolvedBucket = resolveBucket(bucket);
  if (resolvedBucket === DEFAULT_BUCKET) {
    return key;
  }

  return `indexeddb:${resolvedBucket}:${key}`;
}

function canUseIndexedDb() {
  return (
    !indexedDbFailed &&
    typeof indexedDB !== 'undefined' &&
    indexedDB !== null
  );
}

function markIndexedDbFailure(error: unknown) {
  indexedDbFailed = true;
  console.error('IndexedDB persistence unavailable, falling back to localStorage', error);
}

function setPersistedMetadata(
  key: string,
  updatedAt: number,
  bucket?: AsyncPersistenceOptions['bucket']
) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(getMetadataKey(key, bucket), String(updatedAt));
  } catch (error) {
    console.error('Failed to update persistence metadata', error);
  }
}

function clearPersistedMetadata(key: string, bucket?: AsyncPersistenceOptions['bucket']) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(getMetadataKey(key, bucket));
  } catch (error) {
    console.error('Failed to clear persistence metadata', error);
  }
}

function openDatabase() {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }

  if (openDatabasePromise) {
    return openDatabasePromise;
  }

  openDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      ASYNC_PERSISTENCE_BUCKETS.forEach((bucket) => {
        if (!database.objectStoreNames.contains(bucket)) {
          database.createObjectStore(bucket);
        }
      });
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onclose = () => {
        openDatabasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open persistence database.'));
    };

    request.onblocked = () => {
      reject(new Error('Persistence database is blocked.'));
    };
  }).catch((error) => {
    openDatabasePromise = null;
    markIndexedDbFailure(error);
    throw error;
  });

  return openDatabasePromise;
}

async function runStoreRequest<T>(
  bucket: AsyncPersistenceBucket,
  mode: IDBTransactionMode,
  requestFactory: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(bucket, mode);
    const store = transaction.objectStore(bucket);
    const request = requestFactory(store);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Persistence request failed.'));
    };
  });
}

export function peekPersistedValue<T>(
  key: string,
  options?: AsyncPersistenceOptions
): T | null {
  const memoryCacheKey = getMemoryCacheKey(key, options?.bucket);
  const cachedValue = memoryCache.get(memoryCacheKey) as
    | PersistedValue<T>
    | undefined;
  if (cachedValue) {
    return cachedValue.value;
  }

  if (!canUseIndexedDb()) {
    return loadPersistedValue<T>(getFallbackStorageKey(key, options?.bucket));
  }

  return null;
}

export function hasPersistedValue(key: string, options?: AsyncPersistenceOptions) {
  const memoryCacheKey = getMemoryCacheKey(key, options?.bucket);
  if (memoryCache.has(memoryCacheKey)) {
    return true;
  }

  if (typeof localStorage === 'undefined') {
    return false;
  }

  try {
    if (localStorage.getItem(getMetadataKey(key, options?.bucket)) !== null) {
      return true;
    }
  } catch (error) {
    console.error('Failed to read persistence metadata', error);
  }

  if (!canUseIndexedDb()) {
    return (
      loadPersistedValue(getFallbackStorageKey(key, options?.bucket)) !== null
    );
  }

  return false;
}

export async function loadPersistedValueAsync<T>(
  key: string,
  options?: AsyncPersistenceOptions
): Promise<T | null> {
  const bucket = resolveBucket(options?.bucket);
  const memoryCacheKey = getMemoryCacheKey(key, bucket);
  const fallbackStorageKey = getFallbackStorageKey(key, bucket);
  const cachedValue = memoryCache.get(memoryCacheKey) as
    | PersistedValue<T>
    | undefined;
  if (cachedValue) {
    return cachedValue.value;
  }

  if (!canUseIndexedDb()) {
    return loadPersistedValue<T>(fallbackStorageKey);
  }

  try {
    const payload =
      (await runStoreRequest<PersistedValue<T> | undefined>(
        bucket,
        'readonly',
        (store) => store.get(key) as IDBRequest<PersistedValue<T> | undefined>
      )) ?? null;

    if (!payload) {
      clearPersistedMetadata(key, bucket);
      return null;
    }

    memoryCache.set(memoryCacheKey, payload as PersistedValue<unknown>);
    setPersistedMetadata(key, payload.updatedAt, bucket);
    clearPersistedValue(fallbackStorageKey);
    return payload.value;
  } catch (error) {
    markIndexedDbFailure(error);
    return loadPersistedValue<T>(fallbackStorageKey);
  }
}

export async function savePersistedValueAsync<T>(
  key: string,
  value: T,
  options?: AsyncPersistenceOptions
) {
  const bucket = resolveBucket(options?.bucket);
  const memoryCacheKey = getMemoryCacheKey(key, bucket);
  const fallbackStorageKey = getFallbackStorageKey(key, bucket);
  const payload: PersistedValue<T> = {
    updatedAt: Date.now(),
    value,
  };

  memoryCache.set(memoryCacheKey, payload as PersistedValue<unknown>);
  setPersistedMetadata(key, payload.updatedAt, bucket);

  if (!canUseIndexedDb()) {
    savePersistedValue(fallbackStorageKey, value);
    return;
  }

  try {
    await runStoreRequest(bucket, 'readwrite', (store) => store.put(payload, key));
    clearPersistedValue(fallbackStorageKey);
  } catch (error) {
    markIndexedDbFailure(error);
    savePersistedValue(fallbackStorageKey, value);
  }
}

export async function clearPersistedValueAsync(
  key: string,
  options?: AsyncPersistenceOptions
) {
  const bucket = resolveBucket(options?.bucket);
  const memoryCacheKey = getMemoryCacheKey(key, bucket);
  const fallbackStorageKey = getFallbackStorageKey(key, bucket);
  memoryCache.delete(memoryCacheKey);
  clearPersistedMetadata(key, bucket);

  if (!canUseIndexedDb()) {
    clearPersistedValue(fallbackStorageKey);
    return;
  }

  try {
    await runStoreRequest(bucket, 'readwrite', (store) => store.delete(key));
    clearPersistedValue(fallbackStorageKey);
  } catch (error) {
    markIndexedDbFailure(error);
    clearPersistedValue(fallbackStorageKey);
  }
}
