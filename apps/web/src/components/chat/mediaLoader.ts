const MAX_CACHED_MEDIA_ENTRIES = 48;

type MediaCacheEntry = {
  objectUrl: string;
  touchedAt: number;
};

const mediaCache = new Map<string, MediaCacheEntry>();
const inflightLoads = new Map<string, Promise<string>>();

function getCacheKey(mediaUrl: string, accessToken: string | null) {
  return `${accessToken ?? ''}::${mediaUrl}`;
}

function touchCacheEntry(key: string, objectUrl: string) {
  mediaCache.delete(key);
  mediaCache.set(key, {
    objectUrl,
    touchedAt: Date.now(),
  });

  while (mediaCache.size > MAX_CACHED_MEDIA_ENTRIES) {
    const oldestKey = mediaCache.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }

    const oldestEntry = mediaCache.get(oldestKey);
    mediaCache.delete(oldestKey);
    if (oldestEntry) {
      URL.revokeObjectURL(oldestEntry.objectUrl);
    }
  }
}

export function getCachedMediaObjectUrl(
  mediaUrl: string,
  accessToken: string | null
) {
  const key = getCacheKey(mediaUrl, accessToken);
  const cachedEntry = mediaCache.get(key);
  if (!cachedEntry) {
    return null;
  }

  touchCacheEntry(key, cachedEntry.objectUrl);
  return cachedEntry.objectUrl;
}

export async function resolveMediaUrl(
  mediaUrl: string,
  accessToken: string | null
) {
  if (!accessToken) {
    return mediaUrl;
  }

  const key = getCacheKey(mediaUrl, accessToken);
  const cachedUrl = getCachedMediaObjectUrl(mediaUrl, accessToken);
  if (cachedUrl) {
    return cachedUrl;
  }

  const existingLoad = inflightLoads.get(key);
  if (existingLoad) {
    return existingLoad;
  }

  const loadPromise = (async () => {
    const response = await fetch(mediaUrl, {
      cache: 'force-cache',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load media (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    touchCacheEntry(key, objectUrl);
    return objectUrl;
  })();

  inflightLoads.set(key, loadPromise);

  try {
    return await loadPromise;
  } finally {
    inflightLoads.delete(key);
  }
}

export function clearResolvedMediaCache() {
  inflightLoads.clear();
  mediaCache.forEach((entry) => {
    URL.revokeObjectURL(entry.objectUrl);
  });
  mediaCache.clear();
}
