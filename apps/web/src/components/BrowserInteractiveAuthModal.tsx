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
        <p className="text-sm leading-6 text-text-muted">{description}</p>
        <p className="text-sm leading-6 text-text-subtle">
          Open the authentication page, complete the homeserver prompt, then
          return here and continue.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            Open Authentication
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      </div>
    </Modal>
  );
}

export default BrowserInteractiveAuthModal;
