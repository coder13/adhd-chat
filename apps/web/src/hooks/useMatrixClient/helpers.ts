import * as sdk from 'matrix-js-sdk';
import type { MatrixClient, TokenRefreshFunction } from 'matrix-js-sdk';
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm';
import type { MatrixSession } from './types';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';
import { isInactiveMatrixSessionError } from './sessionErrors';

const KEY = 'matrix.session.v1';
const INITIAL_SYNC_LIMIT = 100;
const SESSION_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const SESSION_VALIDATION_TIMEOUT_MS = 10000;

export const keyCache = new Map<
  string,
  {
    keyInfo: sdk.SecretStorage.SecretStorageKeyDescription;
    key: Uint8Array;
  }
>();

// Global promise resolver for secret storage key input
let secretStorageKeyResolver: ((key: string) => void) | null = null;
let secretStorageKeyRejecter: ((error: Error) => void) | null = null;
let onKeyRequestCallback: (() => void) | null = null;
let primedSecretStorageKey: string | null = null;
let interactiveAuthPasswordResolver: ((password: string) => void) | null = null;
let interactiveAuthPasswordRejecter: ((error: Error) => void) | null = null;
let onInteractiveAuthRequestCallback: (() => void) | null = null;
let browserInteractiveAuthResolver: (() => void) | null = null;
let browserInteractiveAuthRejecter: ((error: Error) => void) | null = null;
let onBrowserInteractiveAuthRequestCallback:
  | ((payload: { title: string; description: string; url: string }) => void)
  | null = null;

export function setKeyRequestCallback(callback: (() => void) | null) {
  onKeyRequestCallback = callback;
}

export function requestSecretStorageKey(): Promise<string> {
  return new Promise((resolve, reject) => {
    secretStorageKeyResolver = resolve;
    secretStorageKeyRejecter = reject;

    // Trigger the UI to show the key request modal
    if (onKeyRequestCallback) {
      onKeyRequestCallback();
    }
  });
}

export function provideSecretStorageKey(key: string) {
  if (secretStorageKeyResolver) {
    secretStorageKeyResolver(key);
    secretStorageKeyResolver = null;
    secretStorageKeyRejecter = null;
  }
}

export function primeSecretStorageKey(key: string) {
  primedSecretStorageKey = key;
}

export function cancelSecretStorageKeyRequest() {
  if (secretStorageKeyRejecter) {
    secretStorageKeyRejecter(new Error('User cancelled key input'));
    secretStorageKeyResolver = null;
    secretStorageKeyRejecter = null;
  }
}

export function setInteractiveAuthRequestCallback(
  callback: (() => void) | null
) {
  onInteractiveAuthRequestCallback = callback;
}

export function requestInteractiveAuthPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    interactiveAuthPasswordResolver = resolve;
    interactiveAuthPasswordRejecter = reject;

    if (onInteractiveAuthRequestCallback) {
      onInteractiveAuthRequestCallback();
    }
  });
}

export function provideInteractiveAuthPassword(password: string) {
  if (interactiveAuthPasswordResolver) {
    interactiveAuthPasswordResolver(password);
    interactiveAuthPasswordResolver = null;
    interactiveAuthPasswordRejecter = null;
  }
}

export function cancelInteractiveAuthRequest() {
  if (interactiveAuthPasswordRejecter) {
    interactiveAuthPasswordRejecter(
      new Error('User cancelled interactive authentication')
    );
    interactiveAuthPasswordResolver = null;
    interactiveAuthPasswordRejecter = null;
  }
}

export function setBrowserInteractiveAuthRequestCallback(
  callback:
    | ((payload: { title: string; description: string; url: string }) => void)
    | null
) {
  onBrowserInteractiveAuthRequestCallback = callback;
}

