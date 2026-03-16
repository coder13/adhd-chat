# Authentication

## Overview

The web client supports Matrix account registration, login, persisted sessions,
and browser callback handling for delegated or SSO-style flows.

## User Flows

### Login and Registration

- `/login` renders the main sign-in flow.
- `/register` creates a new account and links back into login when needed.
- Redirect targets are preserved through query parameters so users return to the
  page they were trying to reach.

### Auth Callback

- `/auth/callback` completes browser-based auth flows.
- The callback route restores the Matrix session and redirects back into the app
  shell.

### Interactive Authentication

- Some secure operations require extra confirmation from the homeserver.
- The app supports password-based interactive auth and browser-based
  continuation flows when the server asks for them.

## Implementation Map

- App routes: `apps/web/src/App.tsx`
- Session lifecycle: `apps/web/src/hooks/useMatrixClient/useMatrixClientState.ts`
- Auth helpers: `apps/web/src/hooks/useMatrixClient/auth.ts`
- Interactive auth helpers: `apps/web/src/hooks/useMatrixClient/uia.ts`
- Callback page: `apps/web/src/pages/AuthCallback.tsx`
- Login and register pages: `apps/web/src/pages/Login.tsx`,
  `apps/web/src/pages/Register.tsx`

## Session Bootstrap

The app keeps client startup centralized instead of scattering Matrix client
creation across pages.

Typical flow:

1. Load or establish a Matrix session.
2. Build the authenticated Matrix client.
3. Initialize crypto state for the session.
4. Start sync and expose the client through the provider.

## Notes

- Authentication concerns are intentionally separated from room UI.
- Browser-based auth still ends in a normal Matrix session for the running
  client.
- Secure follow-up actions such as encryption setup may trigger additional
  interactive auth.
