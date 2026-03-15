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
          <p className="text-gray-600">
            Inspecting this account&apos;s encryption state...
          </p>
        </div>
      )}

      {step === 'status' && (
        <div className="space-y-4">
          <p className="text-gray-600">{error || message}</p>
          <div className="flex justify-end">
            <Button onClick={handleClose}>
              {mode === 'ready' ? 'Done' : 'Close'}
            </Button>
          </div>
        </div>
      )}

      {step === 'generate' && (
        <div className="space-y-4">
          <p className="text-gray-600">{message}</p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {generatedKey && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              {generatedKey}
            </div>
          )}
          <div className="flex justify-end space-x-3">
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
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-semibold mb-2">
              ⚠️ Important: Save this key securely
            </p>
            <p className="text-sm text-yellow-700">
              You will need this key to decrypt your messages if you lose access
              to your device. Store it in a safe place like a password manager.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Recovery Key
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 block p-3 bg-white border border-gray-300 rounded font-mono text-sm break-all">
                {generatedKey}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyKey}>
                Copy
              </Button>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
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
          <p className="text-gray-600">
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

          <div className="flex justify-end space-x-3">
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
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-semibold">
              ✓ Encryption setup complete!
            </p>
            <p className="text-sm text-green-700 mt-1">
              Your device is now set up for end-to-end encryption.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default EncryptionSetupModal;
