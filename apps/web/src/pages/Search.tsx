import { IonButton, IonIcon, IonSearchbar } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { type ISearchResults } from 'matrix-js-sdk';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppAvatar, Button } from '../components';
import { ListPageLayout } from '../components/ionic';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { getRoomDisplayName } from '../lib/matrix/chatCatalog';
import { getRoomIcon } from '../lib/matrix/identity';
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
  const { roomId: encodedRoomId } = useParams<{ roomId?: string }>();
  const scopedRoomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : null;
  const { client, isReady, user } = useMatrixClient();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<TandemSearchIndex | null>(null);
  const [results, setResults] = useState<TandemMessageSearchResult[]>([]);
  const [rawResults, setRawResults] = useState<ISearchResults | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const scopedRoom = scopedRoomId ? client?.getRoom(scopedRoomId) ?? null : null;
  const scopedRoomName =
    scopedRoom && user ? getRoomDisplayName(scopedRoom, user.userId) : 'Current room';
  const scopedRoomIcon = scopedRoom ? getRoomIcon(scopedRoom) : null;
  const scopedRoomIsEncrypted = Boolean(
    scopedRoom?.currentState.getStateEvents('m.room.encryption', '')
  );

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
      ).filter((result) => (scopedRoomId ? result.roomId === scopedRoomId : true));

      if (index.encryptedRoomCount > 0 && !scopedRoomId) {
        setSearchNotice(
          `Encrypted topics are searched from decrypted messages already loaded on this device.`
        );
      } else if (scopedRoomIsEncrypted) {
        setSearchNotice(
          'Encrypted messages in this topic are searched from decrypted history already loaded on this device.'
        );
      } else {
        setSearchNotice(null);
      }

      const searchableServerRoomIds = index.rooms
        .filter((room) => (scopedRoomId ? room.roomId === scopedRoomId : true))
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
  }, [client, index, isReady, query, scopedRoomId, scopedRoomIsEncrypted, user]);

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
      ).filter((result) => (scopedRoomId ? result.roomId === scopedRoomId : true));
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
      title={scopedRoomId ? 'Search topic' : 'Search'}
      startSlot={
        <IonButton fill="clear" color="medium" onClick={() => navigate(-1)}>
          <IonIcon slot="icon-only" icon={arrowBack} />
        </IonButton>
      }
      headerContent={
        <IonSearchbar
          value={query}
          onIonInput={(event) => setQuery(event.detail.value ?? '')}
          placeholder={scopedRoomId ? 'Search this topic' : 'Search messages'}
          className="app-searchbar"
          autoFocus
        />
      }
    >
      <div className="space-y-4 px-4 pb-24 pt-4">
        {scopedRoomId ? (
          <div className="flex items-center gap-3 rounded-[22px] border border-line bg-panel px-3 py-3">
            <AppAvatar
              name={scopedRoomName}
              icon={scopedRoomIcon}
              className="h-10 w-10"
              textClassName="text-sm"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-text">{scopedRoomName}</div>
              <div className="truncate text-xs text-text-muted">
                Searching messages in the current topic only
              </div>
            </div>
          </div>
        ) : null}

        {encryptedRoomsNote ? (
          <div className="text-sm text-text-muted">{encryptedRoomsNote}</div>
        ) : null}

        {error ? <div className="text-sm text-danger">{error}</div> : null}

        {searchNotice ? (
          <div className="text-sm text-text-muted">{searchNotice}</div>
        ) : null}

        {isLoadingIndex ? (
          <div className="py-12 text-center text-sm text-text-muted">
            Loading conversations...
          </div>
        ) : query.trim().length < 2 ? (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-text">
              {scopedRoomId ? 'Search this topic' : 'Search messages'}
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
                  className="app-hover-surface w-full rounded-[22px] border border-transparent bg-panel px-3 py-3 text-left"
                  onClick={() =>
                    navigate(`/room/${encodeURIComponent(result.roomId)}`)
                  }
                >
                  <div className="flex items-start gap-3">
                    <AppAvatar
                      name={result.roomName}
                      icon={result.roomIcon}
                      className="h-10 w-10"
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
                            <p className="mt-1 text-[11px] text-text-subtle">Encrypted</p>
                          ) : null}
                        </div>
                        <div className="text-xs text-text-muted">
                          {formatTimestamp(result.timestamp)}
                        </div>
                      </div>
                      <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-text-muted">
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
