import { MatrixError, type MatrixClient } from 'matrix-js-sdk';
import type { UIAFlow } from 'matrix-js-sdk/lib/interactive-auth';
import {
  requestBrowserInteractiveAuth,
  requestInteractiveAuthPassword,
} from './helpers';

type InteractiveAuthParams = Record<string, { url?: string }>;

function getInteractiveAuthSession(error: MatrixError) {
  const data = error.data;
  if (data && typeof data === 'object' && 'session' in data) {
    return typeof data.session === 'string' ? data.session : undefined;
  }

  return undefined;
}

function getInteractiveAuthFlows(error: MatrixError): UIAFlow[] {
  const data = error.data;
  if (data && typeof data === 'object' && 'flows' in data) {
    return Array.isArray(data.flows) ? (data.flows as UIAFlow[]) : [];
  }

  return [];
}

function getInteractiveAuthParams(error: MatrixError): InteractiveAuthParams {
  const data = error.data;
  if (data && typeof data === 'object' && 'params' in data) {
    return data.params && typeof data.params === 'object'
      ? (data.params as InteractiveAuthParams)
      : {};
  }

  return {};
}

export async function performInteractiveAuth(
  client: MatrixClient,
  userId: string,
  makeRequest: (authData: Record<string, unknown> | null) => Promise<unknown>
) {
  try {
    await makeRequest(null);
    return;
  } catch (error) {
    if (!(error instanceof MatrixError) || error.httpStatus !== 401) {
      throw error;
    }

    const session = getInteractiveAuthSession(error);
    const flows = getInteractiveAuthFlows(error);
    const params = getInteractiveAuthParams(error);
    const stages = flows.flatMap((flow) =>
      Array.isArray(flow?.stages) ? flow.stages : []
    );

    if (stages.includes('m.login.dummy')) {
      await makeRequest({
        type: 'm.login.dummy',
        ...(session ? { session } : {}),
      });
      return;
    }

    if (stages.includes('m.login.password')) {
      const password = await requestInteractiveAuthPassword();
      await makeRequest({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId,
        },
        password,
        ...(session ? { session } : {}),
      });
      return;
    }

    if (stages.includes('m.login.sso')) {
      if (!session) {
        throw new Error(
          'Homeserver requested SSO interactive authentication without a session id.'
        );
      }

      const url = `${client.getHomeserverUrl()}/_matrix/client/v3/auth/m.login.sso/fallback/web?session=${encodeURIComponent(
        session
      )}`;

      await requestBrowserInteractiveAuth({
        title: 'Complete SSO Authentication',
        description:
          'Your homeserver requires browser-based single sign-on before encryption can be set up.',
        url,
      });

      await makeRequest({ session });
      return;
    }

    if (stages.includes('m.login.oauth') || stages.includes('m.oauth')) {
      const oauthParams = params['m.login.oauth'] ?? params['m.oauth'];
      if (!oauthParams?.url) {
        throw new Error(
          'Homeserver requested OAuth interactive authentication without a continuation URL.'
        );
      }

      await requestBrowserInteractiveAuth({
        title: 'Complete OAuth Authentication',
        description:
          'Your homeserver requires browser-based OAuth confirmation before encryption can be set up.',
        url: oauthParams.url,
      });

      await makeRequest(session ? { session } : null);
      return;
    }

    throw new Error(
      `Unsupported interactive authentication stages for encryption setup: ${
        stages.join(', ') || 'unknown'
      }`
    );
  }
}
