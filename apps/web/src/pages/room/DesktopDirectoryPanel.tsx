import { ClientEvent } from 'matrix-js-sdk';
import { useEffect, useMemo } from 'react';
import { EmptyState } from '../../components';
import { ChatListSection, ContactsList } from '../../components/ionic';
import { usePersistedResource } from '../../hooks/usePersistedResource';
import { useThrottledRefresh } from '../../hooks/useThrottledRefresh';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  buildChatCatalog,
  buildContactCatalog,
  type ChatSummary,
  type ContactSummary,
} from '../../lib/matrix/chatCatalog';

export type DesktopDirectoryView = 'contacts' | 'other';

interface DesktopDirectoryPanelProps {
  view: DesktopDirectoryView;
}

function DesktopDirectoryPanel({ view }: DesktopDirectoryPanelProps) {
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
  });
  const scheduleRefreshContacts = useThrottledRefresh(refreshContacts);

  const {
    data: otherChats,
    refresh: refreshOtherRooms,
    isLoading: isLoadingOtherRooms,
  } = usePersistedResource<ChatSummary[]>({
    cacheKey:
      view === 'other' && cacheUserId ? `desktop-other-rooms:${cacheUserId}` : null,
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
    scheduleRefreshOtherRooms,
    user,
    view,
  ]);

  const body = useMemo(() => {
    if (view === 'contacts') {
      if (isLoadingContacts && contacts.length === 0) {
        return (
          <div className="py-12 text-center text-sm text-text-muted">
            Loading contacts...
          </div>
        );
      }

      if (contacts.length === 0) {
        return (
          <EmptyState
            title="No contacts yet"
            body="People from your direct conversations will show up here once you have chatted."
          />
        );
      }

      return <ContactsList contacts={contacts} />;
    }

    if (isLoadingOtherRooms && otherChats.length === 0) {
      return (
        <div className="py-12 text-center text-sm text-text-muted">
          Loading rooms...
        </div>
      );
    }

    return (
      <ChatListSection
        chats={otherChats}
        emptyTitle="No extra rooms"
        emptyBody="Rooms outside the main ADHD Chat flow show up here."
      />
    );
  }, [contacts, isLoadingContacts, isLoadingOtherRooms, otherChats, view]);

  return <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{body}</div>;
}

export default DesktopDirectoryPanel;
