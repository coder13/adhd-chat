/// <reference types="jest" />

import { renderHook, waitFor } from '@testing-library/react';
import { useMatrixViewResource } from '../useMatrixViewResource';

describe('useMatrixViewResource', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not warn when no cache key is available', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const { result, rerender } = renderHook(
        ({ initialValue }) =>
          useMatrixViewResource({
            cacheKey: null,
            enabled: false,
            initialValue,
            load: jest.fn(async () => initialValue),
          }),
        {
          initialProps: {
            initialValue: [] as string[],
          },
        },
      );

      expect(result.current.data).toEqual([]);

      rerender({
        initialValue: [] as string[],
      });

      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('The result of getSnapshot should be cached')
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('does not warn when an enabled resource starts loading', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const load = jest.fn(async () => ['loaded']);

    try {
      const { result } = renderHook(() =>
        useMatrixViewResource({
          cacheKey: 'room-resource-startup',
          enabled: true,
          initialValue: [] as string[],
          load,
        })
      );

      await waitFor(() => {
        expect(load).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(['loaded']);
      });

      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('The result of getSnapshot should be cached')
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
