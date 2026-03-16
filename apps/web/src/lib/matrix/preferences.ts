import {
  ClientEvent,
  type MatrixClient,
  type MatrixEvent,
} from 'matrix-js-sdk';

export const TANDEM_PREFERENCES_EVENT_TYPE = 'com.tandem.preferences';

export type ChatViewMode = 'bubbles' | 'timeline';

export interface TandemPreferences {
  chatViewMode: ChatViewMode;
}

const DEFAULT_PREFERENCES: TandemPreferences = {
  chatViewMode: 'timeline',
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
