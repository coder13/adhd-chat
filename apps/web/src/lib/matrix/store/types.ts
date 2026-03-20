import type { AsyncPersistenceBucket } from '../../asyncPersistence';
import type { TimelineMessage } from '../chatCatalog';
import type { TandemRoomMeta } from '../tandem';

export type MatrixViewResourceStorage = 'indexeddb' | 'localStorage';

export interface MatrixViewResourceState<T> {
  data: T;
  error: string | null;
  hasCachedData: boolean;
  hasResolvedData: boolean;
  isFetching: boolean;
  isHydratingCache: boolean;
}

export interface MatrixViewResourceSnapshot<T> {
  data: T;
  error: string | null;
  hasCachedData: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
}

export interface MatrixViewResourceConfig<T> {
  bucket: AsyncPersistenceBucket;
  enabled: boolean;
  initialValue: T;
  load: () => Promise<T>;
  preserveValue?: (currentValue: T, nextValue: T) => T;
  storage: MatrixViewResourceStorage;
}

export interface MatrixViewResource<T> {
  clear: () => void;
  getSnapshot: () => MatrixViewResourceSnapshot<T>;
  refresh: () => Promise<void>;
  setConfig: (config: MatrixViewResourceConfig<T>) => void;
  subscribe: (listener: () => void) => () => void;
  updateData: (updater: T | ((currentValue: T) => T)) => T;
}

export interface RoomSummaryFields {
  name: string;
  description: string | null;
  icon: string | null;
  avatarUrl: string | null;
  subtitle: string;
  isEncrypted: boolean;
  roomMeta: TandemRoomMeta;
}

export interface NormalizedRoomRecord extends RoomSummaryFields {
  id: string;
}

export interface NormalizedRoomStoreRecord {
  room: NormalizedRoomRecord;
  timelineEventIds: string[];
  timelineMessages: Record<string, TimelineMessage>;
  updatedAt: number;
  userId: string;
  version: number;
}