export function requestBrowserInteractiveAuth(payload: {
  title: string;
  description: string;
  url: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    browserInteractiveAuthResolver = resolve;
    browserInteractiveAuthRejecter = reject;

    if (onBrowserInteractiveAuthRequestCallback) {
      onBrowserInteractiveAuthRequestCallback(payload);
    }
  });
}

export function completeBrowserInteractiveAuth() {
  if (browserInteractiveAuthResolver) {
    browserInteractiveAuthResolver();
    browserInteractiveAuthResolver = null;
    browserInteractiveAuthRejecter = null;
  }
}

export function cancelBrowserInteractiveAuth() {
  if (browserInteractiveAuthRejecter) {
    browserInteractiveAuthRejecter(
      new Error('User cancelled browser-based interactive authentication')
    );
    browserInteractiveAuthResolver = null;
    browserInteractiveAuthRejecter = null;
  }
}

export function loadSession(): MatrixSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MatrixSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: MatrixSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function createUnauthedClient(baseUrl: string) {
  return sdk.createClient({
    baseUrl,
    useAuthorizationHeader: true,
  });
}

async function refreshMatrixSession(
  session: MatrixSession,
  refreshToken: string,
  onPersist: (s: MatrixSession) => void
) {
  const tmp = sdk.createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    useAuthorizationHeader: true,
  });
  const response = await tmp.refreshToken(refreshToken);
  const updatedSession: MatrixSession = {
    ...session,
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? refreshToken,
    expiresAt:
      typeof response.expires_in_ms === 'number'
        ? Date.now() + response.expires_in_ms
        : undefined,
  };

  onPersist(updatedSession);
  return updatedSession;
}

async function refreshSessionIfNeeded(
  session: MatrixSession,
  onPersist: (s: MatrixSession) => void
) {
  if (!session.refreshToken) {
    return session;
  }

  if (
    typeof session.expiresAt === 'number' &&
    session.expiresAt > Date.now() + SESSION_REFRESH_BUFFER_MS
  ) {
    return session;
  }

  return refreshMatrixSession(session, session.refreshToken, onPersist);
}

async function validateSessionWithRecovery(
  client: MatrixClient,
  session: MatrixSession,
  onPersist: (s: MatrixSession) => void
) {
  try {
    await Promise.race([
      client.getJoinedRooms(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error('Session validation timed out'));
        }, SESSION_VALIDATION_TIMEOUT_MS);
      }),
    ]);
    return session;
  } catch (error) {
    if (error instanceof Error && error.message === 'Session validation timed out') {
      console.warn('Session validation timed out; continuing with live client');
      return session;
    }

    if (!session.refreshToken || !isInactiveMatrixSessionError(error)) {
      throw error;
    }

    const refreshedSession = await refreshMatrixSession(
      session,
      session.refreshToken,
      onPersist
    );
    return refreshedSession;
  }
}

function createCryptoStore(session: MatrixSession) {
  if (typeof indexedDB !== 'undefined') {
    return new sdk.IndexedDBCryptoStore(
      indexedDB,
      `matrix-js-sdk:crypto:${session.userId}:${session.deviceId}`
    );
  }

  return new sdk.MemoryCryptoStore();
}

async function deleteRustCryptoStores() {
  if (typeof indexedDB === 'undefined') {
    return;
  }

  const databaseNames = [
    'matrix-js-sdk::matrix-sdk-crypto',
    'matrix-js-sdk::matrix-sdk-crypto-meta',
  ];

  await Promise.all(
    databaseNames.map(
      (databaseName) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(databaseName);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })
    )
  );
}

function isRustStoreAccountMismatch(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("the account in the store doesn't match the account")
  );
}

async function initRustCryptoWithRecovery(
  client: MatrixClient,
  cryptoStore: ReturnType<typeof createCryptoStore>
) {
  try {
    await client.initRustCrypto();
  } catch (error) {
    if (!isRustStoreAccountMismatch(error)) {
      throw error;
    }

    await cryptoStore.deleteAllData();
    await deleteRustCryptoStores();
    await cryptoStore.startup();
    await client.initRustCrypto();
  }
}

