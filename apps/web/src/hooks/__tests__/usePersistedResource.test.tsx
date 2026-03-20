/// <reference types="jest" />

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  clearPersistedValueAsync,
  hasPersistedValue,
  loadPersistedValueAsync,
  peekPersistedValue,
  savePersistedValueAsync,
} from '../../lib/asyncPersistence';
import { loadPersistedValue } from '../../lib/persistence';
import { usePersistedResource } from '../usePersistedResource';

jest.mock('../../lib/asyncPersistence', () => ({
  clearPersistedValueAsync: jest.fn(async () => undefined),
  hasPersistedValue: jest.fn(() => false),
  loadPersistedValueAsync: jest.fn(async () => null),
  peekPersistedValue: jest.fn(() => null),
  savePersistedValueAsync: jest.fn(async () => undefined),
}));

describe('usePersistedResource', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('deduplicates concurrent refresh calls for the same cache key', async () => {
    let resolveLoad: ((value: string[]) => void) | null = null;
    const load = jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          resolveLoad = resolve;
        })
    );

    const firstHook = renderHook(() =>
      usePersistedResource({
        cacheKey: 'shared-resource',
        enabled: true,
        initialValue: [] as string[],
        load,
      })
    );
    const secondHook = renderHook(() =>
      usePersistedResource({
        cacheKey: 'shared-resource',
        enabled: true,
        initialValue: [] as string[],
        load,
      })
    );

    await act(async () => {
      firstHook.result.current.refresh();
      secondHook.result.current.refresh();
    });

    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad?.(['done']);
    });

    await waitFor(() => {
      expect(firstHook.result.current.data).toEqual(['done']);
      expect(secondHook.result.current.data).toEqual(['done']);
    });
  });

  it('updates cached data immediately without going through refresh', () => {
    const { result } = renderHook(() =>
      usePersistedResource({
        cacheKey: 'shared-resource',
        enabled: false,
        initialValue: [] as string[],
        load: jest.fn(async () => [] as string[]),
      })
    );

    act(() => {
      result.current.updateData(['patched']);
    });

    expect(result.current.data).toEqual(['patched']);
    expect(loadPersistedValue('shared-resource')).toEqual(['patched']);
  });

  it('resets synchronously to the next localStorage cache key value on rerender', () => {
    window.localStorage.setItem(
      'adhd-chat.cache.v1:chat-pref:user-a',
      JSON.stringify({
        updatedAt: Date.now(),
        value: { chatViewMode: 'bubbles' },
      })
    );

    const { result, rerender } = renderHook(
      ({ cacheKey, enabled }: { cacheKey: string | null; enabled: boolean }) =>
        usePersistedResource({
          cacheKey,
          enabled,
          initialValue: { chatViewMode: 'timeline' },
          load: jest.fn(async () => ({ chatViewMode: 'timeline' })),
        }),
      {
        initialProps: {
          cacheKey: null as string | null,
          enabled: false,
        },
      }
    );

    expect(result.current.data).toEqual({ chatViewMode: 'timeline' });
    expect(result.current.hasCachedData).toBe(false);

    rerender({
      cacheKey: 'chat-pref:user-a',
      enabled: true,
    });

    expect(result.current.data).toEqual({ chatViewMode: 'bubbles' });
    expect(result.current.hasCachedData).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('hydrates indexeddb-backed cached data before applying the live refresh', async () => {
    let resolveCached: ((value: string[] | null) => void) | null = null;
    let resolveLoad: ((value: string[]) => void) | null = null;
    (hasPersistedValue as jest.Mock).mockReturnValue(true);
    (peekPersistedValue as jest.Mock).mockReturnValue(null);
    (loadPersistedValueAsync as jest.Mock).mockImplementation(
      () =>
        new Promise<string[] | null>((resolve) => {
          resolveCached = resolve;
        })
    );

    const load = jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          resolveLoad = resolve;
        })
    );

    const { result } = renderHook(() =>
      usePersistedResource({
        cacheKey: 'shared-resource',
        enabled: true,
        initialValue: [] as string[],
        load,
        storage: 'indexeddb',
      })
    );

    await act(async () => {
      resolveCached?.(['cached']);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(['cached']);
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad?.(['live']);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(['live']);
    });
    expect(savePersistedValueAsync).toHaveBeenCalledWith(
      'shared-resource',
      ['live'],
      { bucket: 'resources' }
    );
  });

  it('writes indexeddb-backed updates and clears asynchronously', () => {
    const { result } = renderHook(() =>
      usePersistedResource({
        cacheKey: 'shared-resource',
        enabled: false,
        initialValue: [] as string[],
        load: jest.fn(async () => [] as string[]),
        storage: 'indexeddb',
      })
    );

    act(() => {
      result.current.updateData(['patched']);
    });
    expect(savePersistedValueAsync).toHaveBeenCalledWith(
      'shared-resource',
      ['patched'],
      { bucket: 'resources' }
    );

    act(() => {
      result.current.clear();
    });
    expect(clearPersistedValueAsync).toHaveBeenCalledWith('shared-resource', {
      bucket: 'resources',
    });
  });

  it('passes a custom indexeddb bucket through persistence operations', () => {
    const { result } = renderHook(() =>
      usePersistedResource({
        cacheKey: 'draft-key',
        enabled: false,
        initialValue: '',
        load: jest.fn(async () => ''),
        storage: 'indexeddb',
        bucket: 'drafts',
      })
    );

    act(() => {
      result.current.updateData('draft');
    });

    expect(savePersistedValueAsync).toHaveBeenCalledWith('draft-key', 'draft', {
      bucket: 'drafts',
    });
  });
});
