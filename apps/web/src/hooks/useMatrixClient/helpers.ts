import * as sdk from 'matrix-js-sdk';
import type { MatrixClient, TokenRefreshFunction } from 'matrix-js-sdk';
import { initAsync as initCryptoWasm } from '@matrix-org/matrix-sdk-crypto-wasm';
import type { MatrixSession } from './types';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';

const KEY = 'matrix.session.v1';

export const keyCache = new Map<
  string,
  {
    keyInfo: sdk.SecretStorage.SecretStorageKeyDescription;
    key: Uint8Array;
  }
>();

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
  if (_client) {
    return _client;
  }

  await initCryptoWasm();

  const tokenRefresh: TokenRefreshFunction | undefined = session.refreshToken
    ? async (refreshToken: string) => {
        const tmp = sdk.createClient({
          baseUrl: session.baseUrl,
          accessToken: session.accessToken,
          useAuthorizationHeader: true,
        });
        const r = await tmp.refreshToken(refreshToken);
        // Update persisted session
        const updated: MatrixSession = {
          ...session,
          accessToken: r.access_token,
          refreshToken: r.refresh_token ?? refreshToken,
          expiresAt:
            typeof r.expires_in_ms === 'number'
              ? Date.now() + r.expires_in_ms
              : undefined,
        };
        onPersist(updated);
        // Update the live client
        _client?.setAccessToken(r.access_token);
        return { accessToken: r.access_token, refreshToken: r.refresh_token };
      }
    : undefined;

  _client = sdk.createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    useAuthorizationHeader: true,
    tokenRefreshFunction: tokenRefresh,

    cryptoCallbacks: {
      getSecretStorageKey: async ({ keys }) => {
        // This function should prompt the user to enter their secret storage key.
        console.log(108, keys);
        const keyId = Object.keys(keys)[0];
        const input = prompt(`Enter your secret storage key for ${keyId}:`);

        const rtrn = {
          keyInfo: keys[keyId],
          key: decodeRecoveryKey(input || ''),
        };
        console.log(113, rtrn);

        keyCache.set(Object.keys(keys)[0], rtrn);

        return [keyId, rtrn.key];
      },
      cacheSecretStorageKey: (keyId, keyInfo, key) => {
        keyCache.set(keyId, { keyInfo, key });
      },
    },
  });

  await _client.initRustCrypto();

  await _client.startClient({ initialSyncLimit: 20 });

  return _client;
}
