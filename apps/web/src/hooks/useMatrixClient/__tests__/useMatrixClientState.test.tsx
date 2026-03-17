/// <reference types="jest" />

import { act, renderHook, waitFor } from '@testing-library/react';

const mockBuildAuthedClient = jest.fn();
const mockClearSession = jest.fn();
const mockLoadSession = jest.fn();
const mockResetAuthedClient = jest.fn();
const mockSaveSession = jest.fn();
const mockClearSsoCallbackUrl = jest.fn();
const mockCompleteSsoCallback = jest.fn();
const mockLoginWithPassword = jest.fn();

jest.mock('matrix-js-sdk', () => ({
  ClientEvent: {
    Sync: 'sync',
    Event: 'event',
  },
}));

jest.mock('matrix-js-sdk/lib/crypto-api/verification', () => ({
  VerificationPhase: {
    Requested: 'requested',
    Ready: 'ready',
    Started: 'started',
    Done: 'done',
    Cancelled: 'cancelled',
  },
  VerificationRequestEvent: {
    Change: 'change',
  },
  VerifierEvent: {
    ShowSas: 'show_sas',
    Cancel: 'cancel',
  },
}));

jest.mock('matrix-js-sdk/lib/types', () => ({
  VerificationMethod: {
    Sas: 'm.sas.v1',
  },
}));

jest.mock('../helpers', () => ({
  buildAuthedClient: mockBuildAuthedClient,
  clearSession: mockClearSession,
  loadSession: mockLoadSession,
  resetAuthedClient: mockResetAuthedClient,
  saveSession: mockSaveSession,
}));

jest.mock('../auth', () => ({
  clearSsoCallbackUrl: mockClearSsoCallbackUrl,
  completeSsoCallback: mockCompleteSsoCallback,
  loginWithPassword: mockLoginWithPassword,
  startSsoRedirect: jest.fn(),
}));

jest.mock('../crypto', () => ({
  finishEncryptionSetup: jest.fn(),
  finishDeviceVerificationUnlock: jest.fn(),
  generateRecoveryKey: jest.fn(),
  getEncryptionDiagnostics: jest.fn(),
  getEncryptionSetupInfo: jest.fn(),
}));

import { EXPIRED_SESSION_MESSAGE } from '../sessionErrors';
import { useMatrixClientState } from '../useMatrixClientState';

const expiredSessionError = {
  errcode: 'M_UNKNOWN_TOKEN',
  httpStatus: 401,
  message: 'Token is not active',
};

