/// <reference types="jest" />

import { ensureRoomThreadsLoaded } from '../roomThreads';

describe('ensureRoomThreadsLoaded', () => {
  it('creates thread timeline sets before the initial thread fetch', async () => {
    const room = {
      threadsReady: false,
      threadsTimelineSets: [],
      createThreadsTimelineSets: jest.fn(async function createSets(this: {
        threadsTimelineSets: unknown[];
      }) {
        this.threadsTimelineSets = [{}, {}];
        return this.threadsTimelineSets;
      }),
      fetchRoomThreads: jest.fn(async () => undefined),
    };

    await ensureRoomThreadsLoaded(room as never);

    expect(room.createThreadsTimelineSets).toHaveBeenCalledTimes(1);
    expect(room.fetchRoomThreads).toHaveBeenCalledTimes(1);
  });

  it('recovers rooms that were marked ready before thread timeline sets existed', async () => {
    const room = {
      threadsReady: true,
      threadsTimelineSets: [],
      createThreadsTimelineSets: jest.fn(async function createSets(this: {
        threadsTimelineSets: unknown[];
      }) {
        this.threadsTimelineSets = [{}, {}];
        return this.threadsTimelineSets;
      }),
      fetchRoomThreads: jest.fn(async function fetchThreads(this: {
        threadsReady: boolean;
      }) {
        this.threadsReady = true;
      }),
    };

    await ensureRoomThreadsLoaded(room as never);

    expect(room.fetchRoomThreads).toHaveBeenCalledTimes(1);
    expect(room.threadsReady).toBe(true);
  });

  it('skips refetching when thread timelines were already initialized', async () => {
    const room = {
      threadsReady: true,
      threadsTimelineSets: [{}, {}],
      createThreadsTimelineSets: jest.fn(async function createSets(this: {
        threadsTimelineSets: unknown[];
      }) {
        return this.threadsTimelineSets;
      }),
      fetchRoomThreads: jest.fn(async () => undefined),
    };

    await ensureRoomThreadsLoaded(room as never);

    expect(room.fetchRoomThreads).not.toHaveBeenCalled();
  });
});
