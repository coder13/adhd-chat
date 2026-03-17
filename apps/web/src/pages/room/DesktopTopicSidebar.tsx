import { AppAvatar } from '../../components';
import type { TandemSpaceRoomSummary } from '../../lib/matrix/spaceCatalog';
import { cn } from '../../lib/cn';
import DesktopDirectoryPanel, { type DesktopDirectoryView } from './DesktopDirectoryPanel';
import DesktopSettingsPanel, { type DesktopSettingsSection } from './DesktopSettingsPanel';

interface DesktopTopicSidebarProps {
  width: number;
  view: 'topics' | 'settings' | DesktopDirectoryView;
  settingsSection: DesktopSettingsSection;
  searchQuery: string;
  currentRoomId: string;
  topics: TandemSpaceRoomSummary[];
  onSelectTopic: (topicId: string) => void;
  onSelectSettingsSection: (section: Exclude<DesktopSettingsSection, 'menu'>) => void;
  onOpenRoute: (path: string) => void;
}

export default function DesktopTopicSidebar({
  width,
  view,
  settingsSection,
  searchQuery,
  currentRoomId,
  topics,
  onSelectTopic,
  onSelectSettingsSection,
  onOpenRoute,
}: DesktopTopicSidebarProps) {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleTopics =
    normalizedSearch.length === 0
      ? topics
      : topics.filter((topic) => {
          const haystack = [
            topic.name,
            topic.description ?? '',
            topic.preview,
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedSearch);
        });

  return (
    <aside
      className="hidden xl:flex xl:shrink-0 xl:flex-col xl:border-r xl:border-line/80 xl:bg-white/70 xl:backdrop-blur-sm"
      style={{ width }}
    >
      {view === 'topics' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1.5">
            {visibleTopics.map((topic) => {
              const isActive = topic.id === currentRoomId;
              const canOpen = topic.membership === 'join';

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  className={cn(
                    'w-full rounded-[22px] border px-3 py-3 text-left transition-colors',
                    isActive
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-transparent bg-transparent hover:border-line hover:bg-panel/80'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AppAvatar
                      name={topic.name}
                      icon={topic.icon}
                      className="mt-0.5 h-10 w-10 shrink-0"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-text">
                          {topic.name}
                        </div>
                        {topic.unreadCount > 0 ? (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-text-inverse">
                            {topic.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-xs text-text-muted">
                        {topic.description || topic.preview}
                      </div>
                      <div className="mt-2 text-[11px] text-text-subtle">
                        {isActive
                          ? 'Open now'
                          : canOpen
                            ? 'Switch topic'
                            : 'Join topic'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {visibleTopics.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-base font-medium text-text">
                  {searchQuery.trim().length > 0 ? 'No matching rooms' : 'Loading rooms'}
                </p>
                <p className="mt-2 text-sm text-text-muted">
                  {searchQuery.trim().length > 0
                    ? 'Try a room name or a word from the topic preview.'
                    : 'Your topics will appear here as soon as they are available.'}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : view === 'settings' ? (
        <DesktopSettingsPanel
          section={settingsSection}
          onSelectSection={onSelectSettingsSection}
          onOpenRoute={onOpenRoute}
        />
      ) : (
        <DesktopDirectoryPanel view={view} />
      )}
    </aside>
  );
}
