export type MatrixSession = {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type AuthState =
  | 'idle'
  | 'redirecting'
  | 'authenticating'
  | 'syncing'
  | 'ready'
  | 'error'
  | 'logged_out';

export type VerificationEmoji = {
  symbol: string;
  name: string;
};

export type EncryptionRestoreState =
  | {
      status: 'idle';
    }
  | {
      status: 'restoring' | 'restored' | 'error';
      message: string;
    };

export type DeviceVerificationState =
  | {
      status: 'idle';
    }
  | {
      status:
        | 'requesting'
        | 'waiting'
        | 'ready'
        | 'starting_sas'
        | 'showing_sas'
        | 'confirming'
        | 'done'
        | 'cancelled'
        | 'error';
      transactionId?: string;
      otherDeviceId?: string;
      decimals?: [number, number, number];
      emojis?: VerificationEmoji[];
      error?: string;
    };
