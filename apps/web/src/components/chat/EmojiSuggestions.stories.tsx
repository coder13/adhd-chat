import type { Meta, StoryObj } from '@storybook/react-vite';
import EmojiSuggestions from './EmojiSuggestions';
import { storyEmojiSuggestions } from './chatTimelineStoryData';

const meta = {
  title: 'Chat/EmojiSuggestions',
  component: EmojiSuggestions,
  args: {
    suggestions: storyEmojiSuggestions,
    selectedIndex: 0,
  },
  argTypes: {
    suggestions: {
      control: false,
    },
    onSelect: {
      action: 'select',
    },
    onHighlight: {
      action: 'highlight',
    },
  },
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="bg-[var(--app-chat-background)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmojiSuggestions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstSelected: Story = {};

export const ThirdSelected: Story = {
  args: {
    selectedIndex: 2,
  },
};
