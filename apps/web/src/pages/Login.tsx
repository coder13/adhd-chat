import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { LoginCard } from '../components';

function Login() {
  const { loginWithSso, state, error } = useMatrixClient();
  const [searchParams] = useSearchParams();

  const handleLogin = useCallback(
    async (homeserver: string) => {
      await loginWithSso(homeserver, searchParams.get('redirect') ?? '/');
    },
    [loginWithSso, searchParams]
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
