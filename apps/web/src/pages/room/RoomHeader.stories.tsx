import type { Meta, StoryObj } from '@storybook/react-vite';
import RoomHeader from './RoomHeader';

const meta = {
  title: 'Chat/RoomHeader',
  component: RoomHeader,
  args: {
    roomName: 'Weekend Check-in',
    roomDescription: 'Quick updates, photos, and plans',
    roomIcon: '💬',
    roomSubtitle: 'Bubble view',
    typingIndicator: null,
    isEncrypted: false,
    isPendingRoom: false,
    tangentSpaceId: 'storybook-space',
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

export const Default: Story = {};

export const Typing: Story = {
  args: {
    typingIndicator: 'Alex is typing…',
    isEncrypted: true,
  },
};

export const PendingRoom: Story = {
  args: {
    isPendingRoom: true,
    tangentSpaceId: null,
    roomSubtitle: 'Setting up topic',
  },
};
