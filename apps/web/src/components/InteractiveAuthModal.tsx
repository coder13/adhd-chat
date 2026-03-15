import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';

interface InteractiveAuthModalProps {
  isOpen: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

function InteractiveAuthModal({
  isOpen,
  onSubmit,
  onCancel,
}: InteractiveAuthModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!password.trim()) {
      setError('Please enter your account password');
      return;
    }

    setError('');
    onSubmit(password);
    setPassword('');
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirm Your Password"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-gray-600">
          Your homeserver requires interactive authentication before it will
          upload new cross-signing keys.
        </p>

        <Input
          label="Account Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your account password"
          error={error}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!password.trim()}>
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default InteractiveAuthModal;
