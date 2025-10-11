import { useState } from 'react';
import useMatrixClient from '../hooks/useMatrixClient/useMatrixClient';

function Login() {
  const [homeServer, setHomeServer] = useState('https://matrix.org');
  const { loginWithSso, state, error } = useMatrixClient();

  const handleContinue = async () => {
    if (homeServer) {
      await loginWithSso(homeServer);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <div>
        <label htmlFor="homeServer">Home Server:</label>
        <input
          id="homeServer"
          type="text"
          value={homeServer}
          onChange={(e) => setHomeServer(e.target.value)}
          placeholder="https://matrix.org"
          style={{ marginLeft: '10px', marginRight: '10px', padding: '5px', width: '300px' }}
        />
        <button onClick={handleContinue} disabled={!homeServer || state === 'redirecting'}>
          Continue
        </button>
      </div>
      {state === 'redirecting' && <p>Redirecting to SSO...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}

export default Login;
