import { IonIcon } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import { cn } from '../lib/cn';

interface TangentTopicOption {
  id: string;
  name: string;
  membership: string;
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
  const isMobile =
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 639px)').matches
      : false;

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
      topics.find(
        (topic) => normalizeTopicName(topic.name) === normalizedQuery
      ) ?? null,
    [normalizedQuery, topics]
  );

  const handlePrimaryAction = async () => {
    if (exactMatch) {
      await onSelectTopic(exactMatch.id);
      return;
    }

    await onCreateTopic(query.trim());
  };

  const topicList = filteredTopics.length > 0 ? (
    <div className="space-y-2">
      {filteredTopics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          className={cn(
            'w-full rounded-2xl bg-elevated px-4 py-3 text-left transition-colors',
            'text-text hover:bg-elevated/80 focus:outline-none focus:ring-2 focus:ring-accent/40'
          )}
          disabled={isSubmitting}
          onClick={() => void onSelectTopic(topic.id)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">
                {topic.name}
              </div>
            </div>
            <div className="shrink-0 text-xs font-medium text-accent">
              {topic.membership === 'invite' ? 'Join' : 'Open'}
            </div>
          </div>
        </button>
      ))}
    </div>
  ) : normalizedQuery ? (
    <div className="rounded-2xl bg-elevated px-4 py-4 text-sm text-text-muted">
      No matching topics
    </div>
  ) : null;

  const body = (
    <div className="space-y-4">
      <Input
        label="Topic"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search or create a topic"
        autoFocus
      />

      {topicList}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={() => void handlePrimaryAction()}
          disabled={isSubmitting || (!exactMatch && !normalizedQuery)}
        >
          {isSubmitting
            ? 'Working...'
            : exactMatch
              ? 'Open topic'
              : 'Create topic'}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return isOpen ? (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-[var(--app-shell-background)] text-text"
        role="dialog"
        aria-modal="true"
        aria-label="Open or create a topic"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <IonIcon icon={arrowBack} className="text-[20px]" />
          </button>
          <h2 className="text-base font-semibold">Topics</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{body}</div>
      </div>
    ) : null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open or create a topic" size="sm">
      {body}
    </Modal>
  );
}

export default TangentModal;
