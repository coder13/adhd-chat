import type { MatrixClient } from 'matrix-js-sdk';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api';
import type { GeneratedSecretStorageKey } from 'matrix-js-sdk/lib/crypto-api';
import { primeSecretStorageKey } from './helpers';
import { performInteractiveAuth } from './uia';

export type EncryptionSetupMode = 'ready' | 'unlock' | 'create' | 'blocked';

export type EncryptionSetupInfo = {
  mode: EncryptionSetupMode;
  message: string;
};

export type EncryptionDiagnostics = {
  crossSigningReady: boolean;
  secretStorageReady: boolean;
  keyBackupEnabled: boolean;
  backupKeyCached: boolean;
  deviceTrust:
    | {
        signedByOwner: boolean;
        crossSigningVerified: boolean;
        localVerified: boolean;
        tofu: boolean;
      }
    | null;
  crossSigningStatus: {
    publicKeysOnDevice: boolean;
    privateKeysInSecretStorage: boolean;
    privateKeysCachedLocally: {
      masterKey: boolean;
      userSigningKey: boolean;
      selfSigningKey: boolean;
    };
  };
};

function requireCrypto(client: MatrixClient) {
  const cryptoApi = client.getCrypto?.();
  if (!cryptoApi) {
    throw new Error(
      'Encryption is not initialized for this session. Log in again and retry.'
    );
  }

  return cryptoApi;
}

async function ensureBackupKeysRestored(client: MatrixClient) {
  return ensureBackupKeysRestoredWithOptions(client, {
    allowSecretStorageFallback: true,
  });
}

async function ensureBackupKeysRestoredWithOptions(
  client: MatrixClient,
  options: {
    allowSecretStorageFallback: boolean;
  }
) {
  const cryptoApi = requireCrypto(client);

  await cryptoApi.checkKeyBackupAndEnable();

  let backupKey = await cryptoApi.getSessionBackupPrivateKey();

  if (!backupKey && options.allowSecretStorageFallback) {
    try {
      await cryptoApi.loadSessionBackupPrivateKeyFromSecretStorage();
      backupKey = await cryptoApi.getSessionBackupPrivateKey();
    } catch (error) {
      console.warn('Could not load key backup from secret storage:', error);
    }
  }

  if (!backupKey) {
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      backupKey = await cryptoApi.getSessionBackupPrivateKey();

      if (backupKey) {
        break;
      }
    }
  }

  if (!backupKey) {
    throw new Error(
      'This device still does not have the message backup key. Complete recovery on another verified device or use your recovery key here.'
    );
  }

  await cryptoApi.restoreKeyBackup();
}

export async function generateRecoveryKey(client: MatrixClient) {
  const cryptoApi = requireCrypto(client);
  const recoveryKey = await cryptoApi.createRecoveryKeyFromPassphrase();
  if (!recoveryKey.encodedPrivateKey) {
    throw new Error('Failed to generate an encoded recovery key.');
  }

  return recoveryKey;
}

export async function getEncryptionSetupInfo(client: MatrixClient) {
  const cryptoApi = requireCrypto(client);
  const [
    crossSigningReady,
    secretStorageReady,
    crossSigningStatus,
    backupVersion,
    backupKey,
  ] =
    await Promise.all([
      cryptoApi.isCrossSigningReady(),
      cryptoApi.isSecretStorageReady(),
      cryptoApi.getCrossSigningStatus(),
      cryptoApi.getActiveSessionBackupVersion(),
      cryptoApi.getSessionBackupPrivateKey(),
    ]);

  const keyBackupEnabled = backupVersion !== null;

  if (crossSigningReady && secretStorageReady) {
    return {
      mode: 'ready',
      message: keyBackupEnabled
        ? backupKey !== null
          ? 'Encryption is already configured for this account and this browser can access message backup.'
          : 'Encryption is already configured for this account. This browser can use end-to-end encryption, but old encrypted history may still depend on whether backup keys are available locally.'
        : 'Encryption is configured for this account, but message key backup is not enabled on the homeserver. This device can encrypt new messages, but older encrypted history from other devices may not be recoverable here.',
    } satisfies EncryptionSetupInfo;
  }

  if (crossSigningStatus.privateKeysInSecretStorage) {
    return {
      mode: 'unlock',
      message:
        'This account already has encryption set up. Enter your existing recovery key to unlock it on this device.',
    } satisfies EncryptionSetupInfo;
  }

  if (crossSigningStatus.publicKeysOnDevice) {
    return {
      mode: 'blocked',
      message:
        'This account already has an encryption identity, but this app cannot safely recover it without the existing secret storage setup. Use your existing recovery key in another Matrix client or reset encryption from a client that supports full security management.',
    } satisfies EncryptionSetupInfo;
  }

  return {
    mode: 'create',
    message:
      'Create a new recovery key to enable end-to-end encryption for this account.',
  } satisfies EncryptionSetupInfo;
}

