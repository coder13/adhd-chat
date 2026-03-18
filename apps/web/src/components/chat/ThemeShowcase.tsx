import { IonIcon } from '@ionic/react';
import {
  addOutline,
  moonOutline,
  notificationsOutline,
  searchOutline,
} from 'ionicons/icons';
import type { CSSProperties } from 'react';
import { Button, OverflowMenu } from '..';
import { cn } from '../../lib/cn';
import type { ChatSummary } from '../../lib/matrix/chatCatalog';
import type { StorybookThemePreset, ThemeMode } from '../../theme/storybookThemePresets';
import ConversationList from './ConversationList';
import MessageBubble from './MessageBubble';
import {
  cloneStoryMessage,
  sampleFailedMessage,
  sampleFileMessage,
  sampleIncomingTextMessage,
  sampleReplyMessage,
  storyMentionTargets,
} from './chatTimelineStoryData';

const showcaseChats: ChatSummary[] = [
  {
    id: '!weekend:matrix.org',
    name: 'Weekend Check-in',
    icon: null,
    preview: 'Perfect. I dropped the park photos here too.',
    timestamp: Date.UTC(2026, 2, 16, 18, 6),
    unreadCount: 2,
    isDirect: true,
    isEncrypted: true,
    memberCount: 2,
    nativeSpaceName: null,
    source: 'primary',
    isTandemMain: true,
    isPinned: true,
    isArchived: false,
  },
  {
    id: '!groceries:matrix.org',
    name: 'Groceries',
    icon: null,
    preview: 'Need anything else for tonight?',
    timestamp: Date.UTC(2026, 2, 16, 16, 42),
    unreadCount: 0,
    isDirect: false,
    isEncrypted: false,
    memberCount: 2,
    nativeSpaceName: 'Shared Hub',
    source: 'primary',
    isTandemMain: false,
    isPinned: false,
    isArchived: false,
  },
  {
    id: '!travel:matrix.org',
    name: 'Trip Ideas',
    icon: null,
    preview: 'Saved three cabins and one coastal spot.',
    timestamp: Date.UTC(2026, 2, 14, 20, 14),
    unreadCount: 0,
    isDirect: false,
    isEncrypted: true,
    memberCount: 2,
    nativeSpaceName: 'Dreaming',
    source: 'other',
    isTandemMain: false,
    isPinned: false,
    isArchived: false,
  },
];

const overflowItems = [
  {
    label: 'Open topic tools',
    onSelect: () => undefined,
  },
  {
    label: 'Mute for tonight',
    onSelect: () => undefined,
  },
  {
    label: 'Delete topic',
    onSelect: () => undefined,
    tone: 'danger' as const,
  },
];

function PaletteSwatch({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl px-3 py-3 text-sm shadow-[0_14px_28px_-24px_rgba(var(--app-shadow-color-rgb),0.34)]',
        className
      )}
    >
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-xs opacity-80">{value.toUpperCase()}</p>
    </div>
  );
}

function SurfaceSample({
  label,
  style,
}: {
  label: string;
  style: CSSProperties;
}) {
  return (
    <div
      className="rounded-2xl border border-line/60 px-3 py-3 text-sm text-text"
      style={style}
    >
      {label}
    </div>
  );
}

function MenuPreview() {
  return (
    <div className="app-menu-surface w-full rounded-[28px] p-2">
      <button
        type="button"
        className="app-interactive-menu-item flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium text-text"
      >
        <span>Open topic tools</span>
        <span className="text-text-subtle">⌘K</span>
      </button>
      <button
        type="button"
        className="app-interactive-menu-item is-active mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium text-text"
      >
        <span>Mute for tonight</span>
        <span className="text-primary/80">Until 7 AM</span>
      </button>
      <button
        type="button"
        className="app-interactive-menu-item mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium text-danger-strong"
      >
        <span>Delete topic</span>
        <span className="text-danger/80">Permanent</span>
      </button>
    </div>
  );
}

interface ThemeShowcaseProps {
  preset: StorybookThemePreset;
  activeRoomId: string | null;
}

