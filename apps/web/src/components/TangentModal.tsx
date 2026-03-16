import { useEffect, useMemo, useState } from 'react';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import { cn } from '../lib/cn';

interface TangentTopicOption {
  id: string;
  name: string;
  membership: string;
  category: string | null;
}

interface TangentModalProps {
  isOpen: boolean;
  onClose: () => void;
  topics: TangentTopicOption[];
  onSelectTopic: (topicId: string) => Promise<void> | void;
  onCreateTopic: (name: string) => Promise<void> | void;
  isSubmitting?: boolean;
  error?: string | null;
}

function normalizeTopicName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function TangentModal({
  isOpen,
  onClose,
  topics,
  onSelectTopic,
  onCreateTopic,
  isSubmitting = false,
  error = null,
}: TangentModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const normalizedQuery = normalizeTopicName(query);
  const filteredTopics = useMemo(() => {
    if (!normalizedQuery) {
      return topics.slice(0, 8);
    }

    return topics.filter((topic) =>
      normalizeTopicName(topic.name).includes(normalizedQuery)
    );
  }, [normalizedQuery, topics]);

  const exactMatch = useMemo(
    () =>
      topics.find((topic) => normalizeTopicName(topic.name) === normalizedQuery) ??
      null,
    [normalizedQuery, topics]
  );

  const handlePrimaryAction = async () => {
    if (exactMatch) {
      await onSelectTopic(exactMatch.id);
      return;
    }

    await onCreateTopic(query.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a tangent" size="sm">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-muted">
          Start typing to jump into an existing topic, or create a new tangent in
          one tap.
        </p>
        <Input
          label="Topic"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search or name a topic"
          autoFocus
          helperText={
            normalizedQuery
              ? 'Existing topics appear below as you type.'
              : 'Leave this blank to open a fresh tangent and start writing.'
          }
        />
        <div className="rounded-[24px] border border-line bg-elevated/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="6" />
              </svg>
            </span>
            Existing topics
          </div>

          {filteredTopics.length > 0 ? (
            <div className="space-y-2">
              {filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={cn(
                    'w-full rounded-2xl border border-line bg-panel px-4 py-3 text-left transition-colors',
                    'text-text hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-panel'
                  )}
                  disabled={isSubmitting}
                  onClick={() => void onSelectTopic(topic.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text">
                        {topic.name}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {topic.membership === 'invite'
                          ? 'Tap to join'
                          : topic.category ?? 'Existing topic'}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-accent">
                      {topic.membership === 'invite' ? 'Join' : 'Open'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-panel/70 px-4 py-5 text-sm text-text-muted">
              {normalizedQuery
                ? 'No topic matches yet. Create it below.'
                : 'Your Tandem topics will appear here once you have a few threads.'}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handlePrimaryAction()}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Working...'
              : exactMatch
                ? `Open "${exactMatch.name}"`
                : normalizedQuery
                  ? `Create "${query.trim()}"`
                  : 'Start new tangent'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default TangentModal;
