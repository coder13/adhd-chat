import type { Meta, StoryObj } from '@storybook/react-vite';
import ReactionPicker from './ReactionPicker';

const meta = {
  title: 'Chat/ReactionPicker',
  component: ReactionPicker,
  args: {
    inline: true,
    theme: 'light',
    align: 'right',
  },
  argTypes: {
    onSelect: {
      action: 'select',
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
} satisfies Meta<typeof ReactionPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InlineLight: Story = {};

export const InlineDark: Story = {
  args: {
    theme: 'dark',
  },
};

export const FloatingLeft: Story = {
  args: {
    inline: false,
    align: 'left',
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[36rem] bg-[var(--app-chat-background)] p-6">
        <Story />
      </div>
    ),
  ],
};
