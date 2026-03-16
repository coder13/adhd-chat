import type { RoomSnapshot } from '../../lib/matrix/roomSnapshot';

export type RoomMessage = RoomSnapshot['messages'][number];

export type ComposerMode =
  | { type: 'reply' | 'edit'; message: RoomMessage }
  | null;

export type QueuedImage = {
  file: File;
  previewUrl: string;
} | null;
