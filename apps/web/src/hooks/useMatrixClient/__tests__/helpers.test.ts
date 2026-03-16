/// <reference types="jest" />

const mockInitAsync = jest.fn(async () => undefined);
const mockDecodeRecoveryKey = jest.fn();
const mockCreateClient = jest.fn();

class MockMemoryCryptoStore {
  startup = jest.fn(async () => undefined);
  deleteAllData = jest.fn(async () => undefined);
}

jest.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
  initAsync: mockInitAsync,
}));

jest.mock('matrix-js-sdk/lib/crypto-api', () => ({
  decodeRecoveryKey: mockDecodeRecoveryKey,
}));

jest.mock('matrix-js-sdk', () => ({
  createClient: mockCreateClient,
  MemoryCryptoStore: MockMemoryCryptoStore,
  IndexedDBCryptoStore: MockMemoryCryptoStore,
}));

import { buildAuthedClient, resetAuthedClient } from '../helpers';

describe('buildAuthedClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthedClient();
  });

  it('refreshes an expired stored session before validating startup', async () => {
    const refreshedSession = {
      access_token: 'fresh-token',
      refresh_token: 'fresh-refresh',
      expires_in_ms: 60_000,
    };
    const refreshClient = {
      refreshToken: jest.fn(async () => refreshedSession),
    };
    const authedClient = {
      getUserId: jest.fn(() => '@test:example'),
      getDeviceId: jest.fn(() => 'DEV1'),
      stopClient: jest.fn(),
      initRustCrypto: jest.fn(async () => undefined),
      startClient: jest.fn(async () => undefined),
      setAccessToken: jest.fn(),
      getJoinedRooms: jest.fn(async () => ({ joined_rooms: [] })),
    };

    mockCreateClient
      .mockReturnValueOnce(refreshClient)
      .mockReturnValueOnce(authedClient);

    const onPersist = jest.fn();

    const client = await buildAuthedClient(
      {
        baseUrl: 'https://matrix.example',
        userId: '@test:example',
        deviceId: 'DEV1',
        accessToken: 'stale-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000,
      },
      onPersist
    );

    expect(client).toBe(authedClient);
    expect(refreshClient.refreshToken).toHaveBeenCalledWith('refresh-token');
    expect(authedClient.startClient).toHaveBeenCalled();
    expect(authedClient.getJoinedRooms).toHaveBeenCalled();
    expect(onPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'fresh-token',
        refreshToken: 'fresh-refresh',
      })
    );
  });
});
