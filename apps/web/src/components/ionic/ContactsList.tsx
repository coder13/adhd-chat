import { IonItem, IonLabel, IonList, IonNote } from '@ionic/react';
import { AppAvatar } from '..';
import type { ContactSummary } from '../../lib/matrix/chatCatalog';

function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(timestamp);
}

interface ContactsListProps {
  contacts: ContactSummary[];
}

function ContactsList({ contacts }: ContactsListProps) {
  if (contacts.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-base font-medium text-text">No contacts yet</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          People from your direct chats will show up here.
        </p>
      </div>
    );
  }

  return (
    <IonList lines="none" className="app-list">
      {contacts.map((contact) => (
        <IonItem
          key={contact.userId}
          button
          detail={false}
          routerLink={`/room/${encodeURIComponent(contact.roomId)}`}
          className="app-list-item app-hover-surface"
        >
          <AppAvatar name={contact.displayName} className="h-12 w-12" />
          <IonLabel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-[15px] font-semibold text-text">
                {contact.displayName}
              </h2>
              <IonNote color="medium" className="text-xs">
                {formatTimestamp(contact.lastMessageTs)}
              </IonNote>
            </div>
            <p className="mt-1 truncate text-sm text-text-muted">
              {contact.userId}
            </p>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}

export default ContactsList;
