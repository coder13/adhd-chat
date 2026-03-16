import { VerificationPhase, type ShowSasCallbacks, type VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/verification';
import type {
  DeviceVerificationState,
  VerificationEmoji,
} from './types';

export function toVerificationEmojis(
  emojis: [string, string][] | undefined
): VerificationEmoji[] | undefined {
  return emojis?.map(([symbol, name]) => ({ symbol, name }));
}

export function getDeviceVerificationState(
  request: VerificationRequest | null,
  sasCallbacks: ShowSasCallbacks | null
): DeviceVerificationState {
  if (!request) {
    return { status: 'idle' };
  }

  const baseState = {
    transactionId: request.transactionId,
    otherDeviceId: request.otherDeviceId,
  };

  if (sasCallbacks) {
    return {
      status: 'showing_sas',
      ...baseState,
      decimals: sasCallbacks.sas.decimal,
      emojis: toVerificationEmojis(sasCallbacks.sas.emoji),
    };
  }

  switch (request.phase) {
    case VerificationPhase.Requested:
      return { status: 'waiting', ...baseState };
    case VerificationPhase.Ready:
      return { status: 'ready', ...baseState };
    case VerificationPhase.Started:
      return { status: 'starting_sas', ...baseState };
    case VerificationPhase.Done:
      return { status: 'done', ...baseState };
    case VerificationPhase.Cancelled:
      return {
        status: 'cancelled',
        ...baseState,
        error: 'Verification was cancelled.',
      };
    default:
      return { status: 'requesting', ...baseState };
  }
}
