import { useEffect, useRef, useState } from 'react';
import AppAvatar from './AppAvatar';
import Button from './Button';
import ReactionPicker from './chat/ReactionPicker';

interface IconPickerFieldProps {
  name: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

function IconPickerField({
  name,
  value = null,
  onChange,
  disabled = false,
}: IconPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text">Icon</label>
      <div
        ref={containerRef}
        className="relative rounded-[24px] border border-line bg-elevated px-4 py-4"
      >
        <div className="flex items-center gap-3">
          <AppAvatar
            name={name}
            icon={value}
            className="h-12 w-12"
            textClassName="text-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-text">
              {value ? `Using ${value}` : 'No icon selected'}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Pick an emoji for this hub or topic.
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen((open) => !open)}
            disabled={disabled}
          >
            {value ? 'Change icon' : 'Choose icon'}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              disabled={disabled}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {isOpen ? (
          <div className="app-menu-surface absolute left-0 top-full z-40 mt-2 overflow-hidden rounded-[24px]">
            <ReactionPicker
              inline
              onSelect={(emoji) => {
                onChange(emoji);
                setIsOpen(false);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default IconPickerField;
