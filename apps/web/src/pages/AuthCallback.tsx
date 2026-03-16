import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { useMatrixClient } from '../hooks/useMatrixClient';
import {
  clearPostAuthRedirectPath,
  getPostAuthRedirectPath,
} from '../hooks/useMatrixClient/auth';
import { EXPIRED_SESSION_MESSAGE } from '../hooks/useMatrixClient/sessionErrors';

function AuthCallback() {
  const { completeSsoLogin, state, error, logout } = useMatrixClient();
  const navigate = useNavigate();
  const isExpiredSession = error === EXPIRED_SESSION_MESSAGE;

  useEffect(() => {
    const handleCallback = async () => {
      await completeSsoLogin();
    };

    if (window.location.search.includes('loginToken=')) {
      handleCallback();
    }
  }, [completeSsoLogin]);

  useEffect(() => {
    if (state === 'ready') {
      const redirectPath = getPostAuthRedirectPath();
      clearPostAuthRedirectPath();
      navigate(redirectPath);
    }
  }, [state, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Authenticating...
        </h1>
        {state === 'authenticating' && (
          <p className="text-gray-600">Processing login...</p>
        )}
        {state === 'syncing' && (
          <p className="text-gray-600">Syncing with server...</p>
        )}
        {state === 'ready' && (
          <p className="text-green-600 font-medium">
            Login successful! Redirecting...
          </p>
        )}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
            <div className="mt-3 flex justify-center">
              {isExpiredSession ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/login?redirect=${encodeURIComponent(
                        getPostAuthRedirectPath()
                      )}`
                    )
                  }
                >
                  Sign in again
                </Button>
              ) : (
                <Button variant="outline" onClick={logout}>
                  Log Out
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
