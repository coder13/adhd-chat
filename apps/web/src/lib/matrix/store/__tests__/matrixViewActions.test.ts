jest.mock('../../catalogPatches', () => ({
  patchOtherChatCatalogEntry: jest.fn(),
  patchTandemSpaceCatalogEntry: jest.fn(),
  patchTandemSpaceRoomCatalogEntry: jest.fn(),
  replaceTandemSpaceRoomCatalog: jest.fn(),
  loadContactCatalogRoomSummaries: jest.fn(),
}));

jest.mock('../../chatCatalog', () => ({
  buildChatCatalog: jest.fn(),
  buildContactCatalog: jest.fn(),
}));

jest.mock('../../spaceCatalog', () => ({
  buildTandemSpaceCatalog: jest.fn(),
  buildTandemSpaceRoomCatalog: jest.fn(),
}));

jest.mock('../../roomHistory', () => ({
  paginateRoomHistoryBack: jest.fn(),
}));

jest.mock('../../tandem', () => ({}));

jest.mock('../normalizedRoomStore', () => ({
  buildNormalizedRoomStoreFromSnapshot: jest.fn(() => ({ mocked: true })),
  buildRoomSnapshotFromNormalizedStore: jest.fn(),
  loadNormalizedRoomStore: jest.fn(),
  saveNormalizedRoomStore: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../roomSnapshot', () => ({
  buildRoomSnapshot: jest.fn(),
}));

import { buildRoomSnapshot } from '../../roomSnapshot';
import {
  buildRoomSnapshotFromNormalizedStore,
  loadNormalizedRoomStore,
  saveNormalizedRoomStore,
} from '../normalizedRoomStore';
import {
  loadRoomSnapshotAction,
  refreshRoomSnapshotAction,
} from '../matrixViewActions';

describe('matrixViewActions normalized room hydration', () => {
  const getRoomMock = jest.fn();
  const client = {
    getRoom: getRoomMock,
  } as unknown as MatrixClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates the active room from normalized records before rebuilding', async () => {
    (loadNormalizedRoomStore as jest.Mock).mockResolvedValue({ version: 1 });
    (buildRoomSnapshotFromNormalizedStore as jest.Mock).mockReturnValue({
      roomName: 'Normalized',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: 'Hub',
      messages: [],
      threads: [],
      isEncrypted: false,
      roomMeta: {},
    });

    const snapshot = await loadRoomSnapshotAction(
      client,
      '@me:example.com',
      '!room:example.com'
    );

    expect(snapshot.roomName).toBe('Normalized');
    expect(buildRoomSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to rebuilding and persists normalized records when needed', async () => {
    const room = { roomId: '!room:example.com' };
    const rebuiltSnapshot = {
      roomName: 'Live',
      roomDescription: null,
      roomIcon: null,
      roomAvatarUrl: null,
      roomSubtitle: 'Hub',
      messages: [],
      threads: [],
      isEncrypted: false,
      roomMeta: {},
    };

    (loadNormalizedRoomStore as jest.Mock).mockResolvedValue(null);
    getRoomMock.mockReturnValue(room);
    (buildRoomSnapshot as jest.Mock).mockResolvedValue(rebuiltSnapshot);

    const snapshot = await refreshRoomSnapshotAction(
      client,
      '@me:example.com',
      '!room:example.com'
    );

    expect(snapshot).toBe(rebuiltSnapshot);
    expect(buildRoomSnapshot).toHaveBeenCalledWith(
      client,
      room,
      '@me:example.com'
    );
    expect(saveNormalizedRoomStore).toHaveBeenCalled();
  });
});
import type { MatrixClient } from 'matrix-js-sdk';
