import MessageBubble from './MessageBubble';
import TimelineMessage from './TimelineMessage';
import type { ChatMessageProps } from './types';

function ChatMessage({ viewMode = 'timeline', ...props }: ChatMessageProps) {
  if (viewMode === 'bubbles') {
    return <MessageBubble {...props} viewMode="bubbles" />;
  }

  return <TimelineMessage {...props} />;
}

export default ChatMessage;
