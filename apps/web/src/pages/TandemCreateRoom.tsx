import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '../components';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useTandem } from '../hooks/useTandem';
import { startPendingTandemRoomCreation } from '../lib/matrix/pendingTandemRoom';

function TandemCreateRoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { client, user } = useMatrixClient();
  const { relationships } = useTandem(client, user?.userId);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('Tandem');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selectedSpaceId = searchParams.get('space');
  const relationship =
    relationships.find((entry) => entry.sharedSpaceId === selectedSpaceId) ??
    (relationships.length === 1 ? relationships[0] : null);

  const starterRooms = [
    {
      label: 'Plans',
      topic: 'Trips, dates, chores, and the next things to do together.',
      category: 'Planning',
    },
    {
      label: 'Trips',
      topic: 'Travel ideas, bookings, and shared itineraries.',
      category: 'Travel',
    },
    {
      label: 'Check-ins',
      topic: 'Weekly reflections, mood updates, and what support looks like.',
      category: 'Care',
    },
  ];

  const applyStarter = (starter: (typeof starterRooms)[number]) => {
    setName(starter.label);
    setTopic(starter.topic);
    setCategory(starter.category);
  };

  const handleCreate = async () => {
    if (!client || !user || !relationship) {
      setError('Open a Tandem space first, then create a room inside it.');
      return;
    }

    setError(null);
    setCreating(true);
    const pendingRoom = startPendingTandemRoomCreation({
      client,
      relationship,
      creatorUserId: user.userId,
      name,
      topic,
      category,
    });
    setCreating(false);
    navigate(`/room/${encodeURIComponent(pendingRoom.pendingRoomId)}`);
  };

  return (
    <IonPage className="app-shell">
      <IonHeader className="ion-no-border">
        <IonToolbar className="app-toolbar">
          <IonButtons slot="start">
            <IonButton fill="clear" onClick={() => navigate(-1)}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle className="text-[28px] font-semibold">New Tandem Room</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-list-page">
        <div className="space-y-4 px-4 py-4">
          <Card tone="accent">
            <h2 className="text-lg font-semibold text-text">Create inside your Tandem space</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              This creates a private room, invites your partner, and attaches it to your
              shared Tandem space automatically.
            </p>
            {relationship && (
              <p className="mt-3 text-sm text-text-muted">
                Creating in space with {relationship.partnerUserId}
              </p>
            )}
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-text">Starter rooms</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {starterRooms.map((starter) => (
                <Button
                  key={starter.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyStarter(starter)}
                >
                  {starter.label}
                </Button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="space-y-3">
              <Input
                label="Room name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Plans"
              />
              <Input
                label="Topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="What this room is for"
              />
              <Input
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Planning"
              />
            </div>

            {!relationship && (
              <p className="mt-4 text-sm text-danger">
                No Tandem space is selected. Open a space from the Chats feed first.
              </p>
            )}

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex gap-3">
              <Button onClick={handleCreate} disabled={creating || !name.trim() || !relationship}>
                {creating ? 'Creating room...' : 'Create room'}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default TandemCreateRoomPage;
