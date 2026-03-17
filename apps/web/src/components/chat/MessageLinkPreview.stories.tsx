import type { Meta, StoryObj } from '@storybook/react-vite';
import MessageLinkPreview from './MessageLinkPreview';

const meta = {
  title: 'Chat/MessageLinkPreview',
  component: MessageLinkPreview,
  args: {
    messageId: 'storybook-link-preview',
    messageBody: 'Perfect. I dropped the park photos here too: https://example.com/check-in',
    isOwn: true,
    compact: false,
  },
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => {
      window.localStorage.removeItem('tandem.dismissed-link-previews');

      return (
        <div className="min-w-[320px] max-w-[720px] bg-[var(--app-chat-background)] p-6">
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof MessageLinkPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    compact: true,
  },
};

export const Incoming: Story = {
  args: {
    isOwn: false,
    messageId: 'storybook-link-preview-incoming',
  },
};
