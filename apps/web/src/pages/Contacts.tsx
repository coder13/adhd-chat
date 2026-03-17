import { IonFab, IonFabButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { ClientEvent } from 'matrix-js-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components';
import { ContactsList, ListPageLayout } from '../components/ionic';
import { usePersistedResource } from '../hooks/usePersistedResource';
import { useMatrixClient } from '../hooks/useMatrixClient';
import {
  buildContactCatalog,
  type ContactSummary,
} from '../lib/matrix/chatCatalog';

function Contacts() {
  const { client, isReady, user, error, bootstrapUserId } = useMatrixClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const cacheUserId = user?.userId ?? bootstrapUserId;
  const cacheKey = cacheUserId ? `contacts:${cacheUserId}` : null;
  const {
    data: contacts,
    error: contactsError,
    refresh: refreshContacts,
    isLoading,
  } = usePersistedResource<ContactSummary[]>({
    cacheKey,
    enabled: Boolean(client && user && isReady),
    initialValue: [],
    load: async () => buildContactCatalog(client!, user!.userId),
  });

  useEffect(() => {
    if (!client || !user || !isReady) {
      return;
    }
    client.on(ClientEvent.Sync, refreshContacts);

    return () => {
      client.off(ClientEvent.Sync, refreshContacts);
    };
  }, [client, isReady, refreshContacts, user]);

  const visibleContacts = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return contacts;
    }

    return contacts.filter((contact) => {
      return (
        contact.displayName.toLowerCase().includes(searchValue) ||
        contact.userId.toLowerCase().includes(searchValue)
      );
    });
  }, [contacts, search]);

  return (
    <ListPageLayout
      title="Contacts"
      headerContent={
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search contacts"
          className="block w-full rounded-2xl border border-line bg-elevated px-4 py-3 text-text shadow-sm placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      }
    >
      <div className="space-y-4 px-4 pb-24 pt-4">
        <div>
          <h2 className="text-lg font-semibold text-text">
            People you already know
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Contacts come from your active direct chats. Use the add button to
            look up someone by Matrix ID and invite them into Tandem.
          </p>
        </div>

        {(error || contactsError) && (
          <div className="text-sm text-danger">{error || contactsError}</div>
        )}

        {visibleContacts.length === 0 && !isLoading ? (
          <EmptyState
            title="No contacts yet"
            body="People from your direct conversations will show up here once you have chatted."
          />
        ) : isLoading && visibleContacts.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">
            Loading contacts...
          </div>
        ) : (
          <ContactsList contacts={visibleContacts} />
        )}
      </div>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton onClick={() => navigate('/contacts/new')}>
          <IonIcon icon={add} />
        </IonFabButton>
      </IonFab>
    </ListPageLayout>
  );
}

export default Contacts;
