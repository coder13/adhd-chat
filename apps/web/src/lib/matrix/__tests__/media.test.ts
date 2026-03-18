/// <reference types="jest" />

jest.mock('matrix-js-sdk', () => ({
  MsgType: {
    Image: 'm.image',
    File: 'm.file',
  },
}));

import { buildMatrixMediaPayload } from '../media';

describe('buildMatrixMediaPayload', () => {
  const originalCreateObjectUrl = URL.createObjectURL?.bind(URL);
  const originalRevokeObjectUrl = URL.revokeObjectURL?.bind(URL);
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
    URL.createObjectURL = originalCreateObjectUrl ?? jest.fn();
    URL.revokeObjectURL = originalRevokeObjectUrl ?? jest.fn();
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

    expect(payload.msgtype).toBe('m.image');
    expect(payload.body).toBe('Look at this');
    expect(payload.filename).toBe('photo.png');
    expect(payload.url).toBe('mxc://example.org/image');
    expect(payload.info?.w).toBe(1200);
    expect(payload.info?.h).toBe(800);
  });
});
