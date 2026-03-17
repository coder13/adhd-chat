import { useCallback, useEffect, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { chevronForwardOutline, keyOutline, phonePortraitOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../components';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import type { EncryptionDiagnostics } from '../../hooks/useMatrixClient';
import SettingsPageShell from './SettingsPageShell';
import { getEncryptionSettingsViewState } from './encryptionSettingsState';

type SetupStep = 'loading' | 'status' | 'display' | 'confirm' | 'complete';
type UnlockMethod = 'choose' | 'recovery-key';

function EncryptionSettingsPage() {
  const navigate = useNavigate();
  const {
    client,
    user,
    handleGenerateRecoveryKey,
    getEncryptionSetupInfo,
    getEncryptionDiagnostics,
    handleFinishEncryptionSetup,
    deviceVerification,
    encryptionRestore,
  } = useMatrixClient();
  const [setupStep, setSetupStep] = useState<SetupStep>('loading');
  const [mode, setMode] = useState<'ready' | 'unlock' | 'create' | 'blocked'>(
    'ready'
  );
  const [message, setMessage] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [unlockMethod, setUnlockMethod] = useState<UnlockMethod>('choose');
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
      const nextDiagnostics = await getEncryptionDiagnostics();
      setDiagnostics(nextDiagnostics);
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
      setUnlockMethod('choose');
      setSetupStep('status');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSetupStep('status');
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

  const handleFinish = async () => {
    const submittedKey =
      mode === 'create' ? generatedKey : recoveryKeyInput.trim();

    if (mode === 'create' && recoveryKeyInput.trim() !== generatedKey) {
      setError('Keys do not match. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await handleFinishEncryptionSetup(submittedKey);
      await refreshDiagnostics();
      setSetupStep('complete');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const recoveryOptions = [
    {
      title: 'Enter recovery key',
      description:
        'Use the key you saved earlier to unlock encrypted history on this device.',
      icon: keyOutline,
      onClick: () => {
        setError(null);
        setRecoveryKeyInput('');
        setUnlockMethod('recovery-key');
      },
    },
    {
      title: 'Use another device',
      description:
        'Approve this browser from another signed-in device, then compare emojis.',
      icon: phonePortraitOutline,
      onClick: () => {
        setError(null);
        navigate('/menu/encryption/verify');
      },
    },
  ] as const;

  return (
    <SettingsPageShell title="Encryption" backTo="/menu">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">This device</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            {loadingDiagnostics
              ? 'Checking encryption status...'
              : viewState.deviceSummary}
          </p>
        </div>
        <div className="px-3 py-1 text-xs font-medium rounded-full bg-elevated text-text-muted">
          {viewState.deviceTrustLabel}
        </div>
      </div>

      {encryptionRestore.status !== 'idle' ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 ${
            encryptionRestore.status === 'error'
              ? 'bg-danger-soft text-danger'
              : encryptionRestore.status === 'restored'
                ? 'bg-success-soft text-success'
                : 'bg-elevated text-text'
          }`}
        >
          <p className="text-sm font-medium">
            {encryptionRestore.status === 'restoring'
              ? 'Restoring encrypted history'
              : encryptionRestore.status === 'restored'
                ? 'Encrypted history restore finished'
                : 'Encrypted history restore failed'}
          </p>
          <p
            className={`mt-1 text-sm leading-6 ${
              encryptionRestore.status === 'restoring' ? 'text-text-muted' : ''
            }`}
          >
            {encryptionRestore.message}
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-elevated">
            <p className="text-sm font-medium text-text">Device trust</p>
          <p className="text-sm text-text-muted">{viewState.deviceTrustLabel}</p>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-elevated">
          <div className="min-w-0 pr-4">
            <p className="text-sm font-medium text-text">Cross-signing</p>
            <p className="mt-1 text-sm leading-5 text-text-muted">
              {viewState.crossSigningDetail}
            </p>
          </div>
          <p className="text-sm shrink-0 text-text-muted">
            {viewState.crossSigningStatusLabel}
          </p>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-elevated">
          <p className="text-sm font-medium text-text">
            Backup key on this device
          </p>
          <p className="text-sm text-text-muted">
            {viewState.backupKeyStatusLabel}
          </p>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-elevated">
          <p className="text-sm font-medium text-text">History restore</p>
          <p className="text-sm text-text-muted">
            {viewState.restoreStatusLabel}
          </p>
        </div>
        <div className="px-4 py-3 rounded-2xl bg-elevated">
          <p className="text-sm font-medium text-text">
            Old encrypted messages
          </p>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            The app cannot confirm this automatically yet. Open an older
            encrypted room to verify whether past messages now decrypt on this
            device.
          </p>
        </div>
      </div>

      {setupStep === 'loading' ? (
        <p className="text-sm leading-6 text-text-muted">
          Inspecting this account&apos;s encryption state...
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {viewState.setupHeading}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {viewState.effectiveMessage}
            </p>
          </div>

          {viewState.effectiveMode === 'create' && setupStep === 'status' && (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleGenerate()} disabled={loading}>
                {loading ? 'Generating...' : 'Generate recovery key'}
              </Button>
            </div>
          )}

          {viewState.effectiveMode === 'create' && setupStep === 'display' && (
            <>
              <div className="px-4 py-4 rounded-3xl bg-warning-soft">
                <p className="text-sm leading-6 text-warning">
                  Save this recovery key somewhere safe before continuing.
                </p>
              </div>

              <div className="px-4 py-4 rounded-3xl bg-elevated">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-text-muted">
                  Recovery key
                </p>
                <code className="block font-mono text-sm break-all text-text">
                  {generatedKey}
                </code>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(generatedKey)}
                >
                  Copy key
                </Button>
                <Button onClick={() => setSetupStep('confirm')}>
                  I&apos;ve saved it
                </Button>
              </div>
            </>
          )}

          {viewState.effectiveMode === 'create' && setupStep === 'confirm' && (
            <>
              <Input
                label="Re-enter recovery key"
                type="text"
                value={recoveryKeyInput}
                onChange={(event) => setRecoveryKeyInput(event.target.value)}
                placeholder="Paste the recovery key you just saved"
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void handleFinish()}
                  disabled={!recoveryKeyInput.trim() || loading}
                >
                  {loading ? 'Finishing setup...' : 'Finish encryption setup'}
                </Button>
              </div>
            </>
          )}

          {viewState.effectiveMode === 'unlock' && setupStep === 'status' && (
            <>
              {unlockMethod === 'choose' ? (
                <div className="grid gap-3">
                  {recoveryOptions.map((option) => (
                    <button
                      key={option.title}
                      type="button"
                      className="flex items-center gap-4 px-4 py-4 text-left transition-colors rounded-3xl bg-elevated hover:bg-elevated/80"
                      onClick={option.onClick}
                    >
                      <div className="flex items-center justify-center bg-white w-11 h-11 rounded-2xl text-text">
                        <IonIcon icon={option.icon} className="text-[20px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-text">
                          {option.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-text-muted">
                          {option.description}
                        </p>
                      </div>
                      <IonIcon
                        icon={chevronForwardOutline}
                        className="text-lg shrink-0 text-text-muted"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <Input
                    label="Recovery key"
                    type="text"
                    value={recoveryKeyInput}
                    onChange={(event) =>
                      setRecoveryKeyInput(event.target.value)
                    }
                    placeholder="Enter your existing recovery key"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => void handleFinish()}
                      disabled={!recoveryKeyInput.trim() || loading}
                    >
                      {loading ? 'Unlocking...' : 'Unlock with recovery key'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setRecoveryKeyInput('');
                        setUnlockMethod('choose');
                      }}
                    >
                      Back
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {viewState.effectiveMode === 'ready' &&
          viewState.diagnosticsState === 'ready' ? (
            <Button variant="outline" onClick={() => void refreshDiagnostics()}>
              Refresh status
            </Button>
          ) : null}

          {viewState.effectiveMode === 'blocked' && (
            <div className="space-y-3">
              <Button onClick={() => navigate('/menu/encryption/verify')}>
                Use another device
              </Button>
              <Button
                variant="outline"
                onClick={() => void refreshDiagnostics()}
              >
                Refresh status
              </Button>
            </div>
          )}

          {viewState.diagnosticsState === 'unavailable' &&
          viewState.effectiveMode !== 'blocked' ? (
            <Button variant="outline" onClick={() => void refreshDiagnostics()}>
              Refresh status
            </Button>
          ) : null}

          {setupStep === 'complete' && (
            <div className="px-4 py-4 rounded-3xl bg-success-soft">
              <h3 className="text-lg font-semibold text-success">
                Encryption is ready
              </h3>
              <p className="mt-2 text-sm leading-6 text-success">
                This device can now restore your encrypted history.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </SettingsPageShell>
  );
}

export default EncryptionSettingsPage;
