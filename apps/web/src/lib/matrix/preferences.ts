import {
  ClientEvent,
  type MatrixClient,
  type MatrixEvent,
} from 'matrix-js-sdk';

export const TANDEM_PREFERENCES_EVENT_TYPE = 'com.tandem.preferences';

export type ChatViewMode = 'bubbles' | 'timeline';
export type NotificationMode = 'all' | 'mute';
export type RoomNotificationMode = 'default' | NotificationMode;

export interface TandemPreferences {
  chatViewMode: ChatViewMode;
  accountNotificationMode: NotificationMode;
  roomNotificationOverrides: Record<string, RoomNotificationMode>;
}

const DEFAULT_PREFERENCES: TandemPreferences = {
  chatViewMode: 'timeline',
  accountNotificationMode: 'all',
  roomNotificationOverrides: {},
};

function normalizePreferences(content: unknown): TandemPreferences {
  if (!content || typeof content !== 'object') {
    return DEFAULT_PREFERENCES;
  }

  const candidate = content as Partial<TandemPreferences>;
  return {
    chatViewMode:
      candidate.chatViewMode === 'bubbles' ||
      candidate.chatViewMode === 'timeline'
        ? candidate.chatViewMode
        : DEFAULT_PREFERENCES.chatViewMode,
    accountNotificationMode:
      candidate.accountNotificationMode === 'mute' ? 'mute' : 'all',
    roomNotificationOverrides: Object.fromEntries(
      Object.entries(candidate.roomNotificationOverrides ?? {}).filter(
        ([roomId, mode]) =>
          Boolean(roomId) &&
          (mode === 'default' || mode === 'all' || mode === 'mute')
      )
    ),
  };
}

export function getTandemPreferences(client: MatrixClient): TandemPreferences {
  return normalizePreferences(
    client.getAccountData(TANDEM_PREFERENCES_EVENT_TYPE)?.getContent()
  );
}

export async function setChatViewMode(
  client: MatrixClient,
  chatViewMode: ChatViewMode
) {
  const current = getTandemPreferences(client);
  await client.setAccountData(TANDEM_PREFERENCES_EVENT_TYPE, {
    ...current,
    chatViewMode,
  });
}

export function getResolvedRoomNotificationMode(
  preferences: TandemPreferences,
  roomId: string | null | undefined
): NotificationMode {
  if (!roomId) {
    return preferences.accountNotificationMode;
  }

  const override = preferences.roomNotificationOverrides[roomId];
  if (override === 'all' || override === 'mute') {
    return override;
  }

  return preferences.accountNotificationMode;
}

export async function setAccountNotificationMode(
  client: MatrixClient,
  accountNotificationMode: NotificationMode
) {
  const current = getTandemPreferences(client);
  await client.setAccountData(TANDEM_PREFERENCES_EVENT_TYPE, {
    ...current,
    accountNotificationMode,
  });
}

export async function setRoomNotificationMode(
  client: MatrixClient,
  roomId: string,
  mode: RoomNotificationMode
) {
  const current = getTandemPreferences(client);
  const nextOverrides = { ...current.roomNotificationOverrides };

  if (mode === 'default') {
    delete nextOverrides[roomId];
  } else {
    nextOverrides[roomId] = mode;
  }

  await client.setAccountData(TANDEM_PREFERENCES_EVENT_TYPE, {
    ...current,
    roomNotificationOverrides: nextOverrides,
  });
}

export function attachTandemPreferencesListener(
  client: MatrixClient,
  onChange: () => void
) {
  const handleAccountData = (event: MatrixEvent) => {
    if (event.getType() === TANDEM_PREFERENCES_EVENT_TYPE) {
      onChange();
    }
  };

  client.on(ClientEvent.AccountData, handleAccountData);

  return () => {
    client.off(ClientEvent.AccountData, handleAccountData);
  };
}
