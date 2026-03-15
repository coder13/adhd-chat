import { createContext } from 'react';
import type { useMatrixClientState } from './useMatrixClientState';

export type MatrixClientContextValue = ReturnType<typeof useMatrixClientState>;

export const MatrixClientContext =
  createContext<MatrixClientContextValue | null>(null);
