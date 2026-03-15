# React Matrix authentication

This page explains how Element Web implements authentication in a way that can be reused in another React client.

The main split is:

- legacy Matrix login via `/_matrix/client/*/login`
- delegated authentication via OIDC

Element keeps both paths available, but it prefers OIDC whenever the homeserver advertises delegated auth.

## Relevant files in this repo

- `apps/web/src/Login.ts`
- `apps/web/src/Lifecycle.ts`
- `apps/web/src/utils/ValidatedServerConfig.ts`
- `apps/web/src/utils/oidc/authorize.ts`
- `apps/web/src/utils/oidc/persistOidcSettings.ts`
- `apps/web/src/stores/oidc/OidcClientStore.ts`
- `docs/oidc.md`

## Recommended architecture for another React app

Keep auth split into four layers:

1. `serverDiscovery`
   Resolves the homeserver URL, identity server URL, and delegated auth metadata.
2. `loginService`
   Decides whether to use Matrix login APIs or OIDC.
3. `sessionStore`
   Persists Matrix credentials and OIDC metadata.
4. `matrixClientProvider`
   Creates the `MatrixClient`, initializes crypto, and exposes it through React context.

Do not mix these concerns into a single login component. Element does not. The implementation is easier to reason about if discovery, login, callback handling, and client startup are separate.

## Flow selection

Element's `Login.getFlows()` does this:

1. Check whether delegated auth metadata was discovered.
2. If yes, try to prepare an OIDC-native flow first.
3. If not, or if OIDC setup fails, fetch normal Matrix `/login` flows.
4. If the homeserver exposes the delegated-auth compatibility SSO flow, only show that flow.

For a React app, model this explicitly:

```ts
type AuthMode = "oidc" | "matrix";
```

Then expose one resolved auth mode from discovery rather than letting multiple screens guess.

## Discovery

The server config used by Element includes:

- `hsUrl`
- `isUrl`
- `delegatedAuthentication?: OidcClientConfig`

The important rule is:

- if delegated auth is present and valid, prefer OIDC
- otherwise use regular Matrix login

In a new app, do discovery before rendering the actual login form. That avoids rendering password UI for a server that only wants delegated auth.

## OIDC login flow

Element starts OIDC from `apps/web/src/utils/oidc/authorize.ts`.

The important steps are:

1. Get or register an OIDC client ID for the issuer.
2. Build the redirect URI from the current platform.
3. Generate the authorization URL through the Matrix JS SDK helper.
4. Redirect the browser to the issuer.
5. On the callback route, exchange `code` and `state` for tokens.
6. Call `whoami` with the returned access token to learn `user_id` and `device_id`.
7. Persist both Matrix session data and OIDC metadata.

Element persists these OIDC fields after successful auth:

- OIDC `client_id`
- token `issuer`
- `id_token`

That data is later used by `OidcClientStore` for account management and token revocation.

## React callback route

Your React app should have a dedicated callback page such as `/auth/callback`.

The callback page should:

1. Read `code` and `state` from the URL.
2. Complete the authorization code grant.
3. Convert the returned token into Matrix session credentials.
4. Persist the session.
5. Redirect into the authenticated app shell.

Sketch:

```ts
export async function completeOidcCallback(query: URLSearchParams) {
    const result = await completeOidcLogin({
        code: query.get("code"),
        state: query.get("state"),
    });

    const whoamiClient = createClient({
        baseUrl: result.homeserverUrl,
        accessToken: result.accessToken,
        idBaseUrl: result.identityServerUrl,
    });

    const whoami = await whoamiClient.whoami();

    persistMatrixSession({
        homeserverUrl: result.homeserverUrl,
        identityServerUrl: result.identityServerUrl,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: whoami.user_id,
        deviceId: whoami.device_id,
    });

    persistOidcAuthenticatedSettings(result.clientId, result.issuer, result.idToken);
}
```

The key point is that OIDC does not replace the Matrix client session. You still need Matrix credentials that can be used to create `MatrixClient`.

## Legacy Matrix login

For password login, Element still uses standard Matrix login requests and stores:

- `accessToken`
- `userId`
- `deviceId`
- `homeserverUrl`
- `identityServerUrl`
- optional `refreshToken`

If your other app only targets modern delegated-auth homeservers, you can omit the password path. If it must work against general Matrix servers, keep both.

## Session bootstrap in React

After login succeeds, the next step is not "render the app". The next step is "create a working Matrix client".

Element's startup sequence is roughly:

1. Create a `MatrixClient` with the stored credentials.
2. Start the storage layer.
3. Initialize Rust crypto.
4. Attach crypto callbacks.
5. Start the client sync loop.

This should live in one place, usually a provider or boot hook.

Sketch:

```ts
export async function buildMatrixClient(session: Session) {
    const client = createClient({
        baseUrl: session.homeserverUrl,
        idBaseUrl: session.identityServerUrl,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        userId: session.userId,
        deviceId: session.deviceId,
        cryptoCallbacks: crossSigningCallbacks,
    });

    await client.store.startup();
    await client.initRustCrypto();
    await client.startClient({
        lazyLoadMembers: true,
        pendingEventOrdering: PendingEventOrdering.Detached,
    });

    return client;
}
```

In practice you should also provide encrypted storage for the crypto store rather than calling `initRustCrypto()` with no storage key.

## OIDC-aware post-login behavior

Element has an `OidcClientStore` for authenticated sessions. It is not the login entry point. It is post-login support for:

- determining whether the user authenticated with OIDC
- discovering account management URLs
- revoking tokens during logout

This is a good pattern to copy. Keep login-time OIDC code separate from session-time OIDC utilities.

## Logout

If the user logged in with OIDC, logout should do more than clear local state:

1. try to revoke refresh and access tokens
2. clear persisted OIDC metadata
3. clear the Matrix session
4. redirect appropriately

If the user logged in through plain Matrix auth, local logout is usually enough.

## Recommended React shape

For the other project, a minimal structure would be:

- `src/auth/discovery.ts`
- `src/auth/loginService.ts`
- `src/auth/oidc.ts`
- `src/auth/sessionStore.ts`
- `src/matrix/createMatrixClient.ts`
- `src/matrix/MatrixClientProvider.tsx`
- `src/routes/AuthCallbackPage.tsx`

That keeps the app-level auth and the Matrix client lifecycle separate, which matters once encryption and token refresh are added.

## Implementation checklist

- Discover homeserver config before rendering login UI.
- Prefer delegated OIDC when the server advertises it.
- Use a dedicated callback route for `code` and `state`.
- Persist both Matrix session credentials and OIDC metadata.
- Create the Matrix client in one centralized bootstrap path.
- Initialize crypto before `startClient()`.
- Revoke OIDC tokens on logout when available.

## Common mistakes

- Treating OIDC tokens as if they were enough by themselves. You still need a usable Matrix session.
- Rendering password login before delegated-auth discovery completes.
- Creating the Matrix client in arbitrary components instead of a single provider.
- Skipping `whoami` after OIDC login and therefore not learning the real `user_id` and `device_id`.
- Mixing login logic and post-login account-management logic into one class.
