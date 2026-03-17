import { IonIcon } from '@ionic/react';
import {
  arrowBack,
  chatbubbleOutline,
  chevronForwardOutline,
  menuOutline,
  peopleOutline,
  searchOutline,
  settingsOutline,
} from 'ionicons/icons';
import { useEffect, useRef } from 'react';
import { AppAvatar } from '../../components';
import type { DesktopSettingsSection } from './DesktopSettingsPanel';
import type { DesktopDirectoryView } from './DesktopDirectoryPanel';

interface DesktopRailHeaderProps {
  view: 'topics' | 'settings' | DesktopDirectoryView;
  settingsSection: DesktopSettingsSection;
  searchQuery: string;
  showMenu: boolean;
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  currentUserId: string | null;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onSearchQueryChange: (value: string) => void;
  onOpenContacts: () => void;
  onOpenOtherRooms: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}

function MenuAction({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-elevated/70"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-text-muted">
        <IonIcon icon={icon} className="text-[18px]" />
      </div>
      <div className="min-w-0 flex-1 text-[15px] font-medium text-text">{label}</div>
      <IonIcon icon={chevronForwardOutline} className="text-lg text-text-subtle" />
    </button>
  );
}

function getSettingsTitle(section: DesktopSettingsSection) {
  switch (section) {
    case 'notifications':
      return 'Notifications';
    case 'encryption':
      return 'Encryption';
    case 'account':
      return 'Manage account';
    case 'devices':
      return 'Manage devices';
    case 'chat-appearance':
      return 'Chat appearance';
    default:
      return 'Settings';
  }
}

function getTitle(
  view: 'topics' | 'settings' | DesktopDirectoryView,
  settingsSection: DesktopSettingsSection
) {
  if (view === 'contacts') {
    return 'Contacts';
  }

  if (view === 'other') {
    return 'Other rooms';
  }

  return getSettingsTitle(settingsSection);
}

export default function DesktopRailHeader({
  view,
  settingsSection,
  searchQuery,
  showMenu,
  currentUserName,
  currentUserAvatarUrl,
  currentUserId,
  onToggleMenu,
  onCloseMenu,
  onSearchQueryChange,
  onOpenContacts,
  onOpenOtherRooms,
  onOpenSettings,
  onBack,
}: DesktopRailHeaderProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onCloseMenu();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [onCloseMenu, showMenu]);

  return (
    <div
      className="relative z-40 flex min-w-0 flex-1 items-center gap-2 overflow-visible px-3 py-3"
      ref={menuRef}
    >
      {view === 'topics' ? (
        <>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel text-text transition-colors hover:bg-elevated"
            onClick={onToggleMenu}
            aria-label="Open app menu"
          >
            <IonIcon icon={menuOutline} className="text-xl" />
          </button>
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-panel px-4 py-3 text-text-muted transition-colors focus-within:ring-2 focus-within:ring-accent/30">
            <IonIcon icon={searchOutline} className="text-lg shrink-0" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search rooms"
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
              aria-label="Search visible rooms"
            />
          </label>
        </>
      ) : (
        <>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel text-text transition-colors hover:bg-elevated"
            onClick={onBack}
            aria-label={settingsSection === 'menu' ? 'Back to topics' : 'Back to settings'}
          >
            <IonIcon icon={arrowBack} className="text-xl" />
          </button>
          <div className="min-w-0 flex-1 px-2">
              <div className="truncate text-lg font-semibold text-text">
              {getTitle(view, settingsSection)}
              </div>
            </div>
          </>
      )}

      {showMenu ? (
        <div className="absolute left-3 top-[calc(100%-2px)] z-50 w-[288px] rounded-[28px] border border-line/80 bg-white/95 p-3 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-3 rounded-[22px] px-2 py-2">
            <AppAvatar
              name={currentUserName}
              avatarUrl={currentUserAvatarUrl}
              className="h-11 w-11"
              textClassName="text-sm"
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-text">
                {currentUserName}
              </div>
              {currentUserId ? (
                <div className="truncate text-xs text-text-muted">{currentUserId}</div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <MenuAction
              icon={peopleOutline}
              label="Contacts"
              onClick={onOpenContacts}
            />
            <MenuAction
              icon={chatbubbleOutline}
              label="Other rooms"
              onClick={onOpenOtherRooms}
            />
            <MenuAction
              icon={settingsOutline}
              label="Settings"
              onClick={onOpenSettings}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
