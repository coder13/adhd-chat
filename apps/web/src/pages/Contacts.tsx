import { IonButton, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components';
import { ContactsList, ListPageLayout } from '../components/ionic';
import { useContactCatalogStore } from '../hooks/useContactCatalogStore';
import { useMatrixClient } from '../hooks/useMatrixClient';

function Contacts() {
  const { client, isReady, user, error } = useMatrixClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const {
    data: contacts,
    error: contactsError,
    isLoading,
  } = useContactCatalogStore({
    client,
    enabled: Boolean(user),
    isReady,
    userId: user?.userId ?? null,
  });

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
      endSlot={
        <IonButton
          fill="clear"
          color="dark"
          className="text-text"
          onClick={() => navigate('/contacts/new')}
        >
          <IonIcon icon={add} slot="start" />
          Add
        </IonButton>
      }
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

    </ListPageLayout>
  );
}

export default Contacts;
