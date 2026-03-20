import MessageBubble from './MessageBubble';
import type { ChatMessageProps } from './types';

function TimelineMessage(props: ChatMessageProps) {
  return <MessageBubble {...props} viewMode="timeline" />;
}

export default TimelineMessage;
