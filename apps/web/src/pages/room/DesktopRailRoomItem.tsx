import { AppAvatar } from '../../components';
import { cn } from '../../lib/cn';

interface DesktopRailRoomItemBadge {
  label: string;
  tone?: 'primary' | 'success' | 'neutral';
}

interface DesktopRailRoomItemProps {
  name: string;
  icon?: string | null;
  preview: string;
  unreadCount?: number;
  timestampLabel?: string | null;
  footerLabel?: string | null;
  badges?: DesktopRailRoomItemBadge[];
  isActive?: boolean;
  onClick: () => void;
}

function badgeClasses(tone: DesktopRailRoomItemBadge['tone']) {
  switch (tone) {
    case 'success':
      return 'bg-secondary-soft text-secondary-strong';
    case 'neutral':
      return 'bg-surface-muted text-text-muted';
    default:
      return 'bg-primary-soft text-primary-strong';
  }
}

export default function DesktopRailRoomItem({
  name,
  icon = null,
  preview,
  unreadCount = 0,
  timestampLabel = null,
  footerLabel = null,
  badges = [],
  isActive = false,
  onClick,
}: DesktopRailRoomItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'app-interactive-list-item w-full rounded-[22px] px-3 py-3 text-left',
        isActive ? 'is-active' : ''
      )}
    >
      <div className="flex items-start gap-3">
        <AppAvatar
          name={name}
          icon={icon}
          className="mt-0.5 h-10 w-10 shrink-0"
          textClassName="text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <div
                className={cn(
                  'truncate text-sm font-semibold',
                  isActive ? 'text-primary-strong' : 'text-text'
                )}
              >
                {name}
              </div>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-text-inverse">
                  {unreadCount}
                </span>
              ) : null}
            </div>
            {timestampLabel ? (
              <div
                className={cn(
                  'shrink-0 text-xs',
                  isActive ? 'text-primary/80' : 'text-text-muted'
                )}
              >
                {timestampLabel}
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              'mt-1 truncate text-xs',
              isActive ? 'text-primary/85' : 'text-text-muted'
            )}
          >
            {preview}
          </div>
          {footerLabel || badges.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {footerLabel ? (
                <div
                  className={cn(
                    'text-[11px]',
                    isActive ? 'text-primary/80' : 'text-text-subtle'
                  )}
                >
                  {footerLabel}
                </div>
              ) : null}
              {badges.map((badge) => (
                <span
                  key={`${badge.tone ?? 'primary'}:${badge.label}`}
                  className={cn(
                    'rounded-full px-2 py-1 text-[10px] font-medium',
                    badgeClasses(badge.tone)
                  )}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
