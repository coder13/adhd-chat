import type { Meta, StoryObj } from '@storybook/react-vite';
import MessageBubble from './MessageBubble';
import {
  cloneStoryMessage,
  sampleFailedMessage,
  sampleImageMessage,
  sampleIncomingTextMessage,
  sampleReplyMessage,
  storyMentionTargets,
} from './chatTimelineStoryData';

const meta = {
  title: 'Chat/MessageBubble',
  component: MessageBubble,
  args: {
    message: cloneStoryMessage(sampleIncomingTextMessage),
    mentionTargets: storyMentionTargets,
    viewMode: 'timeline',
  },
  argTypes: {
    message: {
      control: false,
    },
    mentionTargets: {
      control: false,
    },
    onRetry: {
      action: 'retry',
    },
    onToggleReaction: {
      action: 'toggleReaction',
    },
    onRequestActions: {
      action: 'requestActions',
    },
  },
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="min-w-[360px] max-w-[720px] rounded-[28px] bg-[var(--app-chat-background)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageBubble>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TimelineText: Story = {};

export const BubbleReply: Story = {
  args: {
    message: cloneStoryMessage(sampleReplyMessage),
    viewMode: 'bubbles',
  },
};

export const ImageMessage: Story = {
  args: {
    message: cloneStoryMessage(sampleImageMessage),
  },
};

export const FailedMessage: Story = {
  args: {
    message: cloneStoryMessage(sampleFailedMessage),
  },
};
