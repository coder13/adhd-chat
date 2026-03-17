import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import DesktopTopicSidebar from './DesktopTopicSidebar';

const meta = {
  title: 'Chat/DesktopTopicSidebar',
  component: DesktopTopicSidebar,
  args: {
    width: 320,
    view: 'topics',
    settingsSection: 'menu',
    currentUserName: 'Cailyn',
    currentUserAvatarUrl: null,
    currentUserId: '@cailyn:matrix.org',
    currentRoomId: '!room-2:adhd.chat',
    topics: [
      {
        id: '!room-1:adhd.chat',
        name: 'Morning Planning',
        icon: '☀️',
        description: 'Priorities before noon',
        preview: 'Three anchors for today',
        timestamp: Date.UTC(2026, 2, 16, 8, 15),
        unreadCount: 0,
        memberCount: 2,
        membership: 'join',
        isPinned: true,
        isArchived: false,
      },
      {
        id: '!room-2:adhd.chat',
        name: 'Errands',
        icon: '🛒',
        description: 'Things to pick up on the way home',
        preview: 'Need toothpaste and dish soap',
        timestamp: Date.UTC(2026, 2, 16, 11, 45),
        unreadCount: 3,
        memberCount: 2,
        membership: 'join',
        isPinned: false,
        isArchived: false,
      },
      {
        id: '!room-3:adhd.chat',
        name: 'Brain Dump',
        icon: '🧠',
        description: null,
        preview: 'Parking lot for random ideas',
        timestamp: Date.UTC(2026, 2, 15, 19, 10),
        unreadCount: 0,
        memberCount: 2,
        membership: 'invite',
        isPinned: false,
        isArchived: false,
      },
    ],
  },
  argTypes: {
    onSelectTopic: {
      action: 'selectTopic',
    },
    onSelectSettingsSection: {
      action: 'selectSettingsSection',
    },
    onOpenRoute: {
      action: 'openRoute',
    },
  },
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'desktop',
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="min-h-screen bg-[var(--app-chat-background)] p-6">
          <div className="mx-auto flex min-h-[780px] max-w-7xl overflow-hidden rounded-[32px] border border-line/80 bg-[var(--app-shell-background)] shadow-[0_28px_90px_-48px_rgba(15,23,42,0.34)]">
            <Story />
            <div className="hidden min-w-0 flex-1 xl:flex xl:flex-col">
              <div className="border-b border-line/80 px-8 py-6">
                <div className="text-sm font-medium uppercase tracking-[0.14em] text-text-subtle">
                  Topic preview
                </div>
                <div className="mt-2 text-2xl font-semibold text-text">Errands</div>
                <div className="mt-2 text-sm text-text-muted">
                  Desktop layout keeps the topic rail visible while the conversation stays open.
                </div>
              </div>
              <div className="flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,252,0.95))]" />
            </div>
          </div>
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof DesktopTopicSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DenseUnreadState: Story = {
  args: {
    currentRoomId: '!room-1:adhd.chat',
    topics: [
      {
        id: '!room-1:adhd.chat',
        name: 'Morning Planning',
        icon: '☀️',
        description: 'Priorities before noon',
        preview: 'Three anchors for today',
        timestamp: Date.UTC(2026, 2, 16, 8, 15),
        unreadCount: 7,
        memberCount: 2,
        membership: 'join',
        isPinned: true,
        isArchived: false,
      },
      {
        id: '!room-2:adhd.chat',
        name: 'Errands',
        icon: '🛒',
        description: 'Things to pick up on the way home',
        preview: 'Need toothpaste and dish soap',
        timestamp: Date.UTC(2026, 2, 16, 11, 45),
        unreadCount: 1,
        memberCount: 2,
        membership: 'join',
        isPinned: false,
        isArchived: false,
      },
      {
        id: '!room-3:adhd.chat',
        name: 'Dinner ideas',
        icon: '🍲',
        description: null,
        preview: 'Pasta or tacos?',
        timestamp: Date.UTC(2026, 2, 16, 16, 5),
        unreadCount: 5,
        memberCount: 2,
        membership: 'join',
        isPinned: false,
        isArchived: false,
      },
    ],
  },
};
