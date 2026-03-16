import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { usePersistedResource } from './usePersistedResource';
import {
  attachTandemPreferencesListener,
  getTandemPreferences,
  setChatViewMode,
  type ChatViewMode,
  type TandemPreferences,
} from '../lib/matrix/preferences';

export function useChatPreferences(
  client: MatrixClient | null,
  currentUserId: string | null | undefined
) {
  const cacheKey = currentUserId ? `tandem-preferences:${currentUserId}` : null;
  const {
    data: preferences,
    refresh,
  } = usePersistedResource<TandemPreferences>({
    cacheKey,
    enabled: Boolean(client && currentUserId),
    initialValue: {
      chatViewMode: 'timeline',
    },
    load: async () => (client ? getTandemPreferences(client) : { chatViewMode: 'timeline' }),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !currentUserId) {
      return;
    }

    return attachTandemPreferencesListener(client, refresh);
  }, [client, currentUserId, refresh]);

  const updateChatViewMode = useCallback(
    async (chatViewMode: ChatViewMode) => {
      if (!client) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await setChatViewMode(client, chatViewMode);
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setIsSaving(false);
      }
    },
    [client, refresh]
  );

  return {
    preferences,
    updateChatViewMode,
    isSaving,
    error,
  };
}
