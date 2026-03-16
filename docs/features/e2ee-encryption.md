# End-to-End Encryption

## Overview

End-to-end encryption in ADHD Chat includes more than encrypted rooms. The app
coordinates recovery-key creation, secret storage access, cross-signing, key
backup, and self-verification.

## User-Facing Features

### Encryption Setup Modal

The encryption flow is exposed through `EncryptionSetupModal` and related
verification UI.

- Inspects the current account state first.
- Creates or unlocks encryption depending on what the account already has.
- Guides the user through recovery-key generation and confirmation.
- Supports device verification as part of setup completion.

### Room Encryption

- Rooms can be marked encrypted from the room page.
- Once enabled, room encryption is treated as a one-way operation.
- Encrypted room state is surfaced in the room header and room actions.

### Recovery and Verification

- Secret-storage keys can be requested on demand.
- Verification requests can be started against the user’s other devices.
- SAS / emoji verification is part of the current device trust flow.

## Implementation Map

- Client encryption state: `apps/web/src/hooks/useMatrixClient/useMatrixClientState.ts`
- Crypto helpers: `apps/web/src/hooks/useMatrixClient/crypto.ts`
- Interactive auth for secure crypto operations:
  `apps/web/src/hooks/useMatrixClient/uia.ts`
- Setup modal: `apps/web/src/components/EncryptionSetupModal.tsx`
- Verification UI: `apps/web/src/components/DeviceVerificationPanel.tsx`
- Secret-storage prompt: `apps/web/src/components/SecretStorageKeyModal.tsx`
- Room-level encryption action: `apps/web/src/pages/Room.tsx`

## Runtime Model

1. Build the authenticated Matrix client.
2. Initialize crypto before the app relies on encrypted state.
3. Load encryption diagnostics and setup info when needed.
4. Prompt for secrets or interactive auth only when the homeserver requires it.
5. Persist enough session state for later recovery and verification.

## Security Notes

- Recovery keys must be saved by the user.
- Encryption setup may require browser-based or password-based interactive auth.
- Device verification is part of a usable encrypted account, not an optional
  extra.

## Related Topics

- [Authentication](./authentication.md)
- [Chat Experience](./chat-experience.md)
