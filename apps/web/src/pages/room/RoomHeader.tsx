import { IonButton, IonButtons, IonHeader, IonIcon, IonToolbar } from '@ionic/react';
import { arrowBack, ellipsisHorizontal, gitBranchOutline, pin, searchOutline, star, starOutline } from 'ionicons/icons';
import { AppAvatar } from '../../components';

interface RoomHeaderProps {
  roomName: string;
  roomDescription: string | null;
  roomIcon: string | null;
  roomSubtitle: string | null;
  typingIndicator: string | null;
  isEncrypted: boolean;
  isPendingRoom: boolean;
  tangentSpaceId: string | null;
  roomPinned: boolean;
  onBack: () => void;
  onEditTopic: () => void;
  onSearch: () => void;
  onTogglePin: () => void;
  onCreateTopic: () => void;
  onViewPins: () => void;
  onOpenMenu: () => void;
}

function RoomHeader({
  roomName,
  roomDescription,
  roomIcon,
  roomSubtitle,
  typingIndicator,
  isEncrypted,
  isPendingRoom,
  tangentSpaceId,
  roomPinned,
  onBack,
  onEditTopic,
  onSearch,
  onTogglePin,
  onCreateTopic,
  onViewPins,
  onOpenMenu,
}: RoomHeaderProps) {
  return (
    <IonHeader className="ion-no-border">
      <IonToolbar className="app-toolbar">
        <IonButtons slot="start">
          <IonButton fill="clear" onClick={onBack}>
            <IonIcon slot="icon-only" icon={arrowBack} />
          </IonButton>
        </IonButtons>
        <div className="flex items-center gap-3 px-2">
          <AppAvatar
            name={roomName}
            icon={roomIcon}
            className="h-10 w-10"
            textClassName="text-sm"
          />
          {isPendingRoom ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-text">{roomName}</div>
              <div className="truncate text-xs text-text-muted">
                {typingIndicator ?? roomDescription ?? roomSubtitle}
                {isEncrypted ? ' • encrypted' : ''}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={onEditTopic}
              aria-label="Edit topic details"
            >
              <div className="truncate text-[15px] font-semibold text-text">{roomName}</div>
              <div className="truncate text-xs text-text-muted">
                {typingIndicator ?? roomDescription ?? roomSubtitle}
                {isEncrypted ? ' • encrypted' : ''}
              </div>
            </button>
          )}
        </div>
        <IonButtons slot="end">
          <IonButton fill="clear" color="medium" onClick={onSearch} aria-label="Search conversations">
            <IonIcon slot="icon-only" icon={searchOutline} />
          </IonButton>
          {!isPendingRoom ? (
            <IonButton
              fill="clear"
              color={roomPinned ? 'primary' : 'medium'}
              onClick={onTogglePin}
              aria-label={roomPinned ? 'Unpin topic' : 'Pin topic'}
            >
              <IonIcon slot="icon-only" icon={roomPinned ? star : starOutline} />
            </IonButton>
          ) : null}
          {tangentSpaceId && !isPendingRoom ? (
            <IonButton fill="clear" color="primary" onClick={onCreateTopic} aria-label="Create topic">
              <IonIcon slot="icon-only" icon={gitBranchOutline} />
            </IonButton>
          ) : null}
          {!isPendingRoom ? (
            <IonButton fill="clear" color="medium" onClick={onViewPins} aria-label="View pinned messages">
              <IonIcon slot="icon-only" icon={pin} />
            </IonButton>
          ) : null}
          <IonButton fill="clear" color="medium" onClick={onOpenMenu} disabled={isPendingRoom}>
            <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
}

export default RoomHeader;
