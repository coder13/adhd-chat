import type { TimelineMessage } from '../../lib/matrix/chatCatalog';

export type RoomMessage = TimelineMessage;

export type ComposerMode =
  | { type: 'reply' | 'edit'; message: RoomMessage }
  | null;

export type QueuedImage = {
  file: File;
  previewUrl: string;
} | null;
