/// <reference types="jest" />

const mockInitAsync = jest.fn(async () => undefined);
const mockDecodeRecoveryKey = jest.fn();
const mockCreateClient = jest.fn();
const mockTimeMatrixPerf = jest.fn(
  async <T>(_name: string, work: () => Promise<T>) => work()
);
const mockIncrementMatrixPerfCounter = jest.fn();
const mockIndexedDbStoreInstances: MockIndexedDBStore[] = [];
let indexedDbStoreStartupError: Error | null = null;

class MockMemoryCryptoStore {
  startup = jest.fn(async () => undefined);
  deleteAllData = jest.fn(async () => undefined);
}

class MockIndexedDBStore {
  startup = jest.fn(async () => {
    if (indexedDbStoreStartupError) {
      throw indexedDbStoreStartupError;
    }
  });
  destroy = jest.fn(async () => undefined);
  on = jest.fn();

  constructor() {
    mockIndexedDbStoreInstances.push(this);
  }
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
  IndexedDBStore: MockIndexedDBStore,
}));

jest.mock('../../../lib/matrix/performanceMetrics', () => ({
  incrementMatrixPerfCounter: mockIncrementMatrixPerfCounter,
  timeMatrixPerf: mockTimeMatrixPerf,
}));

import { buildAuthedClient, resetAuthedClient } from '../helpers';

describe('buildAuthedClient', () => {
  const originalIndexedDb = global.indexedDB;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIndexedDbStoreInstances.length = 0;
    indexedDbStoreStartupError = null;
    resetAuthedClient();
    if (originalIndexedDb === undefined) {
      Object.defineProperty(global, 'indexedDB', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      return;
    }

    Object.defineProperty(global, 'indexedDB', {
      value: originalIndexedDb,
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    if (originalIndexedDb === undefined) {
      Object.defineProperty(global, 'indexedDB', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      return;
    }

    Object.defineProperty(global, 'indexedDB', {
      value: originalIndexedDb,
      configurable: true,
      writable: true,
    });
  });

  it('refreshes an expired stored session before starting sync', async () => {
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
    expect(mockTimeMatrixPerf).toHaveBeenCalledWith(
      'matrix.client.bootstrap',
      expect.any(Function),
      expect.objectContaining({
        userId: '@test:example',
        deviceId: 'DEV1',
      })
    );
    expect(refreshClient.refreshToken).toHaveBeenCalledWith('refresh-token');
    expect(authedClient.startClient).toHaveBeenCalled();
    expect(onPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'fresh-token',
        refreshToken: 'fresh-refresh',
      })
    );
  });

  it('falls back to the in-memory room store when the durable store fails to start', async () => {
    indexedDbStoreStartupError = new Error('store startup failed');
    Object.defineProperty(global, 'indexedDB', {
      value: {} as IDBFactory,
      configurable: true,
      writable: true,
    });

    const initialClient = {
      getUserId: jest.fn(() => '@test:example'),
      getDeviceId: jest.fn(() => 'DEV1'),
      stopClient: jest.fn(),
      initRustCrypto: jest.fn(async () => undefined),
      startClient: jest.fn(async () => undefined),
      setAccessToken: jest.fn(),
    };
    const fallbackClient = {
      getUserId: jest.fn(() => '@test:example'),
      getDeviceId: jest.fn(() => 'DEV1'),
      stopClient: jest.fn(),
      initRustCrypto: jest.fn(async () => undefined),
      startClient: jest.fn(async () => undefined),
      setAccessToken: jest.fn(),
    };

    mockCreateClient
      .mockReturnValueOnce(initialClient)
      .mockReturnValueOnce(fallbackClient);

    const client = await buildAuthedClient(
      {
        baseUrl: 'https://matrix.example',
        userId: '@test:example',
        deviceId: 'DEV1',
        accessToken: 'token',
      },
      jest.fn()
    );

    expect(client).toBe(fallbackClient);
    expect(mockIndexedDbStoreInstances).toHaveLength(1);
    expect(mockIndexedDbStoreInstances[0].startup).toHaveBeenCalled();
    expect(mockIndexedDbStoreInstances[0].destroy).toHaveBeenCalled();
    expect(mockIncrementMatrixPerfCounter).toHaveBeenCalledWith(
      'matrix.client.store_fallback',
      expect.objectContaining({
        userId: '@test:example',
        deviceId: 'DEV1',
        reason: 'indexeddb_store_startup_failed',
      })
    );
    expect(initialClient.stopClient).toHaveBeenCalled();
    const createClientCalls = mockCreateClient.mock.calls as Array<
      [{ store?: unknown }]
    >;
    const firstCreateCall = createClientCalls[0]?.[0];
    const secondCreateCall = createClientCalls[1]?.[0];
    expect(firstCreateCall?.store).toBe(mockIndexedDbStoreInstances[0]);
    expect(secondCreateCall?.store).toBeUndefined();
  });

  it('does not issue an extra joined-rooms validation request after startup', async () => {
    const authedClient = {
      getUserId: jest.fn(() => '@test:example'),
      getDeviceId: jest.fn(() => 'DEV1'),
      stopClient: jest.fn(),
      initRustCrypto: jest.fn(async () => undefined),
      startClient: jest.fn(async () => undefined),
      setAccessToken: jest.fn(),
      getJoinedRooms: jest.fn(async () => ({ joined_rooms: [] })),
    };

    mockCreateClient.mockReturnValueOnce(authedClient);

    const client = await buildAuthedClient(
      {
        baseUrl: 'https://matrix.example',
        userId: '@test:example',
        deviceId: 'DEV1',
        accessToken: 'token',
      },
      jest.fn()
    );

    expect(client).toBe(authedClient);
    expect(authedClient.startClient).toHaveBeenCalled();
    expect(authedClient.getJoinedRooms).not.toHaveBeenCalled();
  });
});
