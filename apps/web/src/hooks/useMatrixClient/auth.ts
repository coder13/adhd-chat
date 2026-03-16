import type { MatrixSession } from './types';
import { createId } from '../../lib/id';
import {
  createUnauthedClient,
  exchangeLoginToken,
  loadSession,
} from './helpers';

export const REDIRECT_KEY = 'matrix.redirect.baseUrl';
export const RETURN_PATH_KEY = 'matrix.redirect.returnPath';

export function startSsoRedirect(baseUrl: string, returnPath = '/') {
  sessionStorage.setItem(REDIRECT_KEY, baseUrl);
  sessionStorage.setItem(RETURN_PATH_KEY, returnPath);

  const unauthenticatedClient = createUnauthedClient(baseUrl);
  const redirectUri = `${window.location.origin}/auth/callback`;
  const ssoUrl = unauthenticatedClient.getSsoLoginUrl(redirectUri);
  window.location.assign(ssoUrl);
}

export async function completeSsoCallback(): Promise<MatrixSession> {
  const url = new URL(window.location.href);
  const loginToken = url.searchParams.get('loginToken');
  if (!loginToken) {
    throw new Error('Missing login token in callback URL.');
  }

  const baseUrl =
    sessionStorage.getItem(REDIRECT_KEY) ?? window.location.origin;
  const existingSession = loadSession();
  const deviceId = existingSession?.deviceId ?? createId('device');

  return exchangeLoginToken(baseUrl, loginToken, deviceId);
}

export function clearSsoCallbackUrl() {
  const url = new URL(window.location.href);

  try {
    url.searchParams.delete('loginToken');
    window.history.replaceState({}, document.title, url.toString());
  } catch (cause) {
    console.error(cause);
  }

  sessionStorage.removeItem(REDIRECT_KEY);
}

export function getPostAuthRedirectPath() {
  return sessionStorage.getItem(RETURN_PATH_KEY) ?? '/';
}

export function clearPostAuthRedirectPath() {
  sessionStorage.removeItem(RETURN_PATH_KEY);
}
