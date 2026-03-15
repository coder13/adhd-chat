import { useState } from 'react';
import { cn } from '../../lib/cn';

interface MessageComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

function MessageComposer({ onSend, disabled = false }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextMessage = draft.trim();
    if (!nextMessage || isSending || disabled) {
      return;
    }

    setIsSending(true);

    try {
      await onSend(nextMessage);
      setDraft('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 rounded-[28px] border border-line bg-panel p-3 shadow-panel"
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={1}
        placeholder="Message"
        disabled={disabled || isSending}
        className={cn(
          'max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-text outline-none placeholder:text-text-subtle',
          disabled ? 'cursor-not-allowed opacity-60' : ''
        )}
      />
      <button
        type="submit"
        disabled={disabled || isSending || !draft.trim()}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-text-inverse transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M3.4 20.6 21 12 3.4 3.4l.1 6.6 11.2 2-11.2 2-.1 6.6Z" />
        </svg>
      </button>
    </form>
  );
}

export default MessageComposer;
