import type { Meta, StoryObj } from '@storybook/react-vite';
import ComposerContextBar from './ComposerContextBar';
import {
  cloneStoryMessage,
  sampleFailedMessage,
  sampleReplyMessage,
} from './chatTimelineStoryData';

const meta = {
  title: 'Chat/ComposerContextBar',
  component: ComposerContextBar,
  args: {
    mode: 'reply',
    message: cloneStoryMessage(sampleReplyMessage),
  },
  argTypes: {
    message: {
      control: false,
    },
    onCancel: {
      action: 'cancel',
    },
  },
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="min-w-[360px] max-w-[720px] bg-[var(--app-chat-background)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposerContextBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reply: Story = {};

export const EditDeleted: Story = {
  args: {
    mode: 'edit',
    message: {
      ...cloneStoryMessage(sampleFailedMessage),
      isDeleted: true,
      body: 'Original message deleted',
    },
  },
};