describe('useMatrixClientState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears a restored inactive session and moves back to logged out', async () => {
    mockLoadSession.mockReturnValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });
    mockBuildAuthedClient.mockRejectedValue(expiredSessionError);

    const { result } = renderHook(() => useMatrixClientState());

    await waitFor(() => {
      expect(result.current.state).toBe('logged_out');
    });

    expect(mockClearSession).toHaveBeenCalled();
    expect(mockResetAuthedClient).toHaveBeenCalled();
    expect(result.current.error).toBe(EXPIRED_SESSION_MESSAGE);
    expect(result.current.client).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('clears an expired session after SSO callback validation fails', async () => {
    mockLoadSession.mockReturnValue(null);
    mockCompleteSsoCallback.mockResolvedValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });
    mockBuildAuthedClient.mockRejectedValue(expiredSessionError);

    const { result } = renderHook(() => useMatrixClientState());

    await act(async () => {
      await result.current.completeSsoLogin();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('logged_out');
    });

    expect(mockClearSession).toHaveBeenCalled();
    expect(mockResetAuthedClient).toHaveBeenCalled();
    expect(mockClearSsoCallbackUrl).toHaveBeenCalled();
    expect(result.current.error).toBe(EXPIRED_SESSION_MESSAGE);
  });

  it('authenticates with password and transitions to ready', async () => {
    mockLoadSession.mockReturnValue(null);
    mockLoginWithPassword.mockResolvedValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });

    const authedClient = {
      getSyncState: () => 'PREPARED',
      on: jest.fn(),
      off: jest.fn(),
      stopClient: jest.fn(),
    };

    mockBuildAuthedClient.mockResolvedValue(authedClient);

    const { result } = renderHook(() => useMatrixClientState());

    await act(async () => {
      await result.current.loginWithPassword(
        'https://matrix.example',
        'test-user',
        'hunter2'
      );
    });

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(mockLoginWithPassword).toHaveBeenCalledWith(
      'https://matrix.example',
      'test-user',
      'hunter2'
    );
    expect(result.current.user).toEqual({
      userId: '@test:example',
      deviceId: 'DEV1',
    });
  });

  it('retries restoring a saved session after a transient startup failure', async () => {
    jest.useFakeTimers();

    mockLoadSession.mockReturnValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });

    const authedClient = {
      getSyncState: () => 'PREPARED',
      on: jest.fn(),
      off: jest.fn(),
      stopClient: jest.fn(),
    };

    mockBuildAuthedClient
      .mockRejectedValueOnce(new Error('Temporary startup failure'))
      .mockResolvedValueOnce(authedClient);

    const { result } = renderHook(() => useMatrixClientState());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    expect(mockBuildAuthedClient).toHaveBeenCalledTimes(2);
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(result.current.client).toBe(authedClient);
  });

  it('starts in syncing state while a saved session is still restoring', () => {
    mockLoadSession.mockReturnValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });
    mockBuildAuthedClient.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useMatrixClientState());

    expect(result.current.state).toBe('syncing');
    expect(result.current.isReady).toBe(false);
    expect(result.current.bootstrapUserId).toBe('@test:example');
    expect(mockBuildAuthedClient).toHaveBeenCalledTimes(1);
  });

  it('preserves the saved session when startup restore fails for a non-fatal reason', async () => {
    jest.useFakeTimers();

    mockLoadSession.mockReturnValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });
    mockBuildAuthedClient.mockRejectedValue(new Error('Temporary startup failure'));

    const { result } = renderHook(() => useMatrixClientState());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    expect(mockBuildAuthedClient).toHaveBeenCalledTimes(3);
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Temporary startup failure');
  });

  it('shows SAS immediately when the other device already started verification', async () => {
    mockLoadSession.mockReturnValue({
      baseUrl: 'https://matrix.example',
      userId: '@test:example',
      deviceId: 'DEV1',
      accessToken: 'token',
    });

    const requestListeners = new Map<string, () => void>();
    const sasCallbacks = {
      sas: {
        emoji: [['🐶', 'dog']],
        decimal: [1, 2, 3] as [number, number, number],
      },
      confirm: jest.fn(),
      mismatch: jest.fn(),
      cancel: jest.fn(),
    };
    const verifier = {
      on: jest.fn(),
      off: jest.fn(),
      verify: jest.fn(),
      cancel: jest.fn(),
      getShowSasCallbacks: jest.fn(() => sasCallbacks),
      getReciprocateQrCodeCallbacks: jest.fn(() => null),
    };
    const request = {
      transactionId: 'tx-1',
      otherDeviceId: 'DEV2',
      phase: 'ready',
      verifier: undefined as typeof verifier | undefined,
      on: jest.fn((event: string, listener: () => void) => {
        requestListeners.set(event, listener);
      }),
      off: jest.fn((event: string) => {
        requestListeners.delete(event);
      }),
      startVerification: jest.fn(),
      cancel: jest.fn(),
    };
    const authedClient = {
      getSyncState: () => 'PREPARED',
      on: jest.fn(),
      off: jest.fn(),
      stopClient: jest.fn(),
      getCrypto: () => ({
        requestOwnUserVerification: jest.fn().mockResolvedValue(request),
      }),
    };

    mockBuildAuthedClient.mockResolvedValue(authedClient);

    const { result } = renderHook(() => useMatrixClientState());

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });

    await act(async () => {
      await result.current.startDeviceVerificationUnlock();
    });

    expect(result.current.deviceVerification.status).toBe('ready');

    request.phase = 'started';
    request.verifier = verifier;

    await act(async () => {
      requestListeners.get('change')?.();
    });

    await waitFor(() => {
      expect(result.current.deviceVerification.status).toBe('showing_sas');
    });

    expect(result.current.deviceVerification).toMatchObject({
      status: 'showing_sas',
      transactionId: 'tx-1',
      otherDeviceId: 'DEV2',
      emojis: [{ symbol: '🐶', name: 'dog' }],
    });
  });
});
