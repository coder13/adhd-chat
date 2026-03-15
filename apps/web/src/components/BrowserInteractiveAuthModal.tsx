import Modal from './Modal';
import Button from './Button';

interface BrowserInteractiveAuthModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  url: string;
  onContinue: () => void;
  onCancel: () => void;
}

function BrowserInteractiveAuthModal({
  isOpen,
  title,
  description,
  url,
  onContinue,
  onCancel,
}: BrowserInteractiveAuthModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-gray-600">{description}</p>
        <p className="text-sm text-gray-500">
          Open the authentication page, complete the homeserver prompt, then
          return here and continue.
        </p>
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => {
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            Open Authentication
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onContinue}>Continue</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default BrowserInteractiveAuthModal;
