import type { Meta, StoryObj } from '@storybook/react-vite';
import RoomHeader from './RoomHeader';

const meta = {
  title: 'Chat/RoomHeader',
  component: RoomHeader,
  args: {
    roomName: 'Weekend Check-in',
    roomDescription: 'Quick updates, photos, and plans',
    roomIcon: '💬',
    roomAvatarUrl: null,
    roomSubtitle: 'Bubble view',
    typingIndicator: null,
    isEncrypted: false,
    isPendingRoom: false,
    tangentSpaceId: 'storybook-space',
    onBack: () => undefined,
    onEditTopic: () => undefined,
    onOpenPinnedMessages: () => undefined,
    onSearch: () => undefined,
    onCreateTopic: () => undefined,
    onOpenMenu: () => undefined,
  },
  argTypes: {
    onBack: {
      action: 'back',
    },
    onEditTopic: {
      action: 'editTopic',
    },
    onSearch: {
      action: 'search',
    },
    onCreateTopic: {
      action: 'createTopic',
    },
    onOpenMenu: {
      action: 'openMenu',
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl bg-[var(--app-shell-background)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Typing: Story = {
  args: {
    typingIndicator: 'Alex is typing…',
    isEncrypted: true,
    roomAvatarUrl: null,
    onBack: () => undefined,
    onEditTopic: () => undefined,
    onOpenPinnedMessages: () => undefined,
    onSearch: () => undefined,
    onCreateTopic: () => undefined,
    onOpenMenu: () => undefined,
  },
};

export const PendingRoom: Story = {
  args: {
    isPendingRoom: true,
    tangentSpaceId: null,
    roomSubtitle: 'Setting up topic',
    roomAvatarUrl: null,
    onBack: () => undefined,
    onEditTopic: () => undefined,
    onOpenPinnedMessages: () => undefined,
    onSearch: () => undefined,
    onCreateTopic: () => undefined,
    onOpenMenu: () => undefined,
  },
};
