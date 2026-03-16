import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import DeviceVerificationPanel from './DeviceVerificationPanel';
import type {
  DeviceVerificationState,
  EncryptionSetupInfo,
  EncryptionSetupMode,
} from '../hooks/useMatrixClient';

interface EncryptionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: () => void;
  onLoadSetupInfo: () => Promise<EncryptionSetupInfo>;
  onGenerateKey: () => Promise<string>;
  onFinishSetup: (recoveryKey: string) => Promise<void>;
  verification: DeviceVerificationState;
  onStartDeviceVerification: () => Promise<void>;
  onStartSasVerification: () => Promise<void>;
  onConfirmSasVerification: () => Promise<void>;
  onCancelDeviceVerification: () => Promise<void>;
}

type SetupStep =
  | 'loading'
  | 'status'
  | 'generate'
  | 'display'
  | 'verify'
  | 'complete';

function EncryptionSetupModal({
  isOpen,
  onClose,
  onSetupComplete,
  onLoadSetupInfo,
  onGenerateKey,
  onFinishSetup,
  verification,
  onStartDeviceVerification,
  onStartSasVerification,
  onConfirmSasVerification,
  onCancelDeviceVerification,
}: EncryptionSetupModalProps) {
  const [step, setStep] = useState<SetupStep>('loading');
  const [mode, setMode] = useState<EncryptionSetupMode>('create');
  const [message, setMessage] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [verificationKey, setVerificationKey] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadSetupInfo = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const setupInfo = await onLoadSetupInfo();
      setMode(setupInfo.mode);
      setMessage(setupInfo.message);
      setStep(
        setupInfo.mode === 'create'
          ? 'generate'
          : setupInfo.mode === 'unlock'
            ? 'verify'
            : 'status'
      );
    } catch (e) {
      setError(String(e));
      setStep('status');
    } finally {
      setLoading(false);
    }
  }, [onLoadSetupInfo]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadSetupInfo();
  }, [isOpen, loadSetupInfo]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const key = await onGenerateKey();
      setGeneratedKey(key);
      setStep('display');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToVerification = () => {
    setStep('verify');
  };

  const handleVerify = async () => {
    if (mode === 'create' && verificationKey.trim() !== generatedKey) {
      setError('Keys do not match. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onFinishSetup(
        mode === 'create' ? generatedKey : verificationKey.trim()
      );
      setStep('complete');
      setTimeout(() => {
        onSetupComplete();
        handleClose();
      }, 1500);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    if (verification.status !== 'idle') {
      void onCancelDeviceVerification();
    }
    setStep('loading');
    setMode('create');
    setMessage('');
    setGeneratedKey('');
    setVerificationKey('');
    setError('');
    onClose();
  }, [onCancelDeviceVerification, onClose, verification.status]);

  useEffect(() => {
    if (!isOpen || verification.status !== 'done') {
      return;
    }

    setError('');
    setStep('complete');

    const timeoutId = window.setTimeout(() => {
      onSetupComplete();
      handleClose();
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [handleClose, isOpen, onSetupComplete, verification.status]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Setup End-to-End Encryption"
    >
      {isOpen && step === 'loading' && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            Inspecting this account&apos;s encryption state...
          </p>
        </div>
      )}

      {step === 'status' && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            {error || message}
          </p>
          <div className="flex justify-end">
            <Button onClick={handleClose}>
              {mode === 'ready' ? 'Done' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {step === 'generate' && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">{message}</p>
          {error && (
            <div className="rounded-2xl border border-danger/20 bg-danger-soft p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}
          {generatedKey && (
            <div className="rounded-2xl border border-warning/20 bg-warning-soft p-3 text-warning">
              {generatedKey}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Encryption Key'}
            </Button>
          </div>
        </div>
      )}

      {step === 'display' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-warning/20 bg-warning-soft p-4">
            <p className="mb-2 text-sm font-semibold text-warning">
              Important: save this key securely
            </p>
            <p className="text-sm leading-6 text-warning">
              You will need this key to decrypt your messages if you lose access
              to your device. Store it in a safe place like a password manager.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-elevated p-4">
            <label className="mb-2 block text-sm font-medium text-text">
              Your Recovery Key
            </label>
            <div className="flex items-center gap-2">
              <code className="block flex-1 break-all rounded-2xl border border-line bg-canvas p-3 font-mono text-sm text-text">
                {generatedKey}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyKey}>
                Copy
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleContinueToVerification}>
              I've Saved My Key
            </Button>
          </div>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-text-muted">
            {mode === 'create'
              ? "Please re-enter your recovery key to confirm you've saved it correctly."
              : message}
          </p>

          <Input
            label={
              mode === 'create' ? 'Enter Recovery Key' : 'Existing Recovery Key'
            }
            type="text"
            value={verificationKey}
            onChange={(e) => setVerificationKey(e.target.value)}
            placeholder={
              mode === 'create'
                ? 'Paste or type your recovery key'
                : 'Enter your existing recovery key'
            }
            error={error}
          />

          {mode === 'unlock' && (
            <DeviceVerificationPanel
              verification={verification}
              onStart={onStartDeviceVerification}
              onStartSas={onStartSasVerification}
              onConfirmSas={onConfirmSasVerification}
              onCancel={onCancelDeviceVerification}
            />
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={!verificationKey.trim() || loading}
            >
              {loading
                ? 'Finishing Setup...'
                : mode === 'create'
                  ? 'Verify Key'
                  : 'Unlock Encryption'}
            </Button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-success/20 bg-success-soft p-4">
            <p className="text-sm font-semibold text-success">
              ✓ Encryption setup complete!
            </p>
            <p className="mt-1 text-sm text-success">
              Your device is now set up for end-to-end encryption.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default EncryptionSetupModal;
