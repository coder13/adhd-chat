import type { Meta, StoryObj } from '@storybook/react-vite';
import ChatTimelineStory from './ChatTimelineStory';
import {
  chatTimelineStoryMessages,
  storyMentionTargets,
} from './chatTimelineStoryData';

const meta = {
  title: 'Chat/Timeline',
  component: ChatTimelineStory,
  args: {
    messages: chatTimelineStoryMessages,
    mentionTargets: storyMentionTargets,
    viewMode: 'timeline',
  },
  argTypes: {
    messages: {
      control: false,
    },
    mentionTargets: {
      control: false,
    },
    viewMode: {
      control: 'inline-radio',
      options: ['timeline', 'bubbles'],
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChatTimelineStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Timeline: Story = {};

export const BubbleView: Story = {
  args: {
    viewMode: 'bubbles',
  },
};

export const EmptyRoom: Story = {
  args: {
    messages: [],
    initialComposerMode: null,
  },
};

export const LoadingRoom: Story = {
  args: {
    screenState: 'loading',
    initialComposerMode: null,
  },
};

export const ReadOnlyRoom: Story = {
  args: {
    canInteractWithTimeline: false,
    initialComposerMode: null,
    subtitle: 'Join this topic to send messages',
  },
};

export const SyncError: Story = {
  args: {
    screenState: 'error',
    errorMessage: 'Timeline sync paused. Showing the latest cached messages.',
  },
};