export async function exchangeLoginToken(
  baseUrl: string,
  loginToken: string,
  deviceId: string,
  deviceName = 'Web'
): Promise<MatrixSession> {
  const tmp = createUnauthedClient(baseUrl);
  const resp = await tmp.login('m.login.token', {
    token: loginToken,
    device_id: deviceId,
    initial_device_display_name: deviceName,
    refresh_token: true,
  });

  const session: MatrixSession = {
    baseUrl,
    userId: resp.user_id,
    deviceId: resp.device_id ?? deviceId,
    accessToken: resp.access_token,
    refreshToken: resp.refresh_token ?? undefined,
    expiresAt:
      typeof resp.expires_in_ms === 'number'
        ? Date.now() + resp.expires_in_ms
        : undefined,
  };
  saveSession(session);
  return session;
}

let _client: MatrixClient | null = null;
export async function buildAuthedClient(
  session: MatrixSession,
  onPersist: (s: MatrixSession) => void
): Promise<MatrixClient> {
  let activeSession = await refreshSessionIfNeeded(session, onPersist);

  if (
    _client &&
    _client.getUserId() === activeSession.userId &&
    _client.getDeviceId() === activeSession.deviceId
  ) {
    return _client;
  }

  if (_client) {
    _client.stopClient();
    _client = null;
  }

  await initCryptoWasm();
  const cryptoStore = createCryptoStore(activeSession);
  await cryptoStore.startup();

  const tokenRefresh: TokenRefreshFunction | undefined = activeSession.refreshToken
    ? async (refreshToken: string) => {
        const updated = await refreshMatrixSession(
          activeSession,
          refreshToken,
          onPersist
        );
        activeSession = updated;
        // Update the live client
        _client?.setAccessToken(updated.accessToken);
        return {
          accessToken: updated.accessToken,
          refreshToken: updated.refreshToken,
        };
      }
    : undefined;

  _client = sdk.createClient({
    baseUrl: activeSession.baseUrl,
    accessToken: activeSession.accessToken,
    userId: activeSession.userId,
    deviceId: activeSession.deviceId,
    useAuthorizationHeader: true,
    tokenRefreshFunction: tokenRefresh,
    cryptoStore,

    cryptoCallbacks: {
      getSecretStorageKey: async ({ keys }) => {
        const keyId = Object.keys(keys)[0];

        // Check if we have this key cached first
        const cached = keyCache.get(keyId);
        if (cached) {
          return [keyId, cached.key];
        }

        if (primedSecretStorageKey) {
          const key = decodeRecoveryKey(primedSecretStorageKey);
          primedSecretStorageKey = null;
          const primed = {
            keyInfo: keys[keyId],
            key,
          };

          keyCache.set(keyId, primed);
          return [keyId, primed.key];
        }

        // Request the key from the UI
        const input = await requestSecretStorageKey();

        const rtrn = {
          keyInfo: keys[keyId],
          key: decodeRecoveryKey(input),
        };

        keyCache.set(keyId, rtrn);
        return [keyId, rtrn.key];
      },
      cacheSecretStorageKey: (keyId, keyInfo, key) => {
        keyCache.set(keyId, { keyInfo, key });
      },
    },
  });

  await initRustCryptoWithRecovery(_client, cryptoStore);

  await _client.startClient({ initialSyncLimit: INITIAL_SYNC_LIMIT });

  const validatedSession = await validateSessionWithRecovery(
    _client,
    activeSession,
    onPersist
  );
  if (validatedSession.accessToken !== activeSession.accessToken) {
    _client.stopClient();
    _client = null;
    return buildAuthedClient(validatedSession, onPersist);
  }

  return _client;
}

export function resetAuthedClient() {
  if (_client) {
    try {
      _client.stopClient();
    } catch (error) {
      console.error(error);
    }
  }

  _client = null;
}
