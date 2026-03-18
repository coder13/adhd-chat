import type { TimelineMessage } from '../../lib/matrix/chatCatalog';

interface ComposerContextBarProps {
  mode: 'reply' | 'edit' | 'thread';
  message: TimelineMessage;
  onCancel: () => void;
}

function ComposerContextBar({
  mode,
  message,
  onCancel,
}: ComposerContextBarProps) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-line bg-panel/90 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text">
          {mode === 'reply'
            ? `Replying to ${message.senderName}`
            : mode === 'thread'
              ? `Replying in ${message.senderName}'s thread`
              : 'Editing message'}
        </p>
        <p className="truncate text-xs text-text-muted">
          {message.isDeleted ? 'Message deleted' : message.body}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 text-xs font-medium text-text-subtle underline underline-offset-2"
      >
        Cancel
      </button>
    </div>
  );
}

export default ComposerContextBar;
