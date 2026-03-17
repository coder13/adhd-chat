/// <reference types="jest" />

jest.mock('matrix-js-sdk/lib/crypto-api', () => ({
  decodeRecoveryKey: jest.fn(),
}));

jest.mock('../helpers', () => ({
  primeSecretStorageKey: jest.fn(),
}));

jest.mock('../uia', () => ({
  performInteractiveAuth: jest.fn(),
}));

import {
  getEncryptionSetupInfo,
  hasAllPrivateCrossSigningKeys,
  isDeviceCryptoReady,
  type CrossSigningStatusSummary,
} from '../crypto';

function createCrossSigningStatus(
  overrides: Partial<CrossSigningStatusSummary> = {}
): CrossSigningStatusSummary {
  return {
    publicKeysOnDevice: true,
    privateKeysInSecretStorage: true,
    privateKeysCachedLocally: {
      masterKey: false,
      userSigningKey: false,
      selfSigningKey: false,
    },
    ...overrides,
  };
}

function createClient(overrides: {
  crossSigningReady?: boolean;
  secretStorageReady?: boolean;
  crossSigningStatus?: CrossSigningStatusSummary;
  backupVersion?: object | null;
  backupKey?: Uint8Array | null;
} = {}) {
  return {
    getCrypto: () => ({
      isCrossSigningReady: jest
        .fn()
        .mockResolvedValue(overrides.crossSigningReady ?? true),
      isSecretStorageReady: jest
        .fn()
        .mockResolvedValue(overrides.secretStorageReady ?? false),
      getCrossSigningStatus: jest
        .fn()
        .mockResolvedValue(
          overrides.crossSigningStatus ?? createCrossSigningStatus()
        ),
      getActiveSessionBackupVersion: jest
        .fn()
        .mockResolvedValue(overrides.backupVersion ?? { version: '1' }),
      getSessionBackupPrivateKey: jest
        .fn()
        .mockResolvedValue(overrides.backupKey ?? new Uint8Array([1, 2, 3])),
    }),
  };
}

describe('crypto readiness helpers', () => {
  it('treats locally cached cross-signing keys as usable device state', () => {
    const status = createCrossSigningStatus({
      privateKeysCachedLocally: {
        masterKey: true,
        userSigningKey: true,
        selfSigningKey: true,
      },
    });

    expect(hasAllPrivateCrossSigningKeys(status)).toBe(true);
    expect(
      isDeviceCryptoReady({
        crossSigningReady: true,
        secretStorageReady: false,
        crossSigningStatus: status,
      })
    ).toBe(true);
  });

  it('still requires a local key source when secret storage and cached keys are both unavailable', () => {
    const status = createCrossSigningStatus();

    expect(
      isDeviceCryptoReady({
        crossSigningReady: true,
        secretStorageReady: false,
        crossSigningStatus: status,
      })
    ).toBe(false);
  });
});

describe('getEncryptionSetupInfo', () => {
  it('returns ready after verification has loaded cross-signing keys locally', async () => {
    const client = createClient({
      crossSigningReady: true,
      secretStorageReady: false,
      crossSigningStatus: createCrossSigningStatus({
        privateKeysCachedLocally: {
          masterKey: true,
          userSigningKey: true,
          selfSigningKey: true,
        },
      }),
    });

    await expect(getEncryptionSetupInfo(client as never)).resolves.toEqual({
      mode: 'ready',
      message:
        'Encryption is already configured for this account and this browser can access message backup.',
    });
  });

  it('keeps unlock mode when keys are only in secret storage', async () => {
    const client = createClient({
      crossSigningReady: true,
      secretStorageReady: false,
      crossSigningStatus: createCrossSigningStatus(),
    });

    await expect(getEncryptionSetupInfo(client as never)).resolves.toEqual({
      mode: 'unlock',
      message:
        'This account already has encryption set up. Enter your existing recovery key to unlock it on this device.',
    });
  });
});
