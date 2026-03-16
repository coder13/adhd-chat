import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientEvent, type MatrixClient, type SyncState } from 'matrix-js-sdk';
import type { GeneratedSecretStorageKey } from 'matrix-js-sdk/lib/crypto-api';
import {
  VerificationPhase,
  VerificationRequestEvent,
  VerifierEvent,
  type ShowSasCallbacks,
  type VerificationRequest,
  type Verifier,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import { VerificationMethod } from 'matrix-js-sdk/lib/types';
import type {
  AuthState,
  DeviceVerificationState,
  MatrixSession,
} from './types';
import {
  buildAuthedClient,
  clearSession,
  loadSession,
  resetAuthedClient,
  saveSession,
} from './helpers';
import {
  clearSsoCallbackUrl,
  completeSsoCallback,
  startSsoRedirect,
} from './auth';
import {
  getAuthFailureMessage,
  isInactiveMatrixSessionError,
} from './sessionErrors';
import {
  finishEncryptionSetup,
  finishDeviceVerificationUnlock,
  generateRecoveryKey,
  getEncryptionDiagnostics,
  getEncryptionSetupInfo,
  type EncryptionDiagnostics,
  type EncryptionSetupInfo,
} from './crypto';
import {
  getDeviceVerificationState,
  toVerificationEmojis,
} from './verificationState';

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
  const verificationRequestRef = useRef<VerificationRequest | null>(null);
  const verifierRef = useRef<Verifier | null>(null);
  const sasCallbacksRef = useRef<ShowSasCallbacks | null>(null);
  const verifyPromiseRef = useRef<Promise<void> | null>(null);
  const verificationRequestListenerCleanupRef = useRef<(() => void) | null>(
    null
  );
  const verifierListenerCleanupRef = useRef<(() => void) | null>(null);
  const [deviceVerification, setDeviceVerification] =
    useState<DeviceVerificationState>({ status: 'idle' });

  const isReady = authState === 'ready';

  const clearVerifierListeners = useCallback(() => {
    if (verifierRef.current && verifierListenerCleanupRef.current) {
      verifierListenerCleanupRef.current();
    }

    verifierRef.current = null;
    verifierListenerCleanupRef.current = null;
    sasCallbacksRef.current = null;
    verifyPromiseRef.current = null;
  }, []);

  const clearVerificationRequestListeners = useCallback(() => {
    if (
      verificationRequestRef.current &&
      verificationRequestListenerCleanupRef.current
    ) {
      verificationRequestListenerCleanupRef.current();
    }

    verificationRequestRef.current = null;
    verificationRequestListenerCleanupRef.current = null;
  }, []);

  const resetDeviceVerification = useCallback(() => {
    clearVerifierListeners();
    clearVerificationRequestListeners();
    setDeviceVerification({ status: 'idle' });
  }, [clearVerificationRequestListeners, clearVerifierListeners]);

  const updateDeviceVerificationState = useCallback(() => {
    setDeviceVerification(
      getDeviceVerificationState(
        verificationRequestRef.current,
        sasCallbacksRef.current
      )
    );
  }, []);

  const attachVerifier = useCallback(
    (verifier: Verifier) => {
      if (verifierRef.current === verifier) {
        return;
      }

      clearVerifierListeners();
      verifierRef.current = verifier;

      const handleShowSas = (sas: ShowSasCallbacks) => {
        sasCallbacksRef.current = sas;
        updateDeviceVerificationState();
      };

      const handleCancel = (
        cause: Error | { getContent?: () => { reason?: string } }
      ) => {
        const message =
          cause instanceof Error
            ? cause.message
            : (cause.getContent?.().reason ?? 'Verification was cancelled.');

        setDeviceVerification({
          status: 'cancelled',
          transactionId: verificationRequestRef.current?.transactionId,
          otherDeviceId: verificationRequestRef.current?.otherDeviceId,
          error: message,
        });
      };

      verifier.on(VerifierEvent.ShowSas, handleShowSas);
      verifier.on(VerifierEvent.Cancel, handleCancel);

      verifierListenerCleanupRef.current = () => {
        verifier.off(VerifierEvent.ShowSas, handleShowSas);
        verifier.off(VerifierEvent.Cancel, handleCancel);
      };
    },
    [clearVerifierListeners, updateDeviceVerificationState]
  );

  const attachVerificationRequest = useCallback(
    (request: VerificationRequest) => {
      if (verificationRequestRef.current === request) {
        updateDeviceVerificationState();
        return;
      }

      clearVerificationRequestListeners();
      verificationRequestRef.current = request;

      const handleChange = () => {
        if (request.verifier) {
          attachVerifier(request.verifier);
        }

        updateDeviceVerificationState();
      };

      request.on(VerificationRequestEvent.Change, handleChange);
      verificationRequestListenerCleanupRef.current = () => {
        request.off(VerificationRequestEvent.Change, handleChange);
      };

      handleChange();
    },
    [
      attachVerifier,
      clearVerificationRequestListeners,
      updateDeviceVerificationState,
    ]
  );

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

  const recoverExpiredSession = useCallback((cause: unknown) => {
    console.error(cause);
    resetAuthedClient();
    clearSession();
    setClient(null);
    setUser(null);
    setSyncState(null);
    setError(getAuthFailureMessage(cause));
    setAuthState('logged_out');
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
        setSyncState(authedClient.getSyncState() ?? null);
        setUser({ userId: session.userId, deviceId: session.deviceId });
        setAuthState('ready');
      })
      .catch((cause: unknown) => {
        if (isInactiveMatrixSessionError(cause)) {
          recoverExpiredSession(cause);
          return;
        }

        console.error(cause);
        resetAuthedClient();
        clearSession();
        setError(getAuthFailureMessage(cause));
        setAuthState('error');
      });
  }, [persist, recoverExpiredSession]);

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

  const loginWithSso = useCallback(
    async (baseUrl: string, returnPath?: string) => {
      setError(null);
      setAuthState('redirecting');
      startSsoRedirect(baseUrl, returnPath);
    },
    []
  );

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
      setSyncState(authedClient.getSyncState() ?? null);
      setAuthState('ready');
    } catch (cause: unknown) {
      if (isInactiveMatrixSessionError(cause)) {
        recoverExpiredSession(cause);
      } else {
        console.error(cause);
        resetAuthedClient();
        clearSession();
        setError(getAuthFailureMessage(cause));
        setAuthState('error');
        setSyncState(null);
      }
    } finally {
      loggingIn = false;
      clearSsoCallbackUrl();
    }
  }, [authState, persist, recoverExpiredSession]);

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
      resetDeviceVerification();
      resetAuthedClient();
      setClient(null);
      clearSession();
      setUser(null);
      setSyncState(null);
      setAuthState('logged_out');
    }
  }, [client, resetDeviceVerification]);

  const handleGenerateRecoveryKey = useCallback(async (): Promise<string> => {
    if (!client) {
      throw new Error('Client not initialized.');
    }
    const recoveryKey = await generateRecoveryKey(client);

    pendingRecoveryKeyRef.current = recoveryKey;

    return recoveryKey.encodedPrivateKey!;
  }, [client]);

  const loadEncryptionSetupInfo =
    useCallback(async (): Promise<EncryptionSetupInfo> => {
      if (!client) {
        throw new Error('Client not initialized.');
      }
      return getEncryptionSetupInfo(client);
    }, [client]);

  const loadEncryptionDiagnostics =
    useCallback(async (): Promise<EncryptionDiagnostics> => {
      if (!client || !user) {
        throw new Error('Client not initialized.');
      }
      return getEncryptionDiagnostics(client, user);
    }, [client, user]);

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

  const startDeviceVerificationUnlock = useCallback(async () => {
    if (!client) {
      throw new Error('Client not initialized.');
    }

    const cryptoApi = client.getCrypto?.();
    if (!cryptoApi) {
      throw new Error('Encryption is not initialized for this session.');
    }

    setDeviceVerification({ status: 'requesting' });

    try {
      const request = await cryptoApi.requestOwnUserVerification();
      attachVerificationRequest(request);
    } catch (cause) {
      setDeviceVerification({
        status: 'error',
        error: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  }, [attachVerificationRequest, client]);

  const startSasDeviceVerification = useCallback(async () => {
    const request = verificationRequestRef.current;
    if (!request) {
      throw new Error('No verification request is in progress.');
    }

    setDeviceVerification({
      status: 'starting_sas',
      transactionId: request.transactionId,
      otherDeviceId: request.otherDeviceId,
    });

    try {
      const verifier = await request.startVerification(VerificationMethod.Sas);
      attachVerifier(verifier);

      verifyPromiseRef.current = verifier
        .verify()
        .then(async () => {
          if (!client) {
            throw new Error('Client not initialized.');
          }

          await finishDeviceVerificationUnlock(client);
          setDeviceVerification({
            status: 'done',
            transactionId: verificationRequestRef.current?.transactionId,
            otherDeviceId: verificationRequestRef.current?.otherDeviceId,
          });
        })
        .catch((cause: unknown) => {
          if (
            verificationRequestRef.current?.phase ===
            VerificationPhase.Cancelled
          ) {
            setDeviceVerification({
              status: 'cancelled',
              transactionId: verificationRequestRef.current?.transactionId,
              otherDeviceId: verificationRequestRef.current?.otherDeviceId,
              error:
                cause instanceof Error
                  ? cause.message
                  : 'Verification was cancelled.',
            });
            return;
          }

          setDeviceVerification({
            status: 'error',
            transactionId: verificationRequestRef.current?.transactionId,
            otherDeviceId: verificationRequestRef.current?.otherDeviceId,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        });
    } catch (cause) {
      setDeviceVerification({
        status: 'error',
        transactionId: request.transactionId,
        otherDeviceId: request.otherDeviceId,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  }, [attachVerifier, client]);

  const confirmSasDeviceVerification = useCallback(async () => {
    const request = verificationRequestRef.current;
    const sasCallbacks = sasCallbacksRef.current;

    if (!request || !sasCallbacks) {
      throw new Error('No SAS confirmation is available.');
    }

    setDeviceVerification({
      status: 'confirming',
      transactionId: request.transactionId,
      otherDeviceId: request.otherDeviceId,
      decimals: sasCallbacks.sas.decimal,
      emojis: toVerificationEmojis(sasCallbacks.sas.emoji),
    });

    try {
      await sasCallbacks.confirm();
      sasCallbacksRef.current = null;
      updateDeviceVerificationState();
      await verifyPromiseRef.current;
    } catch (cause) {
      setDeviceVerification({
        status: 'error',
        transactionId: request.transactionId,
        otherDeviceId: request.otherDeviceId,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  }, [updateDeviceVerificationState]);

  const cancelDeviceVerification = useCallback(async () => {
    const request = verificationRequestRef.current;
    const sasCallbacks = sasCallbacksRef.current;

    try {
      if (sasCallbacks) {
        sasCallbacks.cancel();
      } else if (request) {
        await request.cancel();
      }
    } finally {
      resetDeviceVerification();
    }
  }, [resetDeviceVerification]);

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
      deviceVerification,
      startDeviceVerificationUnlock,
      startSasDeviceVerification,
      confirmSasDeviceVerification,
      cancelDeviceVerification,
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
      deviceVerification,
      startDeviceVerificationUnlock,
      startSasDeviceVerification,
      confirmSasDeviceVerification,
      cancelDeviceVerification,
      logout,
      isReady,
      user,
    ]
  );
}
