/// <reference types="jest" />

import { act, renderHook, waitFor } from '@testing-library/react';

const mockBuildAuthedClient = jest.fn();
const mockClearSession = jest.fn();
const mockLoadSession = jest.fn();
const mockResetAuthedClient = jest.fn();
const mockSaveSession = jest.fn();
const mockClearSsoCallbackUrl = jest.fn();
const mockCompleteSsoCallback = jest.fn();

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
});
