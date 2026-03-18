import { IonIcon } from '@ionic/react';
import {
  chatbubbleEllipsesOutline,
  chevronForward,
  returnUpBackOutline,
  trashOutline,
  createOutline,
} from 'ionicons/icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimelineMessage } from '../../lib/matrix/chatCatalog';
import { cn } from '../../lib/cn';
import ReactionPicker from './ReactionPicker';

type MenuPosition = {
  x: number;
  y: number;
};

interface MessageActionMenuProps {
  message: TimelineMessage;
  position: MenuPosition;
  canEdit: boolean;
  isPinned: boolean;
  onClose: () => void;
  onReply?: () => void;
  onReplyInThread?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin: () => void;
  onReact: (emoji: string) => void;
}

const QUICK_REACTIONS = ['🔥', '👍', '❤️', '🥲'];
const MENU_WIDTH = 320;

function MenuRow({
  label,
  onClick,
  isDanger = false,
  trailing = chevronForward,
}: {
  label: string;
  onClick: () => void;
  isDanger?: boolean;
  trailing?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'app-interactive-menu-item flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium',
        isDanger ? 'text-danger-strong' : 'text-text'
      )}
    >
      <span>{label}</span>
      {trailing ? (
        <IonIcon icon={trailing} className="text-base opacity-60" />
      ) : null}
    </button>
  );
}

function MessageActionMenu({
  message,
  position,
  canEdit,
  isPinned,
  onClose,
  onReply,
  onReplyInThread,
  onEdit,
  onDelete,
  onPin,
  onReact,
}: MessageActionMenuProps) {
  const [showPicker, setShowPicker] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState(position);
  const pickerTheme =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';

  useLayoutEffect(() => {
    if (!rootRef.current || typeof window === 'undefined') {
      setMenuPosition(position);
      return;
    }

    const menuHeight = rootRef.current.offsetHeight;
    const clampedX = Math.max(
      16,
      Math.min(position.x, window.innerWidth - MENU_WIDTH - 16)
    );
    const showAbove = position.y + menuHeight > window.innerHeight - 16;

    setMenuPosition({
      x: clampedX,
      y: showAbove
        ? Math.max(16, position.y - menuHeight)
        : Math.max(16, position.y),
    });
  }, [position, showPicker]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (rootRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={rootRef}
      className="app-menu-surface fixed z-[2000] w-80 overflow-hidden rounded-[24px]"
      style={{ left: menuPosition.x, top: menuPosition.y }}
    >
      <div className="border-b border-line/80 px-4 py-4">
        <div className="grid grid-cols-4 gap-3">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={`${message.id}:quick:${emoji}`}
              type="button"
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="app-icon-button flex h-12 items-center justify-center rounded-[18px] text-[28px]"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <MenuRow
            label="Add Reaction"
            onClick={() => setShowPicker((value) => !value)}
          />
        </div>
      </div>

      {showPicker ? (
        <div className="border-b border-line/80 bg-surface-muted/60 px-2 py-2">
          <ReactionPicker
            inline
            theme={pickerTheme}
            onSelect={(emoji) => {
              onReact(emoji);
              onClose();
            }}
          />
        </div>
      ) : null}

      <div className="px-4 py-2">
        {onReplyInThread ? (
          <MenuRow
            label="Reply in Thread"
            onClick={() => {
              onReplyInThread();
              onClose();
            }}
            trailing={chatbubbleEllipsesOutline}
          />
        ) : null}
        {onReply ? (
          <MenuRow
            label="Reply"
            onClick={() => {
              onReply();
              onClose();
            }}
            trailing={returnUpBackOutline}
          />
        ) : null}
        {canEdit && onEdit ? (
          <MenuRow
            label="Edit"
            onClick={() => {
              onEdit();
              onClose();
            }}
            trailing={createOutline}
          />
        ) : null}
        <MenuRow
          label={isPinned ? 'Unpin Message' : 'Pin Message'}
          onClick={() => {
            onPin();
            onClose();
          }}
          trailing={null}
        />
        {onDelete ? (
          <MenuRow
            label="Delete Message"
            onClick={() => {
              onDelete();
              onClose();
            }}
            isDanger
            trailing={trashOutline}
          />
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export default MessageActionMenu;
