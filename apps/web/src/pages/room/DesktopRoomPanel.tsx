import { IonIcon } from '@ionic/react';
import { arrowBack, closeOutline, createOutline, pinOutline, searchOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Button, IconPickerField } from '../../components';
import type { ChatViewMode } from '../../lib/matrix/preferences';
import ThreadTimeline from './ThreadTimeline';
import type { RoomMessage } from './types';

export type DesktopRoomPanelView =
  | 'details'
  | 'search'
  | 'pins'
  | 'edit'
  | 'thread';

interface DesktopRoomThreadPanelState {
  rootMessage: RoomMessage | null;
  replies: RoomMessage[];
  accessToken?: string | null;
  viewMode: ChatViewMode;
  mentionTargets: Array<{ userId: string; displayName: string }>;
  readReceiptMessageId: string | null;
  readReceiptNames: string[];
  onRetry?: (messageId: string) => void;
  onToggleReaction?: (message: RoomMessage, reactionKey: string) => void;
  onRequestActions?: (
    message: RoomMessage,
    position: { x: number; y: number }
  ) => void;
}

interface DesktopRoomPanelProps {
  view: DesktopRoomPanelView;
  width: number;
  roomName: string;
  roomDescription: string | null;
  roomIcon: string | null;
  pinnedMessageIds: string[];
  messages: RoomMessage[];
  savingIdentity: boolean;
  actionError: string | null;
  threadPanelState: DesktopRoomThreadPanelState | null;
  threadTimelineScrollRef?: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onBackToDetails: () => void;
  onOpenView: (view: DesktopRoomPanelView) => void;
  onSaveTopicIdentity: (values: {
    name: string;
    description: string;
    icon: string | null;
  }) => Promise<void>;
}

function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return isSameDay
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(date);
}

