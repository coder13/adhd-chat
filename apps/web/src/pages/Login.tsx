import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';
import { LoginCard } from '../components';

function Login() {
  const { loginWithSso, loginWithPassword, state, error, isReady } =
    useMatrixClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectPath = searchParams.get('redirect') ?? '/';

  const handleSsoLogin = useCallback(
    async (homeserver: string) => {
      await loginWithSso(homeserver, redirectPath);
    },
    [loginWithSso, redirectPath]
  );

  const handlePasswordLogin = useCallback(
    async (homeserver: string, username: string, password: string) => {
      await loginWithPassword(homeserver, username, password);
    },
    [loginWithPassword]
  );

  useEffect(() => {
    if (isReady) {
      navigate(redirectPath);
    }
  }, [isReady, navigate, redirectPath]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <LoginCard
        onLoginWithSso={handleSsoLogin}
        onLoginWithPassword={handlePasswordLogin}
        isLoading={state === 'redirecting' || state === 'authenticating'}
        error={error}
      />
    </div>
  );
}

export default Login;
