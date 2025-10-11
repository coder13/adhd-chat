# E2E Encryption Features

This document describes the End-to-End Encryption features implemented in ADHD Chat.

## UI Preview

![E2E Encryption Demo](https://github.com/user-attachments/assets/9466d1c8-ea35-4a50-ad5a-3c7ffd3a8066)

The image above shows all the encryption UI components implemented in this feature.

## Features Implemented

### 1. Encryption Setup Modal
A multi-step modal flow that guides users through setting up E2E encryption:

**Step 1: Generate Key**
- Button to initiate key generation
- Calls `crypto.createRecoveryKeyFromPassphrase()` from matrix-js-sdk
- Sets up secret storage and cross-signing

**Step 2: Display Key**
- Shows the generated recovery key in a monospaced format
- Warning message about saving the key securely
- Copy to clipboard button for convenience
- User must acknowledge they've saved the key

**Step 3: Verify Key**
- User must re-enter the recovery key
- Validates that the entered key matches the generated one
- Prevents proceeding if keys don't match

**Step 4: Completion**
- Success message confirming encryption is set up
- Auto-closes after confirmation

### 2. Home Page Integration
Added a new "Encryption" section on the Home page with:
- Explanation of E2E encryption
- "Generate Encryption Key" button
- Opens the EncryptionSetupModal when clicked

### 3. Room-Level Encryption Controls
Updated the Room page to show:
- Encryption status indicator (Encrypted ✓ or Not encrypted)
- "Enable Encryption" button for non-encrypted rooms
- Warning that encryption cannot be disabled once enabled
- Sends `m.room.encryption` state event with `m.megolm.v1.aes-sha2` algorithm

## Technical Implementation

### Components Created

#### Modal.tsx
Reusable modal component with:
- Backdrop overlay
- Keyboard support (ESC to close)
- Size variants (sm, md, lg)
- Proper accessibility attributes

#### EncryptionSetupModal.tsx
Specialized modal for encryption setup:
- Multi-step wizard interface
- Form validation
- Error handling
- Loading states

### Hooks Updated

#### useMatrixClient.ts
- Modified `handleSetupEncryption()` to return the generated key
- Proper error handling with throw statements
- Sets up:
  - Secret storage via `bootstrapSecretStorage()`
  - Cross-signing via `bootstrapCrossSigning()`
  - Key backup via `resetKeyBackup()` if needed

### Pages Updated

#### Home.tsx
- Added encryption section with call-to-action
- Integrated EncryptionSetupModal
- Added state management for modal visibility

#### Room.tsx
- Check encryption status via `m.room.encryption` state event
- Display encryption status indicator
- Enable encryption button with loading state
- Send state event to enable encryption in room

## Usage Flow

### For Users Setting Up Encryption

1. Navigate to Home page after logging in
2. Click "Generate Encryption Key" button
3. Modal opens - click "Generate Encryption Key"
4. Copy and save the displayed recovery key securely
5. Click "I've Saved My Key"
6. Re-enter the recovery key to verify
7. Click "Verify Key"
8. See success message - encryption is now set up!

### For Users Enabling Room Encryption

1. Navigate to a room
2. Check the Encryption section
3. If not encrypted, click "Enable Encryption"
4. Room is now encrypted - all future messages will be encrypted

## Matrix SDK Integration

This implementation follows the matrix-js-sdk documentation for E2E encryption:

1. **Initialization**: `initRustCrypto()` is called during client setup
2. **Secret Storage**: Uses `bootstrapSecretStorage()` with recovery key
3. **Cross-Signing**: Uses `bootstrapCrossSigning()` for device verification
4. **Key Backup**: Automatically sets up key backup for recovery
5. **Room Encryption**: Sends `m.room.encryption` state event

## Security Considerations

- Recovery keys are generated using `createRecoveryKeyFromPassphrase()`
- Users are required to save and verify their recovery key
- Encryption cannot be disabled once enabled in a room
- Keys are stored in IndexedDB via the Rust crypto implementation
- Recovery keys are needed to decrypt messages on new devices

## Future Enhancements

Potential improvements could include:
- Device verification flow for new devices
- Key backup status indicator
- Encryption status in room list
- Cross-signing verification UI
- Session management and device list
