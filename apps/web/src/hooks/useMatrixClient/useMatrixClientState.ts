import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientEvent, SyncState, type MatrixClient } from 'matrix-js-sdk';
import type { GeneratedSecretStorageKey } from 'matrix-js-sdk/lib/crypto-api';
import type { AuthState, MatrixSession } from './types';
import {
  buildAuthedClient,
  clearSession,
  loadSession,
  resetAuthedClient,
  saveSession,
} from './helpers';
import { clearSsoCallbackUrl, completeSsoCallback, startSsoRedirect } from './auth';
import {
  finishEncryptionSetup,
  generateRecoveryKey,
  getEncryptionDiagnostics,
  getEncryptionSetupInfo,
  type EncryptionDiagnostics,
  type EncryptionSetupInfo,
} from './crypto';

let loggingIn = false;

export function useMatrixClientState() {
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [user, setUser] = useState<{ userId: string; deviceId: string } | null>(
    null
  );
  const sessionRef = useRef<MatrixSession | null>(null);
  const pendingRecoveryKeyRef = useRef<GeneratedSecretStorageKey | null>(null);

  const isReady = authState === 'ready';

  const persist = useCallback((session: MatrixSession) => {
    sessionRef.current = session;
    saveSession(session);
    setUser({ userId: session.userId, deviceId: session.deviceId });
  }, []);

  const handleSync = useCallback((state: SyncState) => {
    setSyncState(state);
  }, []);

  const handleEvent = useCallback(() => {
    // Reserved for future event-driven updates.
  }, []);

  useEffect(() => {
    if (!client || !isReady) {
      return;
    }

    client.on(ClientEvent.Sync, handleSync);
    client.on(ClientEvent.Event, handleEvent);

    return () => {
      client.off(ClientEvent.Sync, handleSync);
      client.off(ClientEvent.Event, handleEvent);
    };
  }, [client, handleEvent, handleSync, isReady]);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      return;
    }

    setAuthState('syncing');

    buildAuthedClient(session, persist)
      .then((authedClient) => {
        setClient(authedClient);
        setUser({ userId: session.userId, deviceId: session.deviceId });
        setAuthState('ready');
      })
      .catch((cause: unknown) => {
        console.error(cause);
        resetAuthedClient();
        clearSession();
        setError(cause instanceof Error ? cause.message : String(cause));
        setAuthState('error');
      });
  }, [persist]);

  useEffect(() => {
    return () => {
      if (!client) {
        return;
      }

      try {
        client.stopClient();
        resetAuthedClient();
      } catch (cause) {
        console.error(cause);
      }
    };
  }, [client]);

  const loginWithSso = useCallback(async (baseUrl: string) => {
    setError(null);
    setAuthState('redirecting');
    startSsoRedirect(baseUrl);
  }, []);

  const completeSsoLogin = useCallback(async () => {
    if (loggingIn || authState === 'authenticating') {
      return;
    }

    setError(null);
    setAuthState('authenticating');

    loggingIn = true;

    try {
      const session = await completeSsoCallback();
      persist(session);
      setAuthState('syncing');

      const authedClient = await buildAuthedClient(session, persist);
      setClient(authedClient);
      setAuthState('ready');
    } catch (cause: unknown) {
      console.error(cause);
      resetAuthedClient();
      clearSession();
      setError(cause instanceof Error ? cause.message : String(cause));
      setAuthState('error');
      setSyncState(null);
    } finally {
      loggingIn = false;
      clearSsoCallbackUrl();
    }
  }, [authState, persist]);

  const logout = useCallback(async () => {
    setError(null);

    try {
      if (client) {
        try {
          await client.logout(true);
        } catch (cause) {
          console.error(cause);
        }

        client.stopClient();
      }
    } finally {
      pendingRecoveryKeyRef.current = null;
      resetAuthedClient();
      setClient(null);
      clearSession();
      setUser(null);
      setSyncState(null);
      setAuthState('logged_out');
    }
  }, [client]);

  const handleGenerateRecoveryKey = useCallback(async (): Promise<string> => {
    if (!client) {
      throw new Error('Client not initialized.');
    }
    const recoveryKey = await generateRecoveryKey(client);

    pendingRecoveryKeyRef.current = recoveryKey;

    return recoveryKey.encodedPrivateKey!;
  }, [client]);

  const loadEncryptionSetupInfo = useCallback(async (): Promise<EncryptionSetupInfo> => {
    if (!client) {
      throw new Error('Client not initialized.');
    }
    return getEncryptionSetupInfo(client);
  }, [client]);

  const loadEncryptionDiagnostics = useCallback(
    async (): Promise<EncryptionDiagnostics> => {
      if (!client || !user) {
        throw new Error('Client not initialized.');
      }
      return getEncryptionDiagnostics(client, user);
    },
    [client, user]
  );

  const handleFinishEncryptionSetup = useCallback(
    async (encodedRecoveryKey: string) => {
      if (!client || !user) {
        throw new Error('Client not initialized.');
      }

      try {
        await finishEncryptionSetup(
          client,
          user,
          encodedRecoveryKey,
          pendingRecoveryKeyRef.current
        );
        pendingRecoveryKeyRef.current = null;
      } catch (cause) {
        console.error('Error setting up encryption:', cause);
        throw cause;
      }
    },
    [client, user]
  );

  return useMemo(
    () => ({
      state: authState,
      syncState,
      client,
      error,
      loginWithSso,
      completeSsoLogin,
      handleGenerateRecoveryKey,
      getEncryptionSetupInfo: loadEncryptionSetupInfo,
      getEncryptionDiagnostics: loadEncryptionDiagnostics,
      handleFinishEncryptionSetup,
      logout,
      isReady,
      user,
    }),
    [
      authState,
      syncState,
      client,
      error,
      loginWithSso,
      completeSsoLogin,
      handleGenerateRecoveryKey,
      loadEncryptionSetupInfo,
      loadEncryptionDiagnostics,
      handleFinishEncryptionSetup,
      logout,
      isReady,
      user,
    ]
  );
}
