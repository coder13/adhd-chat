const STORAGE_PREFIX = 'adhd-chat.cache.v1';

interface PersistedValue<T> {
  updatedAt: number;
  value: T;
}

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}:${key}`;
}

export function loadPersistedValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedValue<T>;
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
    localStorage.setItem(getStorageKey(key), JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to persist cached value', error);
  }
}

export function clearPersistedValue(key: string) {
  try {
    localStorage.removeItem(getStorageKey(key));
  } catch (error) {
    console.error('Failed to clear cached value', error);
  }
}
