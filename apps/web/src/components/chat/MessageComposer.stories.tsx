import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import MessageComposer from './MessageComposer';

interface MessageComposerStoryHarnessProps {
  disabled?: boolean;
  initialText?: string;
}

function MessageComposerStoryHarness({
  disabled = false,
  initialText = '',
}: MessageComposerStoryHarnessProps) {
  const [messages, setMessages] = useState<string[]>([]);

  return (
    <div className="min-w-[360px] max-w-[760px] bg-[var(--app-chat-background)] p-6">
      <div className="mb-4 space-y-2">
        {messages.length > 0 ? (
          messages.map((message, index) => (
            <div
              key={`${message}-${index}`}
              className="rounded-2xl bg-panel px-3 py-2 text-sm text-text"
            >
              {message}
            </div>
          ))
        ) : (
          <div className="text-sm text-text-muted">Sent messages will appear here.</div>
        )}
      </div>
      <MessageComposer
        key={`${disabled}:${initialText}`}
        disabled={disabled}
        onSend={async (message) => {
          setMessages((current) => [...current, message]);
        }}
      />
      {initialText ? (
        <p className="mt-3 text-xs text-text-subtle">
          Type this to test quickly: <code>{initialText}</code>
        </p>
      ) : null}
    </div>
  );
}

const meta = {
  title: 'Chat/MessageComposer',
  component: MessageComposerStoryHarness,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof MessageComposerStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PrefillHint: Story = {
  args: {
    initialText: 'Hello from Storybook',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
