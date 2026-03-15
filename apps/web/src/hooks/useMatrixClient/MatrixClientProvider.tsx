import type { PropsWithChildren } from 'react';
import { MatrixClientContext } from './context';
import { useMatrixClientState } from './useMatrixClientState';

export function MatrixClientProvider({ children }: PropsWithChildren) {
  const value = useMatrixClientState();

  return (
    <MatrixClientContext.Provider value={value}>
      {children}
    </MatrixClientContext.Provider>
  );
}