export default function DesktopRoomPanel({
  view,
  width,
  roomName,
  roomDescription,
  roomIcon,
  pinnedMessageIds,
  messages,
  savingIdentity,
  actionError,
  threadPanelState,
  threadTimelineScrollRef,
  onClose,
  onBackToDetails,
  onOpenView,
  onSaveTopicIdentity,
}: DesktopRoomPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [draftName, setDraftName] = useState(roomName);
  const [draftDescription, setDraftDescription] = useState(roomDescription ?? '');
  const [draftIcon, setDraftIcon] = useState<string | null>(roomIcon);

  useEffect(() => {
    if (view !== 'edit') {
      return;
    }

    setDraftName(roomName);
    setDraftDescription(roomDescription ?? '');
    setDraftIcon(roomIcon);
  }, [roomDescription, roomIcon, roomName, view]);

  const pinnedMessages = useMemo(() => {
    const pinnedSet = new Set(pinnedMessageIds);
    return messages.filter((message) => pinnedSet.has(message.id));
  }, [messages, pinnedMessageIds]);

  const visibleSearchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return messages;
    }

    return messages.filter((message) => {
      const haystack = [
        message.senderName,
        message.senderId,
        message.body,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [messages, searchQuery]);

  const showBackButton = view !== 'details' && view !== 'thread';

  return (
    <aside
      className="app-glass-panel app-surface-divider-left hidden xl:flex xl:shrink-0 xl:flex-col"
      style={{ width }}
    >
      <div className="app-surface-divider-bottom flex items-center gap-2 px-4 py-3">
        {showBackButton ? (
          <button
            type="button"
            className="app-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            onClick={onBackToDetails}
            aria-label="Back to topic panel"
          >
            <IonIcon icon={arrowBack} className="text-lg text-text-muted" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-text">
            {view === 'details'
              ? 'Topic tools'
              : view === 'search'
                ? 'Search in topic'
                : view === 'pins'
                  ? 'Pinned messages'
                  : view === 'thread'
                    ? 'Thread'
                    : 'Edit topic'}
          </div>
        </div>
        <button
          type="button"
          className="app-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          onClick={onClose}
          aria-label="Close topic panel"
        >
          <IonIcon icon={closeOutline} className="text-lg text-text-muted" />
        </button>
      </div>

      {view === 'thread' ? (
        <div
          ref={threadTimelineScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          {threadPanelState ? (
            <ThreadTimeline
              rootMessage={threadPanelState.rootMessage}
              replies={threadPanelState.replies}
              accessToken={threadPanelState.accessToken}
              viewMode={threadPanelState.viewMode}
              mentionTargets={threadPanelState.mentionTargets}
              readReceiptMessageId={threadPanelState.readReceiptMessageId}
              readReceiptNames={threadPanelState.readReceiptNames}
              onRetry={threadPanelState.onRetry}
              onToggleReaction={threadPanelState.onToggleReaction}
              onRequestActions={threadPanelState.onRequestActions}
            />
          ) : (
            <div className="rounded-[22px] border border-line bg-panel px-4 py-4 text-sm text-text-muted">
              This thread is no longer available.
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {view === 'details' ? (
            <div className="space-y-2">
              <button
                type="button"
                className="app-interactive-list-item flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left"
                onClick={() => onOpenView('search')}
              >
                <div className="app-icon-button flex h-10 w-10 items-center justify-center rounded-full text-primary-strong">
                  <IonIcon icon={searchOutline} className="text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">
                    Search messages
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    Search within this topic only
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="app-interactive-list-item flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left"
                onClick={() => onOpenView('pins')}
              >
                <div className="app-icon-button flex h-10 w-10 items-center justify-center rounded-full text-primary-strong">
                  <IonIcon icon={pinOutline} className="text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">
                    Pinned messages
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    Browse everything pinned in this topic
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="app-interactive-list-item flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left"
                onClick={() => onOpenView('edit')}
              >
                <div className="app-icon-button flex h-10 w-10 items-center justify-center rounded-full text-primary-strong">
                  <IonIcon icon={createOutline} className="text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">Edit topic</div>
                  <div className="mt-1 text-xs text-text-muted">
                    Update the name, description, and icon
                  </div>
                </div>
              </button>
            </div>
          ) : null}

          {view === 'search' ? (
            <div className="space-y-4">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search messages in this topic"
                className="block w-full rounded-[22px] border border-line/70 bg-panel px-4 py-3 text-sm text-text outline-none transition-colors focus:ring-2 focus:ring-primary/20"
              />
              <div className="space-y-3">
                {visibleSearchResults.length === 0 ? (
                  <div className="rounded-[22px] border border-line bg-panel px-4 py-4 text-sm text-text-muted">
                    No messages matched that search.
                  </div>
                ) : (
                  visibleSearchResults.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-[22px] border border-line bg-panel px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-xs font-medium uppercase tracking-[0.12em] text-text-subtle">
                          {message.senderName}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {formatTimestamp(message.timestamp)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-text">
                        {message.body}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {view === 'pins' ? (
            <div className="space-y-3">
              {pinnedMessages.length === 0 ? (
                <div className="rounded-[22px] border border-line bg-panel px-4 py-4 text-sm text-text-muted">
                  No pinned messages in this topic yet.
                </div>
              ) : (
                pinnedMessages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-[22px] border border-line bg-panel px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-xs font-medium uppercase tracking-[0.12em] text-text-subtle">
                        {message.senderName}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-text">
                      {message.body}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {view === 'edit' ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void onSaveTopicIdentity({
                  name: draftName,
                  description: draftDescription,
                  icon: draftIcon,
                });
              }}
            >
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text">
                  Topic name
                </label>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="block w-full rounded-[22px] border border-line/70 bg-panel px-4 py-3 text-sm text-text outline-none transition-colors focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text">
                  Description
                </label>
                <textarea
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  rows={5}
                  className="block w-full rounded-[22px] border border-line/70 bg-panel px-4 py-3 text-sm text-text outline-none transition-colors focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <IconPickerField
                name={draftName || roomName}
                value={draftIcon}
                onChange={setDraftIcon}
                disabled={savingIdentity}
              />

              {actionError ? (
                <div className="text-sm text-danger">{actionError}</div>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBackToDetails}
                  disabled={savingIdentity}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingIdentity}>
                  {savingIdentity ? 'Saving...' : 'Save topic'}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </aside>
  );
}
