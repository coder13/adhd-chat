import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';

interface EncryptionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: () => void;
  onGenerateKey: () => Promise<string>;
}

type SetupStep = 'generate' | 'display' | 'verify' | 'complete';

function EncryptionSetupModal({
  isOpen,
  onClose,
  onSetupComplete,
  onGenerateKey,
}: EncryptionSetupModalProps) {
  const [step, setStep] = useState<SetupStep>('generate');
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [verificationKey, setVerificationKey] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

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

  const handleVerify = () => {
    if (verificationKey.trim() !== generatedKey) {
      setError('Keys do not match. Please try again.');
      return;
    }
    setStep('complete');
    setTimeout(() => {
      onSetupComplete();
      handleClose();
    }, 1500);
  };

  const handleClose = () => {
    setStep('generate');
    setGeneratedKey('');
    setVerificationKey('');
    setError('');
    onClose();
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Setup End-to-End Encryption">
      {step === 'generate' && (
        <div className="space-y-4">
          <p className="text-gray-600">
            Generate a recovery key to enable end-to-end encryption. This key will allow you to
            decrypt your messages on new devices.
          </p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
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
              You will need this key to decrypt your messages if you lose access to your device.
              Store it in a safe place like a password manager.
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
            Please re-enter your recovery key to confirm you've saved it correctly.
          </p>

          <Input
            label="Enter Recovery Key"
            type="text"
            value={verificationKey}
            onChange={(e) => setVerificationKey(e.target.value)}
            placeholder="Paste or type your recovery key"
            error={error}
          />

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={!verificationKey.trim()}
            >
              Verify Key
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