export async function getEncryptionDiagnostics(
  client: MatrixClient,
  user: { userId: string; deviceId: string }
) {
  const cryptoApi = requireCrypto(client);
  const [
    crossSigningReady,
    secretStorageReady,
    crossSigningStatus,
    backupVersion,
    backupKey,
    deviceTrust,
  ] = await Promise.all([
    cryptoApi.isCrossSigningReady(),
    cryptoApi.isSecretStorageReady(),
    cryptoApi.getCrossSigningStatus(),
    cryptoApi.getActiveSessionBackupVersion(),
    cryptoApi.getSessionBackupPrivateKey(),
    cryptoApi.getDeviceVerificationStatus(user.userId, user.deviceId),
  ]);

  return {
    crossSigningReady,
    secretStorageReady,
    keyBackupEnabled: backupVersion !== null,
    backupKeyCached: backupKey !== null,
    deviceTrust: deviceTrust
      ? {
          signedByOwner: deviceTrust.signedByOwner,
          crossSigningVerified: deviceTrust.crossSigningVerified,
          localVerified: deviceTrust.localVerified,
          tofu: deviceTrust.tofu,
        }
      : null,
    crossSigningStatus,
  } satisfies EncryptionDiagnostics;
}

export async function finishEncryptionSetup(
  client: MatrixClient,
  user: { userId: string; deviceId: string },
  encodedRecoveryKey: string,
  pendingRecoveryKey: GeneratedSecretStorageKey | null
) {
  const cryptoApi = requireCrypto(client);
  const setupInfo = await getEncryptionSetupInfo(client);
  const trimmedRecoveryKey = encodedRecoveryKey.trim();

  if (setupInfo.mode === 'unlock') {
    if (!trimmedRecoveryKey) {
      throw new Error('Recovery key is required.');
    }

    primeSecretStorageKey(trimmedRecoveryKey);
    await cryptoApi.bootstrapCrossSigning({
      authUploadDeviceSigningKeys: async (makeRequest) => {
        await performInteractiveAuth(client, user.userId, makeRequest);
      },
    });
    await ensureBackupKeysRestored(client);
    return;
  }

  if (setupInfo.mode !== 'create') {
    throw new Error(setupInfo.message);
  }

  if (!trimmedRecoveryKey) {
    throw new Error('Recovery key is required.');
  }

  const recoveryKey =
    pendingRecoveryKey?.encodedPrivateKey === trimmedRecoveryKey
      ? pendingRecoveryKey
      : {
          privateKey: decodeRecoveryKey(trimmedRecoveryKey),
          encodedPrivateKey: trimmedRecoveryKey,
        };

  await cryptoApi.bootstrapCrossSigning({
    authUploadDeviceSigningKeys: async (makeRequest) => {
      await performInteractiveAuth(client, user.userId, makeRequest);
    },
  });

  await cryptoApi.bootstrapSecretStorage({
    createSecretStorageKey: async () => recoveryKey,
    setupNewSecretStorage: true,
    setupNewKeyBackup: true,
  });
}

export async function finishDeviceVerificationUnlock(client: MatrixClient) {
  const cryptoApi = requireCrypto(client);
  const [crossSigningStatus, backupVersion] = await Promise.all([
    cryptoApi.getCrossSigningStatus(),
    cryptoApi.getActiveSessionBackupVersion(),
  ]);
  const privateKeysCachedLocally =
    crossSigningStatus.privateKeysCachedLocally.masterKey &&
    crossSigningStatus.privateKeysCachedLocally.selfSigningKey &&
    crossSigningStatus.privateKeysCachedLocally.userSigningKey;

  if (!privateKeysCachedLocally) {
    await cryptoApi.bootstrapCrossSigning({});
  }

  if (backupVersion !== null) {
    await ensureBackupKeysRestoredWithOptions(client, {
      allowSecretStorageFallback: false,
    });
  }
}
