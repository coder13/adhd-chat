import { Link } from 'react-router-dom';
import type { ChatSummary } from '../../lib/matrix/chatCatalog';
import Avatar from './Avatar';
import { cn } from '../../lib/cn';

function formatChatTimestamp(timestamp: number) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const today = new Date();
  const isSameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return isSameDay
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(date);
}

interface ConversationListProps {
  chats: ChatSummary[];
  activeRoomId?: string | null;
  emptyTitle: string;
  emptyBody: string;
}

function ConversationList({
  chats,
  activeRoomId,
  emptyTitle,
  emptyBody,
}: ConversationListProps) {
  if (chats.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-base font-medium text-text">{emptyTitle}</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 px-3 pb-4">
      {chats.map((chat) => {
        const isActive = activeRoomId === chat.id;

        return (
          <Link
            key={chat.id}
            to={`/room/${encodeURIComponent(chat.id)}`}
            className={cn(
              'app-interactive-list-item flex items-center gap-3 rounded-[26px] px-3 py-3',
              isActive ? 'is-active' : ''
            )}
          >
            <Avatar name={chat.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p
                  className={cn(
                    'truncate text-sm font-semibold',
                    isActive ? 'text-primary-strong' : 'text-text'
                  )}
                >
                  {chat.name}
                </p>
                <p
                  className={cn(
                    'text-xs',
                    isActive ? 'text-primary/80' : 'text-text-subtle'
                  )}
                >
                  {formatChatTimestamp(chat.timestamp)}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p
                  className={cn(
                    'truncate text-sm',
                    isActive ? 'text-primary/85' : 'text-text-muted'
                  )}
                >
                  {chat.preview}
                </p>
                {chat.isEncrypted && (
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isActive ? 'bg-secondary' : 'bg-secondary'
                    )}
                  />
                )}
              </div>
              {chat.nativeSpaceName && !isActive && (
                <p className="mt-1 truncate text-xs text-text-subtle">
                  {chat.nativeSpaceName}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default ConversationList;
