import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { type ISearchResults } from 'matrix-js-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppAvatar, Button, Card } from '../components';
import { ListPageLayout } from '../components/ionic';
import { useMatrixClient } from '../hooks/useMatrixClient';
import {
  buildTandemSearchIndex,
  mergeTandemSearchResults,
  mapTandemSearchResults,
  searchLoadedEncryptedMessages,
  type TandemMessageSearchResult,
  type TandemSearchIndex,
} from '../lib/matrix/search';

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

function getSearchErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('unrecognized') ||
    normalized.includes('not found') ||
    normalized.includes('[404]') ||
    normalized.includes('[501]')
  ) {
    return 'This homeserver does not support conversation search.';
  }

  return message;
}

function SearchPage() {
  const navigate = useNavigate();
  const { client, isReady, user } = useMatrixClient();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<TandemSearchIndex | null>(null);
  const [results, setResults] = useState<TandemMessageSearchResult[]>([]);
  const [rawResults, setRawResults] = useState<ISearchResults | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !user || !isReady) {
      setIndex(null);
      return;
    }

    let cancelled = false;
    setIsLoadingIndex(true);

    void buildTandemSearchIndex(client, user.userId)
      .then((nextIndex) => {
        if (!cancelled) {
          setIndex(nextIndex);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingIndex(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, isReady, user]);

  useEffect(() => {
    if (!client || !user || !isReady || !index) {
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setRawResults(null);
      setError(null);
      setSearchNotice(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setError(null);
      const localEncryptedResults = searchLoadedEncryptedMessages(
        client,
        index,
        trimmedQuery
      );

      if (index.encryptedRoomCount > 0) {
        setSearchNotice(
          `Encrypted topics are searched from decrypted messages already loaded on this device.`
        );
      } else {
        setSearchNotice(null);
      }

      const searchableServerRoomIds = index.rooms
        .filter((room) => !room.isEncrypted)
        .map((room) => room.roomId);

      if (searchableServerRoomIds.length === 0) {
        setRawResults(null);
        setResults(localEncryptedResults);
        setIsSearching(false);
        return;
      }

      void client
        .searchRoomEvents({
          term: trimmedQuery,
          filter: {
            rooms: searchableServerRoomIds,
            types: ['m.room.message'],
            limit: 20,
          },
        })
        .then((nextResults) => {
          if (cancelled) {
            return;
          }

          const serverResults = mapTandemSearchResults(nextResults, index);
          setRawResults(nextResults);
          setResults(
            mergeTandemSearchResults(serverResults, localEncryptedResults)
          );
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(getSearchErrorMessage(cause));
            setRawResults(null);
            setResults(localEncryptedResults);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [client, index, isReady, query, user]);

  const hasMoreResults = Boolean(rawResults?.next_batch);
  const encryptedRoomsNote = useMemo(() => {
    if (!index || index.encryptedRoomCount === 0) {
      return null;
    }

    return `${index.encryptedRoomCount} encrypted ${
      index.encryptedRoomCount === 1 ? 'topic is' : 'topics are'
    } searched locally from loaded history on this device.`;
  }, [index]);

  const handleLoadMore = async () => {
    if (!client || !rawResults || !index) {
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const nextResults = await client.backPaginateRoomEventsSearch(rawResults);
      const localEncryptedResults = searchLoadedEncryptedMessages(
        client,
        index,
        query
      );
      setRawResults(nextResults);
      setResults(
        mergeTandemSearchResults(
          mapTandemSearchResults(nextResults, index),
          localEncryptedResults
        )
      );
    } catch (cause) {
      setError(getSearchErrorMessage(cause));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <ListPageLayout
      title="Search"
      startSlot={
        <IonButton fill="clear" color="medium" onClick={() => navigate(-1)}>
          <IonIcon slot="icon-only" icon={arrowBack} />
        </IonButton>
      }
      headerContent={
        <IonSearchbar
          value={query}
          onIonInput={(event) => setQuery(event.detail.value ?? '')}
          placeholder="Search messages across your conversations"
          className="app-searchbar"
          autoFocus
        />
      }
    >
      <div className="space-y-4 px-4 pb-24 pt-4">
        {encryptedRoomsNote ? (
          <Card>
            <p className="text-sm text-text-muted">{encryptedRoomsNote}</p>
          </Card>
        ) : null}

        {error ? (
          <Card>
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : null}

        {searchNotice ? (
          <Card>
            <p className="text-sm text-text-muted">{searchNotice}</p>
          </Card>
        ) : null}

        {isLoadingIndex ? (
          <div className="py-12 text-center text-sm text-text-muted">
            Loading conversations...
          </div>
        ) : query.trim().length < 2 ? (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-text">Search messages</p>
            <p className="mt-2 text-sm text-text-muted">
              Type at least two characters to search across your hubs, topics,
              and other conversations.
            </p>
          </div>
        ) : isSearching && results.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">
            Searching...
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-text">No matches yet</p>
            <p className="mt-2 text-sm text-text-muted">
              Try a shorter phrase or different wording.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="app-hover-surface w-full rounded-[24px] border border-transparent bg-panel px-4 py-4 text-left"
                  onClick={() =>
                    navigate(`/room/${encodeURIComponent(result.roomId)}`)
                  }
                >
                  <div className="flex items-start gap-3">
                    <AppAvatar
                      name={result.roomName}
                      icon={result.roomIcon}
                      className="h-11 w-11"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-semibold text-text">
                            {result.roomName}
                          </h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-text-subtle">
                            {result.hubName
                              ? `${result.hubName} · ${result.senderName}`
                              : result.senderName}
                          </p>
                          {result.source === 'local-encrypted' ? (
                            <p className="mt-1 text-[11px] text-text-subtle">
                              From loaded encrypted history
                            </p>
                          ) : null}
                        </div>
                        <div className="text-xs text-text-muted">
                          {formatTimestamp(result.timestamp)}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">
                        {result.body}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {hasMoreResults ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => void handleLoadMore()}
                  disabled={isSearching}
                >
                  {isSearching ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </ListPageLayout>
  );
}

export default SearchPage;
