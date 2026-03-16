export const EXPIRED_SESSION_MESSAGE =
  'Your Matrix session expired. Sign in again to keep chatting.';

type MatrixLikeError = {
  errcode?: string;
  data?: {
    errcode?: string;
    error?: string;
  };
  error?: string;
  message?: string;
  httpStatus?: number;
  statusCode?: number;
};

function getErrorMessage(error: MatrixLikeError) {
  return [error.message, error.error, error.data?.error]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

export function isInactiveMatrixSessionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as MatrixLikeError;
  const errcode = candidate.errcode ?? candidate.data?.errcode ?? null;
  const statusCode = candidate.httpStatus ?? candidate.statusCode ?? null;
  const message = getErrorMessage(candidate).toLowerCase();

  const looksLikeInactiveTokenMessage =
    message.includes('token is not active') ||
    message.includes('unknown token') ||
    message.includes('access token has expired') ||
    message.includes('matrixerror: [401]') ||
    message.includes('m_unknown_token');

  return Boolean(
    errcode === 'M_UNKNOWN_TOKEN' ||
      (statusCode === 401 && looksLikeInactiveTokenMessage) ||
      looksLikeInactiveTokenMessage
  );
}

export function getAuthFailureMessage(error: unknown) {
  if (isInactiveMatrixSessionError(error)) {
    return EXPIRED_SESSION_MESSAGE;
  }

  return error instanceof Error ? error.message : String(error);
}
