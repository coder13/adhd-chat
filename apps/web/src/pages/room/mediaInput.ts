import type { ClipboardEvent } from 'react';

function buildFallbackImageName(file: File, now: () => number) {
  const mimeSubtype = file.type.split('/')[1]?.toLowerCase() || 'png';
  const extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
  return `pasted-image-${now()}.${extension}`;
}

export function normalizeImageFileName(
  file: File,
  now: () => number = Date.now
) {
  if (file.name.trim()) {
    return file;
  }

  return new File([file], buildFallbackImageName(file, now), {
    type: file.type || 'image/png',
    lastModified: file.lastModified || now(),
  });
}

export function getPastedImageFile(
  event: ClipboardEvent<HTMLIonTextareaElement>,
  now: () => number = Date.now
) {
  const clipboardData = event.clipboardData;
  if (!clipboardData) {
    return null;
  }

  const imageFileFromItems = Array.from(clipboardData.items ?? []).find(
    (item) => item.kind === 'file' && item.type.startsWith('image/')
  );
  const rawImageFile =
    imageFileFromItems?.getAsFile() ??
    Array.from(clipboardData.files ?? []).find((file) =>
      file.type.startsWith('image/')
    ) ??
    null;

  if (!rawImageFile) {
    return null;
  }

  return normalizeImageFileName(rawImageFile, now);
}
