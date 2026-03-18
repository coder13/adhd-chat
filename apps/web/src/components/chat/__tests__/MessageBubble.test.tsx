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

import { fireEvent, render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';
import { clearResolvedMediaCache } from '../mediaLoader';

describe('MessageBubble', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectUrl = URL.createObjectURL?.bind(URL);
  const originalRevokeObjectUrl = URL.revokeObjectURL?.bind(URL);

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:cached-media');
    URL.revokeObjectURL = jest.fn();
    clearResolvedMediaCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl ?? jest.fn();
    URL.revokeObjectURL = originalRevokeObjectUrl ?? jest.fn();
  });

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
          isOwn: true,
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
    expect(screen.getAllByText('example.com')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hide link preview' })).toBeInTheDocument();
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
    expect(screen.getByText(/Failed to send/)).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledWith('failed-message');
  });

  it('renders read receipt avatars on the supplied message', () => {
    render(
      <MessageBubble
        message={{
          id: 'read-message',
          senderId: '@me:matrix.org',
          senderName: 'Me',
          body: 'Did you see this?',
          timestamp: Date.UTC(2026, 2, 15, 10, 33),
          isOwn: true,
          msgtype: 'm.text',
          deliveryStatus: 'sent',
        }}
        receiptNames={['Alex']}
      />
    );

    expect(screen.getByLabelText('Read by Alex')).toBeInTheDocument();
  });

  it('shows a media reload action when authenticated image fetch fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
    } as Response)) as typeof fetch;

    render(
      <MessageBubble
        message={{
          id: 'image-message',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'photo.jpg',
          timestamp: Date.UTC(2026, 2, 15, 10, 34),
          isOwn: false,
          msgtype: 'm.image',
          mediaUrl: 'https://media.example/image',
        }}
        accessToken="token"
      />
    );

    expect(await screen.findByText('Unable to load image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry load' })).toBeInTheDocument();
    globalThis.fetch = originalFetch;
  });

  it('shows an expanded image view on a dim backdrop', () => {
    render(
      <MessageBubble
        message={{
          id: 'expanded-image',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'photo.jpg',
          timestamp: Date.UTC(2026, 2, 15, 10, 35),
          isOwn: false,
          msgtype: 'm.image',
          mediaUrl: 'https://media.example/photo.jpg',
          mimeType: 'image/jpeg',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand image' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByAltText('photo.jpg')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Close image preview' })
    ).toBeInTheDocument();
  });

  it('shows clearer file action copy', () => {
    render(
      <MessageBubble
        message={{
          id: 'file-message',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'notes.pdf',
          timestamp: Date.UTC(2026, 2, 15, 10, 36),
          isOwn: false,
          msgtype: 'm.file',
          mediaUrl: 'https://media.example/notes.pdf',
          mimeType: 'application/pdf',
          fileSize: 4096,
        }}
      />
    );

    expect(screen.getByText('Open file')).toBeInTheDocument();
    expect(screen.getByText('application/pdf • 4 KB')).toBeInTheDocument();
  });

  it('renders image captions separately from the original filename', () => {
    render(
      <MessageBubble
        message={{
          id: 'captioned-image',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'Look at this',
          filename: 'photo.jpg',
          timestamp: Date.UTC(2026, 2, 15, 10, 36),
          isOwn: false,
          msgtype: 'm.image',
          mediaUrl: 'https://media.example/photo.jpg',
          mimeType: 'image/jpeg',
        }}
      />
    );

    expect(screen.getByText('Look at this')).toBeInTheDocument();
    expect(screen.getAllByAltText('photo.jpg')).toHaveLength(1);
  });

  it('reserves image space from known Matrix dimensions', () => {
    render(
      <MessageBubble
        message={{
          id: 'sized-image',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'photo.jpg',
          timestamp: Date.UTC(2026, 2, 15, 10, 37),
          isOwn: false,
          msgtype: 'm.image',
          mediaUrl: 'https://media.example/photo.jpg',
          imageWidth: 1200,
          imageHeight: 800,
        }}
      />
    );

    const image = screen.getByAltText('photo.jpg');
    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '800');
  });

  it('reuses authenticated media across remounts without refetching', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' });
    const fetchMock = jest.fn(async () => ({
      ok: true,
      blob: async () => blob,
    } as Response));
    globalThis.fetch = fetchMock as typeof fetch;

    const firstRender = render(
      <MessageBubble
        message={{
          id: 'cached-image',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'photo.jpg',
          timestamp: Date.UTC(2026, 2, 15, 10, 38),
          isOwn: false,
          msgtype: 'm.image',
          mediaUrl: 'https://media.example/image',
        }}
        accessToken="token"
      />
    );

    await screen.findByRole('button', { name: 'Expand image' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    render(
      <MessageBubble
        message={{
          id: 'cached-image-2',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: 'photo.jpg',
          timestamp: Date.UTC(2026, 2, 15, 10, 39),
          isOwn: false,
          msgtype: 'm.image',
          mediaUrl: 'https://media.example/image',
        }}
        accessToken="token"
      />
    );

    await screen.findByRole('button', { name: 'Expand image' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders a thread summary chip and opens the thread when clicked', () => {
    const onOpenThread = jest.fn();

    render(
      <MessageBubble
        message={{
          id: 'thread-root',
          senderId: '@alex:matrix.org',
          senderName: 'Alex',
          body: "Let's keep this separate",
          timestamp: Date.UTC(2026, 2, 15, 10, 40),
          isOwn: false,
          msgtype: 'm.text',
        }}
        threadSummary={{
          replyCount: 2,
          latestReply: {
            id: 'thread-reply',
            senderId: '@me:matrix.org',
            senderName: 'Me',
            body: 'Following up in thread',
            timestamp: Date.UTC(2026, 2, 15, 10, 41),
            isOwn: true,
            msgtype: 'm.text',
          },
        }}
        onOpenThread={onOpenThread}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /2 replies/i }));

    expect(screen.getByText('Me: Following up in thread')).toBeInTheDocument();
    expect(onOpenThread).toHaveBeenCalledWith('thread-root');
  });
});
