import { useState } from 'react';
import { MatrixChatClient } from '@adhd-chat/core';

function App() {
  const [homeserver, setHomeserver] = useState('https://matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [status, setStatus] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Logging in...');

    try {
      const matrixClient = new MatrixChatClient({
        baseUrl: homeserver,
      });
      await matrixClient.initialize();
      await matrixClient.login(username, password);
      
      setIsLoggedIn(true);
      setStatus('Logged in successfully!');
    } catch (error) {
      setStatus(`Login failed: ${error}`);
      setIsLoggedIn(false);
    }
  };

  return (
    <>
      <h1>ADHD Chat</h1>
      <div>
        <h2>Matrix Login</h2>
        {!isLoggedIn ? (
          <form onSubmit={handleLogin}>
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
            <button type="submit">Login</button>
          </form>
        ) : (
          <div>
            <p>✓ Successfully logged in to {homeserver}</p>
            <p>User: {username}</p>
          </div>
        )}
        {status && <p>Status: {status}</p>}
      </div>
    </>
  );
}

export default App;
