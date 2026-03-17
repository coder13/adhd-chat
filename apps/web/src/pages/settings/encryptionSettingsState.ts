import type { EncryptionDiagnostics } from '../../hooks/useMatrixClient';
import type { EncryptionRestoreState } from '../../hooks/useMatrixClient/types';
import {
  hasAllPrivateCrossSigningKeys,
  isDeviceCryptoReady,
} from '../../hooks/useMatrixClient/crypto';

type EncryptionSetupDisplayMode = 'ready' | 'unlock' | 'create' | 'blocked';
type DiagnosticsState = 'checking' | 'ready' | 'unavailable';

export type EncryptionSettingsViewState = {
  diagnosticsState: DiagnosticsState;
  effectiveMode: EncryptionSetupDisplayMode;
  effectiveMessage: string;
  setupHeading: string;
  deviceSummary: string;
  deviceTrustLabel: string;
  crossSigningDetail: string;
  crossSigningStatusLabel: string;
  backupKeyStatusLabel: string;
  restoreStatusLabel: string;
};

function getDiagnosticsState(
  diagnostics: EncryptionDiagnostics | null,
  loadingDiagnostics: boolean
): DiagnosticsState {
  if (loadingDiagnostics) {
    return 'checking';
  }

  return diagnostics ? 'ready' : 'unavailable';
}

function getDeviceTrustLabel(
  diagnostics: EncryptionDiagnostics | null,
  diagnosticsState: DiagnosticsState
) {
  if (diagnosticsState === 'checking') {
    return 'Checking';
  }

  if (diagnosticsState === 'unavailable') {
    return 'Unavailable';
  }

  if (!diagnostics?.deviceTrust) {
    return 'Unknown';
  }

  return diagnostics.deviceTrust.crossSigningVerified ||
    diagnostics.deviceTrust.signedByOwner ||
    diagnostics.deviceTrust.localVerified
    ? 'Verified'
    : 'Not verified';
}

function getCrossSigningDetail(
  diagnostics: EncryptionDiagnostics | null,
  diagnosticsState: DiagnosticsState
) {
  if (diagnosticsState === 'checking') {
    return 'Checking device keys...';
  }

  if (diagnosticsState === 'unavailable' || !diagnostics) {
    return 'Encryption diagnostics are unavailable right now. Refresh to retry.';
  }

  const locallyCached = hasAllPrivateCrossSigningKeys(
    diagnostics.crossSigningStatus
  );

  if (diagnostics.crossSigningReady) {
    return locallyCached
      ? 'Private cross-signing keys are loaded on this device.'
      : 'Cross-signing keys exist for this account, but they may still need to be loaded locally.';
  }

  if (!diagnostics.crossSigningStatus.publicKeysOnDevice) {
    return 'This device has not loaded the account cross-signing identity yet.';
  }

  if (diagnostics.crossSigningStatus.privateKeysInSecretStorage) {
    return 'Your account has cross-signing keys in secure storage, but this device has not loaded them yet.';
  }

  return 'This device does not currently have the private cross-signing keys it needs.';
}

function getEffectiveMode(
  mode: EncryptionSetupDisplayMode,
  diagnostics: EncryptionDiagnostics | null
): EncryptionSetupDisplayMode {
  if (mode === 'create' || !diagnostics) {
    return mode;
  }

  const isReadyOnDevice =
    mode === 'ready' &&
    isDeviceCryptoReady({
      crossSigningReady: diagnostics.crossSigningReady,
      secretStorageReady: diagnostics.secretStorageReady,
      crossSigningStatus: diagnostics.crossSigningStatus,
    });

  if (isReadyOnDevice) {
    return 'ready';
  }

  if (mode === 'unlock' || mode === 'blocked') {
    return mode;
  }

  return diagnostics.crossSigningStatus.privateKeysInSecretStorage
    ? 'unlock'
    : 'blocked';
}

function getRestoreStatusLabel(
  diagnostics: EncryptionDiagnostics | null,
  diagnosticsState: DiagnosticsState,
  encryptionRestore: EncryptionRestoreState
) {
  if (encryptionRestore.status === 'restoring') {
    return 'Restoring now';
  }

  if (encryptionRestore.status === 'restored') {
    return 'Finished';
  }

  if (encryptionRestore.status === 'error') {
    return 'Failed';
  }

  if (diagnosticsState === 'checking') {
    return 'Checking';
  }

  if (diagnosticsState === 'unavailable' || !diagnostics) {
    return 'Unavailable';
  }

  return diagnostics.backupKeyCached ? 'Backup key available' : 'Not started';
}

export function getEncryptionSettingsViewState(input: {
  mode: EncryptionSetupDisplayMode;
  message: string;
  diagnostics: EncryptionDiagnostics | null;
  loadingDiagnostics: boolean;
  encryptionRestore: EncryptionRestoreState;
}): EncryptionSettingsViewState {
  const diagnosticsState = getDiagnosticsState(
    input.diagnostics,
    input.loadingDiagnostics
  );
  const effectiveMode = getEffectiveMode(input.mode, input.diagnostics);
  const backupReady = input.diagnostics
    ? !input.diagnostics.keyBackupEnabled || input.diagnostics.backupKeyCached
    : false;
  const isReadyOnDevice =
    effectiveMode === 'ready' &&
    input.diagnostics !== null &&
    isDeviceCryptoReady({
      crossSigningReady: input.diagnostics.crossSigningReady,
      secretStorageReady: input.diagnostics.secretStorageReady,
      crossSigningStatus: input.diagnostics.crossSigningStatus,
    });
  const isFullyRecovered = isReadyOnDevice && backupReady;

  const deviceSummary =
    diagnosticsState === 'checking'
      ? 'Checking encryption status...'
      : diagnosticsState === 'unavailable'
        ? 'Encryption diagnostics are unavailable right now. Refresh to retry before trusting this device state.'
        : isFullyRecovered
          ? 'This device has access to your encryption keys, but older encrypted history may still take time to restore.'
          : 'This device still needs to be unlocked before it can restore older encrypted history.';

  const effectiveMessage =
    effectiveMode === 'ready' && input.diagnostics?.secretStorageReady
      ? 'This device has access to your encryption keys. Some older encrypted messages may still need to finish restoring or decrypting.'
      : input.message;

  return {
    diagnosticsState,
    effectiveMode,
    effectiveMessage,
    setupHeading:
      effectiveMode === 'ready' ? 'Encryption on this device' : 'Set up this device',
    deviceSummary,
    deviceTrustLabel: getDeviceTrustLabel(input.diagnostics, diagnosticsState),
    crossSigningDetail: getCrossSigningDetail(
      input.diagnostics,
      diagnosticsState
    ),
    crossSigningStatusLabel:
      diagnosticsState === 'checking'
        ? 'Checking'
        : diagnosticsState === 'unavailable' || !input.diagnostics
          ? 'Unavailable'
          : input.diagnostics.crossSigningReady
            ? 'Ready'
            : 'Not ready',
    backupKeyStatusLabel:
      diagnosticsState === 'checking'
        ? 'Checking'
        : diagnosticsState === 'unavailable' || !input.diagnostics
          ? 'Unavailable'
          : input.diagnostics.keyBackupEnabled
            ? input.diagnostics.backupKeyCached
              ? 'Available'
              : 'Not loaded'
            : 'No backup',
    restoreStatusLabel: getRestoreStatusLabel(
      input.diagnostics,
      diagnosticsState,
      input.encryptionRestore
    ),
  };
}
