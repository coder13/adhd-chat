import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { AuthState, MatrixSession } from './types';
import {
  loadSession,
  saveSession,
  buildAuthedClient,
  createUnauthedClient,
  exchangeLoginToken,
  clearSession,
} from './helpers';

const REDIRECT_KEY = 'matrix.redirect.baseUrl';

let loggingIn = false;

export function useMatrixClient() {
  const [state, setState] = useState<AuthState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [user, setUser] = useState<{ userId: string; deviceId: string } | null>(
    null
  );
  const sessionRef = useRef<MatrixSession | null>(null);

  const isReady = state === 'ready';

  const persist = useCallback((s: MatrixSession) => {
    console.log('Persisting session', s);
    sessionRef.current = s;
    saveSession(s);
    setUser({ userId: s.userId, deviceId: s.deviceId });
  }, []);

  // Auto-resume from saved session
  useEffect(() => {
    const s = loadSession();
    if (!s) return;

    setState('syncing');
    buildAuthedClient(s, persist)
      .then((c) => {
        setClient(c);
        setUser({ userId: s.userId, deviceId: s.deviceId });
        setState('ready');
      })
      .catch((e) => {
        console.error(e);
        setError(e?.message ?? String(e));
        setState('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (client) {
        try {
          client.stopClient();
          client.clearStores?.();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [client]);

  const loginWithSso = useCallback(async (baseUrl: string) => {
    setError(null);
    setState('redirecting');

    // Stash baseUrl so callback can read it
    sessionStorage.setItem(REDIRECT_KEY, baseUrl);

    const c = createUnauthedClient(baseUrl);
    const redirectUri = `${window.location.origin}/auth/callback`;
    const ssoUrl = c.getSsoLoginUrl(redirectUri);
    window.location.assign(ssoUrl);
  }, []);

  // callback handler
  const completeSsoLogin = useCallback(async () => {
    if (loggingIn || state === 'authenticating') {
      return;
    }
    setState('authenticating');

    const url = new URL(window.location.href);
    const loginToken = url.searchParams.get('loginToken');
    if (!loginToken) {
      setError('Missing loginToken in callback URL');
      setState('error');
      return;
    }
    loggingIn = true;

    const baseUrl =
      sessionStorage.getItem(REDIRECT_KEY) ??
      new URL(window.location.origin).origin;

    try {
      const existingSession = loadSession();
      const deviceId = existingSession?.deviceId ?? crypto.randomUUID();
      const session = await exchangeLoginToken(baseUrl, loginToken, deviceId);
      persist(session);

      setState('syncing');
      const c = await buildAuthedClient(session, persist);
      setClient(c);
      setState('ready');
      loggingIn = false;
    } catch (e) {
      console.error(e);
      setError(String(e));
      setState('error');
    } finally {
      try {
        url.searchParams.delete('loginToken');
        window.history.replaceState({}, document.title, url.toString());
      } catch (e) {
        console.error(e);
      }
      sessionStorage.removeItem(REDIRECT_KEY);
    }
  }, [persist, state]);

  const logout = useCallback(async () => {
    if (!client) {
      return;
    }

    setError(null);
    try {
      try {
        await client.logout(true);
      } catch (e) {
        console.error(e);
      }
      client.stopClient();
    } finally {
      setClient(null);
      clearSession();
      setUser(null);
      setState('logged_out');
    }
  }, [client]);

  // Doesn't super work / yet
  const handleSetupEncryption = useCallback(async () => {
    if (!client) {
      return;
    }
    const crypto = client.getCrypto?.();
    if (!crypto) {
      console.error(
        'Crypto not initialised. Call initRustCrypto() before startClient().'
      );
      return;
    }

    try {
      const gen = await crypto.createRecoveryKeyFromPassphrase();

      await crypto.bootstrapSecretStorage({
        setupNewSecretStorage: true,
        createSecretStorageKey: async () => {
          // Called if SSSS is not present; provide the default key id + raw key bytes
          return gen;
        },
      });

      console.log(gen.encodedPrivateKey);

      // crypto
      //   .getCryptoCallbacks()
      //   .cacheSecretStorageKey?.(gen.keyId, gen.keyInfo, gen.key);

      await crypto.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async (makeRequest) => {
          makeRequest({
            deviceId: user!.deviceId,
            userId: user!.userId,
          });
        },
      });

      const hasKeyBackup = (await crypto.checkKeyBackupAndEnable()) !== null;

      if (!hasKeyBackup) {
        await crypto.resetKeyBackup();
      }
    } catch (error) {
      console.error('Error setting up encryption:', error);
    }
  }, [client, user]);

  return useMemo(
    () => ({
      state,
      client,
      error,
      loginWithSso,
      completeSsoLogin,
      handleSetupEncryption,
      logout,
      isReady,
      user,
    }),
    [
      state,
      client,
      error,
      loginWithSso,
      completeSsoLogin,
      handleSetupEncryption,
      logout,
      isReady,
      user,
    ]
  );
}

export default useMatrixClient;
