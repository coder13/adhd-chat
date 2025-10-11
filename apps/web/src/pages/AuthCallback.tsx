import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';

function AuthCallback() {
  const { completeSsoLogin, state, error } = useMatrixClient();
  const navigate = useNavigate();

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
      // Redirect to home after successful login
      navigate('/');
    }
  }, [state, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Authenticating...</h1>
        {state === 'authenticating' && (
          <p className="text-gray-600">Processing login...</p>
        )}
        {state === 'syncing' && <p className="text-gray-600">Syncing with server...</p>}
        {state === 'ready' && (
          <p className="text-green-600 font-medium">Login successful! Redirecting...</p>
        )}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
