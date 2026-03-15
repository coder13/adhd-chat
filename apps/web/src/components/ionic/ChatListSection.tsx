import {
  IonAvatar,
  IonBadge,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/react';
import type { ChatSummary } from '../../lib/matrix/chatCatalog';

function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

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

interface ChatListSectionProps {
  chats: ChatSummary[];
  emptyTitle: string;
  emptyBody: string;
}

function ChatListSection({
  chats,
  emptyTitle,
  emptyBody,
}: ChatListSectionProps) {
  if (chats.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-base font-medium text-text">{emptyTitle}</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{emptyBody}</p>
      </div>
    );
  }

  return (
    <IonList lines="none" className="app-list">
      {chats.map((chat) => (
        <IonItem
          key={chat.id}
          button
          detail={false}
          routerLink={`/room/${encodeURIComponent(chat.id)}`}
          className="app-list-item"
        >
          <IonAvatar slot="start" className="h-12 w-12 bg-accent-soft">
            <div className="flex h-full items-center justify-center font-semibold text-accent">
              {chat.name.charAt(0).toUpperCase()}
            </div>
          </IonAvatar>
          <IonLabel className="py-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-[15px] font-semibold text-text">
                {chat.name}
              </h2>
              <IonNote color="medium" className="text-xs">
                {formatTimestamp(chat.timestamp)}
              </IonNote>
            </div>
            <p className="mt-1 truncate text-sm text-text-muted">{chat.preview}</p>
            <div className="mt-2 flex items-center gap-2">
              {chat.nativeSpaceName && (
                <IonBadge color="primary" className="rounded-full px-2 py-1 text-[10px]">
                  {chat.nativeSpaceName}
                </IonBadge>
              )}
              {chat.isEncrypted && (
                <IonBadge color="success" className="rounded-full px-2 py-1 text-[10px]">
                  Encrypted
                </IonBadge>
              )}
            </div>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}

export default ChatListSection;
