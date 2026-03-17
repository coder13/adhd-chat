import type { Meta, StoryObj } from '@storybook/react-vite';
import MessageActionMenu from './MessageActionMenu';
import {
  cloneStoryMessage,
  sampleIncomingTextMessage,
  sampleOwnTextMessage,
} from './chatTimelineStoryData';

const meta = {
  title: 'Chat/MessageActionMenu',
  component: MessageActionMenu,
  args: {
    message: cloneStoryMessage(sampleOwnTextMessage),
    position: { x: 120, y: 120 },
    canEdit: true,
    isPinned: false,
  },
  argTypes: {
    message: {
      control: false,
    },
    onClose: {
      action: 'close',
    },
    onReply: {
      action: 'reply',
    },
    onEdit: {
      action: 'edit',
    },
    onDelete: {
      action: 'delete',
    },
    onPin: {
      action: 'pin',
    },
    onReact: {
      action: 'react',
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-screen bg-[var(--app-chat-background)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageActionMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OwnMessage: Story = {};

export const OtherMessage: Story = {
  args: {
    message: cloneStoryMessage(sampleIncomingTextMessage),
    canEdit: false,
    onEdit: undefined,
    onDelete: undefined,
  },
};

export const Pinned: Story = {
  args: {
    isPinned: true,
  },
};
