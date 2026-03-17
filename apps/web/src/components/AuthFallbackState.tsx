import type { ReactNode } from 'react';
import type { AuthState } from '../hooks/useMatrixClient/types';

interface AuthFallbackStateProps {
  state: AuthState;
  restoringTitle?: string;
  restoringMessage?: string;
  signedOutTitle?: string;
  signedOutMessage: ReactNode;
  signedOutActions?: ReactNode;
}

function AuthFallbackState({
  state,
  restoringTitle = 'Restoring your session',
  restoringMessage = 'Reconnecting to your Tandem space so your chats and hubs are ready.',
  signedOutTitle = 'Sign in to continue',
  signedOutMessage,
  signedOutActions,
}: AuthFallbackStateProps) {
  const isRestoring =
    state === 'idle' ||
    state === 'redirecting' ||
    state === 'authenticating' ||
    state === 'syncing';

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold text-text">
          {isRestoring ? restoringTitle : signedOutTitle}
        </h1>
        <div className="mt-3 text-sm leading-6 text-text-muted">
          {isRestoring ? restoringMessage : signedOutMessage}
        </div>
        {!isRestoring && signedOutActions ? (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {signedOutActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AuthFallbackState;
