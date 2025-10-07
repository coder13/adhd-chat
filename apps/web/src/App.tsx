import { useCallback, useEffect, useState } from 'react';
import { MatrixChatClient } from '@adhd-chat/core';

function App() {
  const [matrixStatus, setMatrixStatus] = useState('Not initialized');

  const initializeMatrix = useCallback(async () => {
    setMatrixStatus('Initializing...');
    try {
      const client = new MatrixChatClient({
        baseUrl: 'https://matrix.org',
      });
      await client.initialize();
      setMatrixStatus('Initialized successfully');
    } catch (error) {
      setMatrixStatus(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    initializeMatrix();
  }, [initializeMatrix]);

  return (
    <>
      <h1>ADHD Chat</h1>
      <div>
        <h2>Matrix Integration Demo</h2>
        <p>Status: {matrixStatus}</p>
      </div>
    </>
  );
}

export default App;
