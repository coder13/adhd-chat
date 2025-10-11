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
    <div>
      <h1>Authenticating...</h1>
      {state === 'authenticating' && <p>Processing login...</p>}
      {state === 'syncing' && <p>Syncing with server...</p>}
      {state === 'ready' && <p>Login successful! Redirecting...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}

export default AuthCallback;
