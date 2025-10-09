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
