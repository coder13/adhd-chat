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
});
