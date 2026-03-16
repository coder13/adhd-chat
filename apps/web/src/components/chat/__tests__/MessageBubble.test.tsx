/// <reference types="jest" />

import '@testing-library/jest-dom';
import type { ReactNode } from 'react';

jest.mock('../..', () => ({
  AppAvatar: ({ name }: { name: string }) => <div>{name}</div>,
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

import { render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';

describe('MessageBubble', () => {
  it('renders emoji-only text messages in the default timeline view', () => {
    render(
      <MessageBubble
        message={{
          id: 'emoji',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: '😀🎉🫶',
          timestamp: Date.UTC(2026, 2, 15, 10, 30),
          isOwn: false,
          msgtype: 'm.text',
        }}
      />
    );

    expect(screen.getAllByText('Alex')).toHaveLength(2);
    expect(screen.getByText('😀🎉🫶')).toBeInTheDocument();
  });

  it('shows unsupported formatting markup as literal text instead of HTML', () => {
    const { container } = render(
      <MessageBubble
        message={{
          id: 'literal-markup',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: '<strong>hello</strong> 😀',
          timestamp: Date.UTC(2026, 2, 15, 10, 31),
          isOwn: false,
          msgtype: 'm.text',
        }}
      />
    );

    expect(screen.getByText('<strong>hello</strong> 😀')).toBeInTheDocument();
    expect(container.querySelector('strong')).not.toBeInTheDocument();
  });

  it('renders recognizable urls as safe links without splitting surrounding text', () => {
    render(
      <MessageBubble
        message={{
          id: 'link-message',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'See https://example.com/test?x=1 and also www.openai.com today',
          timestamp: Date.UTC(2026, 2, 15, 10, 32),
          isOwn: false,
          msgtype: 'm.text',
        }}
      />
    );

    expect(screen.getByText('See', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'https://example.com/test?x=1' })
    ).toHaveAttribute('href', 'https://example.com/test?x=1');
    expect(screen.getByRole('link', { name: 'www.openai.com' })).toHaveAttribute(
      'href',
      'https://www.openai.com'
    );
  });

  it('shows failed optimistic messages with a retry action', () => {
    const onRetry = jest.fn();

    render(
      <MessageBubble
        message={{
          id: 'failed-message',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'hello again',
          timestamp: Date.UTC(2026, 2, 15, 10, 33),
          isOwn: true,
          msgtype: 'm.text',
          deliveryStatus: 'failed',
        }}
        onRetry={onRetry}
      />
    );

    screen.getByRole('button', { name: 'Retry' }).click();
    expect(screen.getByText('Failed to send')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledWith('failed-message');
  });
});
