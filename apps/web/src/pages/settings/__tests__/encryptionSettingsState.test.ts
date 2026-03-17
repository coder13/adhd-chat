/// <reference types="jest" />

type CrossSigningStatusArg = {
  privateKeysCachedLocally: {
    masterKey: boolean;
    userSigningKey: boolean;
    selfSigningKey: boolean;
  };
};

type DeviceCryptoReadyArg = {
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  crossSigningStatus: CrossSigningStatusArg;
};

jest.mock('../../../hooks/useMatrixClient/crypto', () => ({
  hasAllPrivateCrossSigningKeys: jest.fn(
    (crossSigningStatus: CrossSigningStatusArg) =>
    crossSigningStatus.privateKeysCachedLocally.masterKey &&
    crossSigningStatus.privateKeysCachedLocally.userSigningKey &&
    crossSigningStatus.privateKeysCachedLocally.selfSigningKey
  ),
  isDeviceCryptoReady: jest.fn((options: DeviceCryptoReadyArg) =>
    options.crossSigningReady &&
    (options.secretStorageReady ||
      (options.crossSigningStatus.privateKeysCachedLocally.masterKey &&
        options.crossSigningStatus.privateKeysCachedLocally.userSigningKey &&
        options.crossSigningStatus.privateKeysCachedLocally.selfSigningKey))
  ),
}));

import type { EncryptionDiagnostics } from '../../../hooks/useMatrixClient';
import { getEncryptionSettingsViewState } from '../encryptionSettingsState';

function createDiagnostics(
  overrides: Partial<EncryptionDiagnostics> = {}
): EncryptionDiagnostics {
  return {
    crossSigningReady: true,
    secretStorageReady: true,
    keyBackupEnabled: true,
    backupKeyCached: true,
    deviceTrust: {
      signedByOwner: true,
      crossSigningVerified: true,
      localVerified: true,
      tofu: false,
    },
    crossSigningStatus: {
      publicKeysOnDevice: true,
      privateKeysInSecretStorage: true,
      privateKeysCachedLocally: {
        masterKey: true,
        userSigningKey: true,
        selfSigningKey: true,
      },
    },
    ...overrides,
  };
}

describe('getEncryptionSettingsViewState', () => {
  it('marks diagnostics as unavailable instead of showing misleading crypto placeholders', () => {
    const state = getEncryptionSettingsViewState({
      mode: 'ready',
      message: 'Encryption is configured.',
      diagnostics: null,
      loadingDiagnostics: false,
      encryptionRestore: { status: 'idle' },
    });

    expect(state.diagnosticsState).toBe('unavailable');
    expect(state.deviceTrustLabel).toBe('Unavailable');
    expect(state.crossSigningStatusLabel).toBe('Unavailable');
    expect(state.backupKeyStatusLabel).toBe('Unavailable');
    expect(state.restoreStatusLabel).toBe('Unavailable');
    expect(state.deviceSummary).toContain('unavailable');
  });

  it('uses diagnostics to drive unlock state even when setup info said ready', () => {
    const state = getEncryptionSettingsViewState({
      mode: 'ready',
      message: 'Encryption is configured.',
      diagnostics: createDiagnostics({
        crossSigningReady: false,
        secretStorageReady: false,
        crossSigningStatus: {
          publicKeysOnDevice: true,
          privateKeysInSecretStorage: true,
          privateKeysCachedLocally: {
            masterKey: false,
            userSigningKey: false,
            selfSigningKey: false,
          },
        },
      }),
      loadingDiagnostics: false,
      encryptionRestore: { status: 'idle' },
    });

    expect(state.effectiveMode).toBe('unlock');
    expect(state.setupHeading).toBe('Set up this device');
    expect(state.crossSigningStatusLabel).toBe('Not ready');
  });

  it('keeps ready mode when the device is genuinely ready but backup is disabled', () => {
    const state = getEncryptionSettingsViewState({
      mode: 'ready',
      message:
        'Encryption is configured for this account, but message key backup is not enabled on the homeserver.',
      diagnostics: createDiagnostics({
        keyBackupEnabled: false,
      }),
      loadingDiagnostics: false,
      encryptionRestore: { status: 'idle' },
    });

    expect(state.effectiveMode).toBe('ready');
    expect(state.backupKeyStatusLabel).toBe('No backup');
    expect(state.setupHeading).toBe('Encryption on this device');
  });
});
