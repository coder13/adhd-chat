import type { Meta, StoryObj } from '@storybook/react-vite';
import Avatar from './Avatar';

const meta = {
  title: 'Chat/Avatar',
  component: Avatar,
  args: {
    name: 'Alex',
    size: 'md',
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
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const Medium: Story = {};

export const Large: Story = {
  args: {
    size: 'lg',
    name: 'Weekend Check-in',
  },
};
