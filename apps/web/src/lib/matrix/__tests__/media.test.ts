/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Image: 'm.image',
    File: 'm.file',
  },
}));

import { buildMatrixMediaPayload } from '../media';

describe('buildMatrixMediaPayload', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalImage = globalThis.Image;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:dimension-probe') as never;
    URL.revokeObjectURL = jest.fn();

    class MockImage {
      naturalWidth = 1200;
      naturalHeight = 800;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    globalThis.Image = MockImage as never;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    globalThis.Image = originalImage;
  });

  it('stores image captions in body and preserves the original filename', async () => {
    const client = {
      uploadContent: jest.fn(async () => ({
        content_uri: 'mxc://example.org/image',
      })),
    };
    const file = new File(['image'], 'photo.png', { type: 'image/png' });

    const payload = await buildMatrixMediaPayload(client as never, file, {
      caption: 'Look at this',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        msgtype: 'm.image',
        body: 'Look at this',
        filename: 'photo.png',
        url: 'mxc://example.org/image',
        info: expect.objectContaining({
          w: 1200,
          h: 800,
        }),
      })
    );
  });
});
