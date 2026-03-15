import { useContext } from 'react';
import { MatrixClientContext } from './context';

export function useMatrixClient() {
  const value = useContext(MatrixClientContext);

  if (!value) {
    throw new Error('useMatrixClient must be used within MatrixClientProvider.');
  }

  return value;
}

export default useMatrixClient;
