import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DeviceVerificationPanel, Input } from '../../components';
import {
  useMatrixClient,
  type EncryptionDiagnostics,
} from '../../hooks/useMatrixClient';
import { getEncryptionSettingsViewState } from '../settings/encryptionSettingsState';

type SetupStep = 'status' | 'display' | 'unlock';

export default function DesktopEncryptionPanel() {
  const {
    client,
    user,
    handleGenerateRecoveryKey,
    getEncryptionSetupInfo,
    getEncryptionDiagnostics,
    handleFinishEncryptionSetup,
    deviceVerification,
    encryptionRestore,
    startDeviceVerificationUnlock,
    startSasDeviceVerification,
    confirmSasDeviceVerification,
    cancelDeviceVerification,
  } = useMatrixClient();
  const [setupStep, setSetupStep] = useState<SetupStep>('status');
  const [mode, setMode] = useState<'ready' | 'unlock' | 'create' | 'blocked'>(
    'ready'
  );
  const [message, setMessage] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<EncryptionDiagnostics | null>(
    null
  );
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  const refreshDiagnostics = useCallback(async () => {
    if (!client || !user) {
      return;
    }

    setLoadingDiagnostics(true);
    try {
      setDiagnostics(await getEncryptionDiagnostics());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingDiagnostics(false);
    }
  }, [client, getEncryptionDiagnostics, user]);

  const loadSetupInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const setupInfo = await getEncryptionSetupInfo();
      setMode(setupInfo.mode);
      setMessage(setupInfo.message);
      setSetupStep(setupInfo.mode === 'unlock' ? 'unlock' : 'status');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [getEncryptionSetupInfo]);

  useEffect(() => {
    void loadSetupInfo();
    void refreshDiagnostics();
  }, [loadSetupInfo, refreshDiagnostics]);

  useEffect(() => {
    if (deviceVerification.status !== 'done') {
      return;
    }

    void loadSetupInfo();
    void refreshDiagnostics();
  }, [deviceVerification.status, loadSetupInfo, refreshDiagnostics]);

  const viewState = useMemo(
    () =>
      getEncryptionSettingsViewState({
        mode,
        message,
        diagnostics,
        loadingDiagnostics,
        encryptionRestore,
      }),
    [diagnostics, encryptionRestore, loadingDiagnostics, message, mode]
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const key = await handleGenerateRecoveryKey();
      setGeneratedKey(key);
      setRecoveryKeyInput('');
      setSetupStep('display');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (submittedKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await handleFinishEncryptionSetup(submittedKey.trim());
      await loadSetupInfo();
      await refreshDiagnostics();
      setRecoveryKeyInput('');
      setGeneratedKey('');
      setSetupStep('status');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-text">This device</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {loadingDiagnostics
                ? 'Checking encryption status...'
                : viewState.deviceSummary}
            </p>
          </div>
          <div className="rounded-full bg-elevated px-3 py-1 text-xs font-medium text-text-muted">
            {viewState.deviceTrustLabel}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <StatusRow label="Cross-signing" value={viewState.crossSigningStatusLabel} />
          <StatusRow label="Backup key" value={viewState.backupKeyStatusLabel} />
          <StatusRow label="History restore" value={viewState.restoreStatusLabel} />
        </div>
      </Card>

      {setupStep === 'status' ? (
        <Card className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-text">
              {viewState.setupHeading}
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {viewState.effectiveMessage}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {mode === 'create' ? (
              <Button
                className="bg-accent text-white hover:bg-accent-emphasis"
                onClick={() => void handleGenerate()}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate recovery key'}
              </Button>
            ) : null}

            {mode === 'unlock' || mode === 'blocked' ? (
              <Button
                className="bg-accent text-white hover:bg-accent-emphasis"
                onClick={() => setSetupStep('unlock')}
              >
                Unlock with recovery key
              </Button>
            ) : null}

            <Button variant="outline" onClick={() => void refreshDiagnostics()}>
              Refresh status
            </Button>
          </div>
        </Card>
      ) : null}

      {setupStep === 'display' ? (
        <Card className="space-y-4">
          <div className="rounded-2xl border border-warning/20 bg-warning-soft p-4">
            <p className="text-sm leading-6 text-warning">
              Save this recovery key securely before continuing.
            </p>
          </div>
          <code className="block break-all rounded-2xl border border-line bg-elevated p-4 font-mono text-sm text-text">
            {generatedKey}
          </code>
          <Input
            label="Type the recovery key to confirm"
            value={recoveryKeyInput}
            onChange={(event) => setRecoveryKeyInput(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-accent text-white hover:bg-accent-emphasis"
              disabled={loading || recoveryKeyInput.trim() !== generatedKey}
              onClick={() => void handleUnlock(generatedKey)}
            >
              {loading ? 'Saving...' : 'Finish setup'}
            </Button>
            <Button variant="outline" onClick={() => setSetupStep('status')}>
              Back
            </Button>
          </div>
        </Card>
      ) : null}

      {setupStep === 'unlock' ? (
        <Card className="space-y-4">
          <Input
            label="Recovery key"
            value={recoveryKeyInput}
            onChange={(event) => setRecoveryKeyInput(event.target.value)}
            placeholder="Enter your recovery key"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-accent text-white hover:bg-accent-emphasis"
              disabled={loading || recoveryKeyInput.trim().length === 0}
              onClick={() => void handleUnlock(recoveryKeyInput)}
            >
              {loading ? 'Unlocking...' : 'Unlock this device'}
            </Button>
            <Button variant="outline" onClick={() => setSetupStep('status')}>
              Back
            </Button>
          </div>
        </Card>
      ) : null}

      <DeviceVerificationPanel
        verification={deviceVerification}
        onStart={startDeviceVerificationUnlock}
        onStartSas={startSasDeviceVerification}
        onConfirmSas={confirmSasDeviceVerification}
        onCancel={cancelDeviceVerification}
      />

      {error ? (
        <Card tone="muted">
          <div className="text-sm text-danger">{error}</div>
        </Card>
      ) : null}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-elevated px-4 py-3">
      <div className="text-sm font-medium text-text">{label}</div>
      <div className="text-sm text-text-muted">{value}</div>
    </div>
  );
}
