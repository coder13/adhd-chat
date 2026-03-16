import { useEffect, useState } from 'react';
import Button from './Button';
import IconPickerField from './IconPickerField';
import Input from './Input';
import Modal from './Modal';

interface IdentityEditorModalProps {
  isOpen: boolean;
  title: string;
  nameLabel: string;
  descriptionLabel: string;
  nameValue: string;
  descriptionValue?: string | null;
  iconValue?: string | null;
  saveLabel: string;
  isSaving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: {
    name: string;
    description: string;
    icon: string | null;
  }) => Promise<void>;
}

function IdentityEditorModal({
  isOpen,
  title,
  nameLabel,
  descriptionLabel,
  nameValue,
  descriptionValue = '',
  iconValue = null,
  saveLabel,
  isSaving = false,
  error = null,
  onClose,
  onSave,
}: IdentityEditorModalProps) {
  const [name, setName] = useState(nameValue);
  const [description, setDescription] = useState(descriptionValue ?? '');
  const [icon, setIcon] = useState<string | null>(iconValue ?? null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(nameValue);
    setDescription(descriptionValue ?? '');
    setIcon(iconValue ?? null);
  }, [descriptionValue, iconValue, isOpen, nameValue]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <Input
          label={nameLabel}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={nameLabel}
        />
        <IconPickerField
          name={name}
          value={icon}
          onChange={setIcon}
          disabled={isSaving}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-text">
            {descriptionLabel}
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="block w-full rounded-2xl border border-line bg-elevated px-4 py-3 text-text shadow-sm transition-colors placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-canvas"
            placeholder={descriptionLabel}
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSave({ name, description, icon })}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? 'Saving...' : saveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default IdentityEditorModal;
