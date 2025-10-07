import { MatrixChatClient } from '../matrix-client';

// Mock the matrix-js-sdk module
jest.mock('matrix-js-sdk', () => ({
  createClient: jest.fn(() => ({
    login: jest.fn().mockResolvedValue({
      user_id: '@test:matrix.org',
      access_token: 'test_token',
    }),
    startClient: jest.fn().mockResolvedValue(undefined),
    stopClient: jest.fn(),
  })),
}));

describe('MatrixChatClient', () => {
  it('should create a client instance', () => {
    const client = new MatrixChatClient({
      baseUrl: 'https://matrix.org',
    });
    expect(client).toBeInstanceOf(MatrixChatClient);
  });

  it('should return null client before initialization', () => {
    const client = new MatrixChatClient({
      baseUrl: 'https://matrix.org',
    });
    expect(client.getClient()).toBeNull();
  });

  it('should initialize client', async () => {
    const client = new MatrixChatClient({
      baseUrl: 'https://matrix.org',
    });
    await client.initialize();
    expect(client.getClient()).not.toBeNull();
  });
});
