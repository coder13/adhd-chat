const STORAGE_PREFIX = 'adhd-chat.cache.v1';

interface PersistedValue<T> {
  updatedAt: number;
  value: T;
}

const memoryCache = new Map<string, PersistedValue<unknown>>();

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}:${key}`;
}

export function loadPersistedValue<T>(key: string): T | null {
  const storageKey = getStorageKey(key);
  const memoryValue = memoryCache.get(storageKey) as PersistedValue<T> | undefined;
  if (memoryValue) {
    return memoryValue.value;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedValue<T>;
    if (parsed?.value !== undefined) {
      memoryCache.set(storageKey, parsed as PersistedValue<unknown>);
    }
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}

export function savePersistedValue<T>(key: string, value: T) {
  try {
    const payload: PersistedValue<T> = {
      updatedAt: Date.now(),
      value,
    };
    const storageKey = getStorageKey(key);
    memoryCache.set(storageKey, payload as PersistedValue<unknown>);
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to persist cached value', error);
  }
}

export function clearPersistedValue(key: string) {
  try {
    const storageKey = getStorageKey(key);
    memoryCache.delete(storageKey);
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Failed to clear cached value', error);
  }
}
