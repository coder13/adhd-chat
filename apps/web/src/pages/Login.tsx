import { useCallback } from 'react';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { LoginCard } from '../components';

function Login() {
  const { loginWithSso, state, error } = useMatrixClient();

  const handleLogin = useCallback(
    async (homeserver: string) => {
      await loginWithSso(homeserver);
    },
    [loginWithSso]
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginCard
        onLogin={handleLogin}
        isLoading={state === 'redirecting' || state === 'authenticating'}
        error={error}
      />
    </div>
  );
}

export default Login;
