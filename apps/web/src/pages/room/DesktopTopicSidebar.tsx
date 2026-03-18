import type {
  TandemSpaceRoomSummary,
  TandemSpaceSummary,
} from '../../lib/matrix/spaceCatalog';
import DesktopDirectoryPanel, { type DesktopDirectoryView } from './DesktopDirectoryPanel';
import DesktopRailRoomItem from './DesktopRailRoomItem';
import DesktopSettingsPanel, { type DesktopSettingsSection } from './DesktopSettingsPanel';

interface DesktopTopicSidebarProps {
  width: number;
  view: 'topics' | 'settings' | DesktopDirectoryView;
  settingsSection: DesktopSettingsSection;
  searchQuery: string;
  currentRoomId: string;
  topics: TandemSpaceRoomSummary[];
  onSelectTopic: (topicId: string) => void;
  onSelectHub?: (space: TandemSpaceSummary) => void;
  onOpenAddContact?: () => void;
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
  onSelectHub,
  onOpenAddContact,
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
      className="app-glass-panel app-surface-divider-right hidden xl:flex xl:shrink-0 xl:flex-col"
      style={{ width }}
    >
      {view === 'topics' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-1.5">
            {visibleTopics.map((topic) => {
              const isActive = topic.id === currentRoomId;
              const canOpen = topic.membership === 'join';

              return (
                <DesktopRailRoomItem
                  key={topic.id}
                  onClick={() => onSelectTopic(topic.id)}
                  name={topic.name}
                  icon={topic.icon}
                  preview={topic.description || topic.preview}
                  unreadCount={topic.unreadCount}
                  footerLabel={
                    isActive ? 'Open now' : canOpen ? 'Switch topic' : 'Join topic'
                  }
                  isActive={isActive}
                />
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
        />
      ) : (
        <DesktopDirectoryPanel
          view={view}
          onSelectHub={onSelectHub}
          onOpenRoute={onOpenRoute}
          onOpenAddContact={onOpenAddContact}
          currentRoomId={currentRoomId}
        />
      )}
    </aside>
  );
}
