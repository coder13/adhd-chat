import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import { cn } from '../../lib/cn';

function formatMessageTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

interface MessageBubbleProps {
  message: TimelineMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={cn('flex', message.isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-[22px] px-4 py-3 shadow-sm md:max-w-[70%]',
          message.isOwn
            ? 'rounded-br-md bg-accent text-text-inverse'
            : 'rounded-bl-md bg-elevated text-text'
        )}
      >
        {!message.isOwn && (
          <p className="mb-1 text-xs font-medium text-text-subtle">{message.senderId}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
        <p
          className={cn(
            'mt-2 text-right text-[11px]',
            message.isOwn ? 'text-white/75' : 'text-text-subtle'
          )}
        >
          {formatMessageTimestamp(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default MessageBubble;