export default function ThemeShowcase({
  preset,
  activeRoomId,
}: ThemeShowcaseProps) {
  const isDark = preset.mode === 'dark';

  return (
    <section className={cn(isDark ? 'dark' : '', 'min-w-0')} style={preset.style}>
      <div
        className="rounded-[34px] p-4 shadow-[0_26px_80px_-42px_rgba(var(--app-shadow-color-rgb),0.38)]"
        style={{
          backgroundColor: 'var(--ion-background-color)',
          color: 'var(--ion-text-color)',
        }}
      >
        <div
          className="rounded-[30px] p-5 sm:p-6"
          style={{ backgroundColor: 'var(--app-shell-background)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-subtle">
                {preset.mode === 'dark' ? 'Dark Candidate' : 'Light Candidate'}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-text">{preset.name}</h2>
            </div>
            <OverflowMenu items={overflowItems} buttonLabel="Open theme menu" />
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-text">Palette</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <PaletteSwatch
                  label="Primary"
                  value={preset.palette.primary}
                  className="bg-primary text-primary-contrast"
                />
                <PaletteSwatch
                  label="Secondary"
                  value={preset.palette.secondary}
                  className="bg-secondary text-secondary-contrast"
                />
                <PaletteSwatch
                  label="Tertiary / Accent"
                  value={preset.palette.tertiary}
                  className="bg-tertiary text-tertiary-contrast"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text">Surface Stack</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SurfaceSample
                  label="Canvas"
                  style={{ backgroundColor: 'var(--ion-background-color)' }}
                />
                <SurfaceSample
                  label="Shell"
                  style={{ backgroundColor: 'var(--app-shell-background)' }}
                />
                <SurfaceSample
                  label="Panel"
                  style={{ backgroundColor: 'rgb(var(--app-surface-panel-rgb))' }}
                />
                <SurfaceSample
                  label="Chat Background"
                  style={{ backgroundColor: 'var(--app-chat-background)' }}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text">Buttons</h3>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="tertiary">Tertiary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger">Danger</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="app-icon-button flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Search"
                >
                  <IonIcon icon={searchOutline} className="text-lg" />
                </button>
                <button
                  type="button"
                  className="app-icon-button is-active flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Notifications"
                >
                  <IonIcon icon={notificationsOutline} className="text-lg" />
                </button>
                <button
                  type="button"
                  className="app-icon-button flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Add"
                >
                  <IonIcon icon={addOutline} className="text-lg" />
                </button>
                <button
                  type="button"
                  className="app-icon-button flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Toggle theme"
                >
                  <IonIcon icon={moonOutline} className="text-lg" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text">Menu Items</h3>
              <div className="mt-3">
                <MenuPreview />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text">
                Interactive List Items
              </h3>
              <div className="mt-3 rounded-[28px] bg-panel/70 p-3">
                <ConversationList
                  chats={showcaseChats}
                  activeRoomId={activeRoomId}
                  emptyTitle="No chats yet"
                  emptyBody="Start a conversation to see it here."
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text">Bubble Contrast</h3>
              <div
                className="mt-3 rounded-[30px] p-4 sm:p-5"
                style={{ backgroundColor: 'var(--app-chat-background)' }}
              >
                <div className="space-y-3">
                  <MessageBubble
                    message={cloneStoryMessage(sampleIncomingTextMessage)}
                    mentionTargets={storyMentionTargets}
                    viewMode="bubbles"
                  />
                  <MessageBubble
                    message={cloneStoryMessage(sampleFileMessage)}
                    mentionTargets={storyMentionTargets}
                    viewMode="bubbles"
                  />
                  <MessageBubble
                    message={cloneStoryMessage(sampleReplyMessage)}
                    mentionTargets={storyMentionTargets}
                    viewMode="bubbles"
                    receiptNames={sampleReplyMessage.readByNames ?? null}
                  />
                  <MessageBubble
                    message={cloneStoryMessage(sampleFailedMessage)}
                    mentionTargets={storyMentionTargets}
                    viewMode="bubbles"
                    onRetry={() => undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export type { ThemeMode };
