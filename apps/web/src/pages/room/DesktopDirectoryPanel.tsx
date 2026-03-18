import { ClientEvent } from 'matrix-js-sdk';
import { useEffect, useMemo } from 'react';
import { EmptyState } from '../../components';
import { ContactsList } from '../../components/ionic';
import { usePersistedResource } from '../../hooks/usePersistedResource';
import { useThrottledRefresh } from '../../hooks/useThrottledRefresh';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  buildChatCatalog,
  buildContactCatalog,
  type ChatSummary,
  type ContactSummary,
} from '../../lib/matrix/chatCatalog';
import {
  buildTandemSpaceCatalog,
  type TandemSpaceSummary,
} from '../../lib/matrix/spaceCatalog';
import { formatTopicCountLabel } from '../../lib/matrix/tandemPresentation';
import AddContactPanel from './AddContactPanel';
import DesktopRailRoomItem from './DesktopRailRoomItem';

export type DesktopDirectoryView = 'contacts' | 'other' | 'hubs' | 'add-contact';

interface DesktopDirectoryPanelProps {
  view: DesktopDirectoryView;
  onSelectHub?: (space: TandemSpaceSummary) => void;
  onOpenRoute?: (path: string) => void;
  onOpenAddContact?: () => void;
  currentRoomId?: string;
}

function DesktopDirectoryPanel({
  view,
  onSelectHub,
  onOpenRoute,
  onOpenAddContact,
  currentRoomId,
}: DesktopDirectoryPanelProps) {
  const { client, isReady, user, bootstrapUserId } = useMatrixClient();
  const cacheUserId = user?.userId ?? bootstrapUserId;

  const {
    data: contacts,
    refresh: refreshContacts,
    isLoading: isLoadingContacts,
  } = usePersistedResource<ContactSummary[]>({
    cacheKey:
      view === 'contacts' && cacheUserId ? `contacts:${cacheUserId}` : null,
    enabled: view === 'contacts' && Boolean(client && user && isReady),
    initialValue: [],
    load: async () => buildContactCatalog(client!, user!.userId),
    preserveValue: (currentContacts, nextContacts) => {
      if (nextContacts.length === 0 && currentContacts.length > 0) {
        return currentContacts;
      }

      return nextContacts;
    },
  });
  const scheduleRefreshContacts = useThrottledRefresh(refreshContacts);

  const {
    data: hubs,
    refresh: refreshHubs,
    isLoading: isLoadingHubs,
  } = usePersistedResource<TandemSpaceSummary[]>({
    cacheKey:
      view === 'hubs' && cacheUserId ? `tandem-spaces:${cacheUserId}` : null,
    enabled: view === 'hubs' && Boolean(client && user && isReady),
    initialValue: [],
    load: async () => buildTandemSpaceCatalog(client!, user!.userId),
  });
  const scheduleRefreshHubs = useThrottledRefresh(refreshHubs);

  const {
    data: otherChats,
    refresh: refreshOtherRooms,
    isLoading: isLoadingOtherRooms,
  } = usePersistedResource<ChatSummary[]>({
    cacheKey:
      view === 'other' && cacheUserId
        ? `desktop-other-rooms:${cacheUserId}`
        : null,
    enabled: view === 'other' && Boolean(client && user && isReady),
    initialValue: [],
    load: async () => {
      const catalog = await buildChatCatalog(client!, user!.userId);
      return catalog.otherChats;
    },
  });
  const scheduleRefreshOtherRooms = useThrottledRefresh(refreshOtherRooms);

  useEffect(() => {
    if (!client || !user || !isReady) {
      return;
    }

    const handleSync = () => {
      if (view === 'contacts') {
        scheduleRefreshContacts();
        return;
      }

      if (view === 'hubs') {
        scheduleRefreshHubs();
        return;
      }

      scheduleRefreshOtherRooms();
    };

    client.on(ClientEvent.Sync, handleSync);

    return () => {
      client.off(ClientEvent.Sync, handleSync);
    };
  }, [
    client,
    isReady,
    scheduleRefreshContacts,
    scheduleRefreshHubs,
    scheduleRefreshOtherRooms,
    user,
    view,
  ]);

  const body = useMemo(() => {
    if (view === 'add-contact') {
      return <AddContactPanel />;
    }

    if (view === 'contacts') {
      if (isLoadingContacts && contacts.length === 0) {
        return (
          <div className="py-12 text-sm text-center text-text-muted">
            Loading contacts...
          </div>
        );
      }

      if (contacts.length === 0) {
        return (
          <div className="space-y-4">
            <button
              type="button"
              onClick={onOpenAddContact}
              className="flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-emphasis"
            >
              Add contact
            </button>
            <EmptyState
              title="No contacts yet"
              body="People from your direct conversations will show up here once you have chatted."
            />
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onOpenAddContact}
            className="flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-emphasis"
          >
            Add contact
          </button>
          <ContactsList contacts={contacts} />
        </div>
      );
    }

    if (view === 'hubs') {
      if (isLoadingHubs && hubs.length === 0) {
        return (
          <div className="py-12 text-sm text-center text-text-muted">
            Loading hubs...
          </div>
        );
      }

      if (hubs.length === 0) {
        return (
          <EmptyState
            title="No hubs yet"
            body="Invite a partner to create your first shared hub."
          />
        );
      }

      return (
        <div className="space-y-1.5">
          {hubs.map((space) => {
            return (
              <DesktopRailRoomItem
                key={space.spaceId}
                onClick={() => onSelectHub?.(space)}
                name={space.name}
                icon={space.icon}
                preview={space.description || space.preview}
                footerLabel={formatTopicCountLabel(space.roomCount)}
              />
            );
          })}
        </div>
      );
    }

    if (isLoadingOtherRooms && otherChats.length === 0) {
      return (
        <div className="py-12 text-sm text-center text-text-muted">
          Loading rooms...
        </div>
      );
    }

    if (otherChats.length === 0) {
      return (
        <EmptyState
          title="No extra rooms"
          body="Rooms outside the main ADHD Chat flow show up here."
        />
      );
    }

    return (
      <div className="space-y-1.5">
        {otherChats.map((chat) => {
          const badges = [
            chat.nativeSpaceName
              ? { label: chat.nativeSpaceName, tone: 'primary' as const }
              : null,
            chat.isPinned
              ? { label: 'Pinned', tone: 'neutral' as const }
              : null,
            chat.isEncrypted
              ? { label: 'Encrypted', tone: 'success' as const }
              : null,
          ].filter((badge) => badge !== null);

          return (
            <DesktopRailRoomItem
              key={chat.id}
              onClick={() =>
                onOpenRoute?.(`/room/${encodeURIComponent(chat.id)}`)
              }
              name={chat.name}
              icon={chat.icon}
              preview={chat.preview}
              unreadCount={chat.unreadCount}
              timestampLabel={formatChatTimestamp(chat.timestamp)}
              badges={badges}
              isActive={chat.id === currentRoomId}
            />
          );
        })}
      </div>
    );
  }, [
    contacts,
    currentRoomId,
    hubs,
    isLoadingContacts,
    isLoadingHubs,
    isLoadingOtherRooms,
    onOpenAddContact,
    onSelectHub,
    onOpenRoute,
    otherChats,
    view,
  ]);

  return <div className="flex-1 min-h-0 px-3 py-3 overflow-y-auto">{body}</div>;
}

export default DesktopDirectoryPanel;

function formatChatTimestamp(timestamp: number) {
  if (!timestamp) {
    return null;
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
