/// <reference types="jest" />

import type { ClipboardEvent } from 'react';
import {
  getPastedImageFile,
  normalizeImageFileName,
} from '../mediaInput';

describe('room media input helpers', () => {
  it('keeps the original image file name when one exists', () => {
    const file = new File(['image'], 'screenshot.png', { type: 'image/png' });

    expect(normalizeImageFileName(file)).toBe(file);
  });

  it('assigns a stable fallback name to unnamed pasted images', () => {
    const unnamedFile = new File(['image'], '', { type: 'image/jpeg' });

    const result = normalizeImageFileName(unnamedFile, () => 12345);

    expect(result.name).toBe('pasted-image-12345.jpg');
    expect(result.type).toBe('image/jpeg');
  });

  it('extracts the first pasted image from clipboard items', () => {
    const file = new File(['image'], '', { type: 'image/png' });
    const event = {
      clipboardData: {
        items: [
          {
            kind: 'string',
            type: 'text/plain',
            getAsFile: () => null,
          },
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        files: [],
      },
    } as unknown as ClipboardEvent<HTMLIonTextareaElement>;

    const result = getPastedImageFile(event, () => 77);

    expect(result?.name).toBe('pasted-image-77.png');
  });

  it('returns null when the clipboard does not contain an image', () => {
    const event = {
      clipboardData: {
        items: [
          {
            kind: 'string',
            type: 'text/plain',
            getAsFile: () => null,
          },
        ],
        files: [],
      },
    } as unknown as ClipboardEvent<HTMLIonTextareaElement>;

    expect(getPastedImageFile(event)).toBeNull();
  });
});
