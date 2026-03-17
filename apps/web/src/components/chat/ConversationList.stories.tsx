import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import type { ChatSummary } from '../../lib/matrix/chatCatalog';
import ConversationList from './ConversationList';

const conversationListStories: ChatSummary[] = [
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

const meta = {
  title: 'Chat/ConversationList',
  component: ConversationList,
  args: {
    chats: conversationListStories,
    activeRoomId: '!weekend:matrix.org',
    emptyTitle: 'No chats yet',
    emptyBody: 'Start a conversation to see it here.',
  },
  argTypes: {
    chats: {
      control: false,
    },
  },
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="min-w-[360px] max-w-[520px] rounded-[28px] bg-[var(--app-shell-background)] p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof ConversationList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithChats: Story = {};

export const Empty: Story = {
  args: {
    chats: [],
    activeRoomId: null,
  },
};
