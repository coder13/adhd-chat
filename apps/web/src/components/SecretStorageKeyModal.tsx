import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';

interface SecretStorageKeyModalProps {
  isOpen: boolean;
  onProvideKey: (key: string) => void;
  onCancel: () => void;
}

function SecretStorageKeyModal({
  isOpen,
  onProvideKey,
  onCancel,
}: SecretStorageKeyModalProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!key.trim()) {
      setError('Please enter your recovery key');
      return;
    }
    setError('');
    onProvideKey(key.trim());
    setKey('');
  };

  const handleCancel = () => {
    setKey('');
    setError('');
    onCancel();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Enter Recovery Key">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-muted">
          Enter your recovery key to decrypt your messages. This is the key you
          saved when you first set up encryption.
        </p>

        <Input
          label="Recovery Key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter your recovery key"
          error={error}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!key.trim()}>
            Unlock
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SecretStorageKeyModal;
