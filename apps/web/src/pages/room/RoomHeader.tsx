import { IonButton, IonButtons, IonHeader, IonIcon, IonToolbar } from '@ionic/react';
import {
  arrowBack,
  ellipsisHorizontal,
  gitBranchOutline,
  pinOutline,
  searchOutline,
} from 'ionicons/icons';
import { AppAvatar } from '../../components';
import type { ReactNode } from 'react';

interface RoomHeaderProps {
  roomName: string;
  roomDescription: string | null;
  roomIcon: string | null;
  roomSubtitle: string | null;
  typingIndicator: string | null;
  isEncrypted: boolean;
  isPendingRoom: boolean;
  tangentSpaceId: string | null;
  desktopRailHeader?: ReactNode;
  desktopRailWidth?: number;
  onBack: () => void;
  onEditTopic: () => void;
  onOpenPinnedMessages: () => void;
  onSearch: () => void;
  onCreateTopic: () => void;
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
  desktopRailHeader = null,
  desktopRailWidth = 0,
  onBack,
  onEditTopic,
  onOpenPinnedMessages,
  onSearch,
  onCreateTopic,
  onOpenMenu,
}: RoomHeaderProps) {
  return (
    <IonHeader className="ion-no-border relative z-30">
      <IonToolbar className="app-toolbar overflow-visible">
        <div className="flex min-w-0 items-center">
          {desktopRailHeader ? (
            <>
              <div
                className="hidden xl:flex xl:shrink-0 xl:border-r xl:border-line/80 xl:overflow-visible"
                style={{ width: desktopRailWidth }}
              >
                {desktopRailHeader}
              </div>
              <div className="hidden xl:block xl:w-3 xl:shrink-0" />
            </>
          ) : null}

          <div className="flex min-w-0 flex-1 items-center">
            <IonButtons slot="start" className="xl:hidden">
              <IonButton fill="clear" onClick={onBack}>
                <IonIcon slot="icon-only" icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
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
                  color="medium"
                  className="hidden xl:inline-flex"
                  onClick={onOpenPinnedMessages}
                  aria-label="Open pinned messages"
                >
                  <IonIcon slot="icon-only" icon={pinOutline} />
                </IonButton>
              ) : null}
              {tangentSpaceId && !isPendingRoom ? (
                <IonButton fill="clear" color="primary" onClick={onCreateTopic} aria-label="Create topic">
                  <IonIcon slot="icon-only" icon={gitBranchOutline} />
                </IonButton>
              ) : null}
              <IonButton fill="clear" color="medium" onClick={onOpenMenu} disabled={isPendingRoom}>
                <IonIcon slot="icon-only" icon={ellipsisHorizontal} />
              </IonButton>
            </IonButtons>
          </div>
        </div>
      </IonToolbar>
    </IonHeader>
  );
}

export default RoomHeader;
