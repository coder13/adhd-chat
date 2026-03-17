/// <reference types="jest" />

import { act, renderHook, waitFor } from '@testing-library/react';
import { usePersistedResource } from '../usePersistedResource';

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
});
