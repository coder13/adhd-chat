import { IonIcon } from '@ionic/react';
import {
  arrowBack,
  chatbubbleOutline,
  chevronForwardOutline,
  gridOutline,
  menuOutline,
  peopleOutline,
  searchOutline,
  settingsOutline,
} from 'ionicons/icons';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { AppAvatar } from '../../components';
import type { DesktopSettingsSection } from './DesktopSettingsPanel';
import type { DesktopDirectoryView } from './DesktopDirectoryPanel';

interface DesktopRailHeaderProps {
  view: 'topics' | 'settings' | DesktopDirectoryView;
  settingsSection: DesktopSettingsSection;
  searchQuery: string;
  showMenu: boolean;
  showSearch?: boolean;
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  currentUserId: string | null;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onSearchQueryChange: (value: string) => void;
  onOpenHubs: () => void;
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
      className="app-interactive-list-item flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
    >
      <div className="app-icon-button flex h-9 w-9 items-center justify-center rounded-full text-primary-strong">
        <IonIcon icon={icon} className="text-[18px]" />
      </div>
      <div className="min-w-0 flex-1 text-[15px] font-medium text-text">{label}</div>
      <IonIcon icon={chevronForwardOutline} className="text-lg text-text-subtle" />
    </button>
  );
}

function getSettingsTitle(section: DesktopSettingsSection) {
  switch (section) {
    case 'profile':
      return 'Profile';
    case 'notifications':
      return 'Notifications';
    case 'encryption':
      return 'Encryption';
    case 'account':
      return 'Manage account';
    case 'devices':
      return 'Sessions';
    case 'unverified-devices':
      return 'Unverified devices';
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
  if (view === 'hubs') {
    return 'Select hub';
  }

  if (view === 'contacts') {
    return 'Contacts';
  }

  if (view === 'add-contact') {
    return 'Add contact';
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
  showSearch = true,
  currentUserName,
  currentUserAvatarUrl,
  currentUserId,
  onToggleMenu,
  onCloseMenu,
  onSearchQueryChange,
  onOpenHubs,
  onOpenContacts,
  onOpenOtherRooms,
  onOpenSettings,
  onBack,
}: DesktopRailHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const isMenuDrivenView = view === 'topics' || view === 'other';

  useEffect(() => {
    if (!showMenu || !triggerRef.current || typeof window === 'undefined') {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setMenuPosition({
        left: rect.left,
        top: rect.bottom - 2,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) {
      setMenuPosition(null);
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }

      onCloseMenu();
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [onCloseMenu, showMenu]);

  return (
    <div
      className="relative z-40 flex min-w-0 flex-1 items-center gap-2 overflow-visible px-3 py-3"
      ref={containerRef}
    >
      {isMenuDrivenView ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="app-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            onClick={onToggleMenu}
            aria-label="Open app menu"
          >
            <IonIcon icon={menuOutline} className="text-xl" />
          </button>
          {view === 'topics' && showSearch ? (
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
          ) : (
            <div className="min-w-0 flex-1 px-2">
              <div className="truncate text-lg font-semibold text-text">
                {getTitle(view, settingsSection)}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="app-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
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

      {showMenu && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className="app-menu-surface fixed z-[120] w-[288px] rounded-[28px] p-3"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
              }}
            >
              <div className="mb-2 flex items-center gap-3 rounded-[22px] px-2 py-2">
                <button
                  type="button"
                  className="app-interactive-list-item flex min-w-0 flex-1 items-center gap-3 rounded-[22px] px-2 py-2 text-left"
                  onClick={onOpenSettings}
                >
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
                </button>
              </div>

              <div className="space-y-1">
                <MenuAction
                  icon={gridOutline}
                  label="Select hub"
                  onClick={onOpenHubs}
                />
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
