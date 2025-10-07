import { useState } from 'react';
import { MatrixChatClient } from '@adhd-chat/core';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [matrixStatus, setMatrixStatus] = useState('Not initialized');

  const initializeMatrix = async () => {
    try {
      const client = new MatrixChatClient({
        baseUrl: 'https://matrix.org',
      });
      await client.initialize();
      setMatrixStatus('Initialized successfully');
    } catch (error) {
      setMatrixStatus(`Error: ${error}`);
    }
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>ADHD Chat</h1>
      <div className="card">
        <h2>Matrix Integration Demo</h2>
        <p>Status: {matrixStatus}</p>
        <button onClick={initializeMatrix}>Initialize Matrix Client</button>
        <hr />
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        This app uses the @adhd-chat/core package for Matrix protocol integration
      </p>
    </>
  );
}

export default App;
