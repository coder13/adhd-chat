import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { usePersistedResource } from './usePersistedResource';
import {
  attachTandemPreferencesListener,
  getResolvedRoomNotificationMode,
  getTandemPreferences,
  setAccountNotificationMode,
  setChatViewMode,
  setRoomNotificationMode,
  type ChatViewMode,
  type NotificationMode,
  type RoomNotificationMode,
  type TandemPreferences,
} from '../lib/matrix/preferences';

export function useChatPreferences(
  client: MatrixClient | null,
  currentUserId: string | null | undefined
) {
  const cacheKey = currentUserId ? `tandem-preferences:${currentUserId}` : null;
  const { data: preferences, refresh } =
    usePersistedResource<TandemPreferences>({
      cacheKey,
      enabled: Boolean(client && currentUserId),
      initialValue: {
        chatViewMode: 'timeline',
        accountNotificationMode: 'all',
        roomNotificationOverrides: {},
      },
      load: async () =>
        client
          ? getTandemPreferences(client)
          : {
              chatViewMode: 'timeline',
              accountNotificationMode: 'all',
              roomNotificationOverrides: {},
            },
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

  const updateAccountNotificationMode = useCallback(
    async (mode: NotificationMode) => {
      if (!client) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await setAccountNotificationMode(client, mode);
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setIsSaving(false);
      }
    },
    [client, refresh]
  );

  const updateRoomNotificationMode = useCallback(
    async (roomId: string, mode: RoomNotificationMode) => {
      if (!client) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await setRoomNotificationMode(client, roomId, mode);
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
    updateAccountNotificationMode,
    updateRoomNotificationMode,
    resolveRoomNotificationMode: (roomId: string | null | undefined) =>
      getResolvedRoomNotificationMode(preferences, roomId),
    isSaving,
    error,
  };
}
