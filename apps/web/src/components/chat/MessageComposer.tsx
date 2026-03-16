import { useState } from 'react';
import { cn } from '../../lib/cn';
import { shouldSubmitComposerOnEnter } from './composerBehavior';

interface MessageComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

function MessageComposer({ onSend, disabled = false }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const sendDraft = async () => {
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendDraft();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !shouldSubmitComposerOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    ) {
      return;
    }

    event.preventDefault();
    void sendDraft();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-[28px] border border-line bg-panel p-2.5 shadow-panel sm:gap-3 sm:p-3"
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Message"
        disabled={disabled || isSending}
        className={cn(
          'max-h-40 min-h-[48px] flex-1 resize-none rounded-[22px] bg-elevated/80 px-3 py-3 text-sm leading-6 text-text outline-none placeholder:text-text-subtle',
          disabled ? 'cursor-not-allowed opacity-60' : ''
        )}
      />
      <button
        type="submit"
        disabled={disabled || isSending || !draft.trim()}
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-text-inverse shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
