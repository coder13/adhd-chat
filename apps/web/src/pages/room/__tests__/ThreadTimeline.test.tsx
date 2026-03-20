/// <reference types="jest" />

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ThreadTimeline from '../ThreadTimeline';

jest.mock('../../../components/chat', () => ({
  ChatMessage: ({
    message,
  }: {
    message: { id: string; body: string };
  }) => <div data-testid={`chat-message:${message.id}`}>{message.body}</div>,
}));

describe('ThreadTimeline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 17, 18, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the root message as a regular bubble without thread starter chrome', () => {
    render(
      <ThreadTimeline
        rootMessage={{
          id: 'root',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'Thread root',
          timestamp: new Date(2026, 2, 16, 10, 0).getTime(),
          isOwn: false,
          msgtype: 'm.text',
        }}
        replies={[
          {
            id: 'reply-1',
            senderId: '@me:matrix.org',
            senderName: 'Me',
            body: 'Reply body',
            timestamp: new Date(2026, 2, 17, 10, 1).getTime(),
            isOwn: true,
            msgtype: 'm.text',
          },
        ]}
        viewMode="timeline"
        mentionTargets={[]}
        readReceiptMessageId={null}
        readReceiptNames={[]}
      />
    );

    expect(screen.queryByText('Thread starter')).not.toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByTestId('chat-message:root')).toHaveTextContent(
      'Thread root'
    );
    expect(screen.getByTestId('chat-message:reply-1')).toHaveTextContent(
      'Reply body'
    );
  });

  it('keeps the empty-state copy when a thread has no replies yet', () => {
    render(
      <ThreadTimeline
        rootMessage={{
          id: 'root',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'Thread root',
          timestamp: Date.UTC(2026, 2, 17, 10, 0),
          isOwn: false,
          msgtype: 'm.text',
        }}
        replies={[]}
        viewMode="timeline"
        mentionTargets={[]}
        readReceiptMessageId={null}
        readReceiptNames={[]}
      />
    );

    expect(screen.getByText('No replies yet. Your next message will start the thread.')).toBeInTheDocument();
  });
});
