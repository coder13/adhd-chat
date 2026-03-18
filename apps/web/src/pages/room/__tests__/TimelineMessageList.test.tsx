/// <reference types="jest" />

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TimelineMessageList from '../TimelineMessageList';

jest.mock('../../../components/chat', () => ({
  MessageBubble: ({
    message,
  }: {
    message: { id: string; body: string };
  }) => <div data-testid={`message-bubble:${message.id}`}>{message.body}</div>,
}));

function localTimestamp(
  year: number,
  monthIndex: number,
  day: number,
  hour = 12,
  minute = 0
) {
  return new Date(year, monthIndex, day, hour, minute).getTime();
}

describe('TimelineMessageList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 17, 18, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders day separators before the first message of each day', () => {
    render(
      <TimelineMessageList
        messages={[
          {
            id: 'yesterday-1',
            senderId: '@alex:example.com',
            senderName: 'Alex',
            body: 'Yesterday one',
            timestamp: localTimestamp(2026, 2, 16, 9),
            isOwn: false,
            msgtype: 'm.text',
          },
          {
            id: 'yesterday-2',
            senderId: '@alex:example.com',
            senderName: 'Alex',
            body: 'Yesterday two',
            timestamp: localTimestamp(2026, 2, 16, 17),
            isOwn: false,
            msgtype: 'm.text',
          },
          {
            id: 'today-1',
            senderId: '@me:example.com',
            senderName: 'Me',
            body: 'Today one',
            timestamp: localTimestamp(2026, 2, 17, 10),
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

    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble:yesterday-1')).toHaveTextContent(
      'Yesterday one'
    );
    expect(screen.getByTestId('message-bubble:yesterday-2')).toHaveTextContent(
      'Yesterday two'
    );
    expect(screen.getByTestId('message-bubble:today-1')).toHaveTextContent(
      'Today one'
    );
  });
});
