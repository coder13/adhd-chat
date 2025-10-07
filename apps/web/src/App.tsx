import { useState, useEffect } from 'react';
import { MatrixChatClient } from '@adhd-chat/core';

type LoginMethod = 'password' | 'oidc';

function App() {
  const [homeserver, setHomeserver] = useState('https://matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [oidcIssuer, setOidcIssuer] = useState('');
  const [oidcClientId, setOidcClientId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [status, setStatus] = useState('');
  const [matrixClient, setMatrixClient] = useState<MatrixChatClient | null>(
    null
  );

  // Check if we're returning from OIDC redirect
  useEffect(() => {
    const checkOIDCCallback = async () => {
      if (window.location.search.includes('code=') && matrixClient) {
        setStatus('Completing OIDC login...');
        try {
          await matrixClient.completeOIDCLogin();
          setIsLoggedIn(true);
          setStatus('Logged in successfully with OIDC!');
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          setStatus(`OIDC login failed: ${error}`);
          setIsLoggedIn(false);
        }
      }
    };
    checkOIDCCallback();
  }, [matrixClient]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Logging in...');

    try {
      const client = new MatrixChatClient({
        baseUrl: homeserver,
      });
      await client.initialize();
      await client.login(username, password);

      setMatrixClient(client);
      setIsLoggedIn(true);
      setStatus('Logged in successfully!');
    } catch (error) {
      setStatus(`Login failed: ${error}`);
      setIsLoggedIn(false);
    }
  };

  const handleOIDCLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Redirecting to OIDC provider...');

    try {
      const client = new MatrixChatClient({
        baseUrl: homeserver,
      });
      await client.initialize();

      const redirectUri = window.location.origin + window.location.pathname;

      await client.loginWithOIDC({
        issuer: oidcIssuer,
        clientId: oidcClientId,
        redirectUri,
        scope: 'openid urn:matrix:org.matrix.msc2967.client:api:*',
      });

      setMatrixClient(client);
      // User will be redirected, so no need to update status
    } catch (error) {
      setStatus(`OIDC login failed: ${error}`);
      setIsLoggedIn(false);
    }
  };

  return (
    <>
      <h1>ADHD Chat</h1>
      <div>
        <h2>Matrix Login</h2>
        {!isLoggedIn ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <label>
                <input
                  type="radio"
                  name="loginMethod"
                  value="password"
                  checked={loginMethod === 'password'}
                  onChange={(e) =>
                    setLoginMethod(e.target.value as LoginMethod)
                  }
                />
                {' '}Password Login
              </label>
              {' '}
              <label>
                <input
                  type="radio"
                  name="loginMethod"
                  value="oidc"
                  checked={loginMethod === 'oidc'}
                  onChange={(e) =>
                    setLoginMethod(e.target.value as LoginMethod)
                  }
                />
                {' '}OIDC Login
              </label>
            </div>

            {loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin}>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="homeserver">
                    Homeserver URL:
                    <input
                      id="homeserver"
                      type="text"
                      value={homeserver}
                      onChange={(e) => setHomeserver(e.target.value)}
                      style={{ marginLeft: '10px', width: '300px' }}
                      required
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="username">
                    Username:
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={{ marginLeft: '10px', width: '300px' }}
                      required
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="password">
                    Password:
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ marginLeft: '10px', width: '300px' }}
                      required
                    />
                  </label>
                </div>
                <button type="submit">Login with Password</button>
              </form>
            ) : (
              <form onSubmit={handleOIDCLogin}>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="homeserver-oidc">
                    Homeserver URL:
                    <input
                      id="homeserver-oidc"
                      type="text"
                      value={homeserver}
                      onChange={(e) => setHomeserver(e.target.value)}
                      style={{ marginLeft: '10px', width: '300px' }}
                      required
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="oidc-issuer">
                    OIDC Issuer URL:
                    <input
                      id="oidc-issuer"
                      type="text"
                      value={oidcIssuer}
                      onChange={(e) => setOidcIssuer(e.target.value)}
                      style={{ marginLeft: '10px', width: '300px' }}
                      placeholder="https://accounts.example.com"
                      required
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="oidc-client-id">
                    Client ID:
                    <input
                      id="oidc-client-id"
                      type="text"
                      value={oidcClientId}
                      onChange={(e) => setOidcClientId(e.target.value)}
                      style={{ marginLeft: '10px', width: '300px' }}
                      placeholder="your-client-id"
                      required
                    />
                  </label>
                </div>
                <button type="submit">Login with OIDC</button>
              </form>
            )}
          </>
        ) : (
          <div>
            <p>✓ Successfully logged in to {homeserver}</p>
            {username && <p>User: {username}</p>}
          </div>
        )}
        {status && <p>Status: {status}</p>}
      </div>
    </>
  );
}

export default App;
