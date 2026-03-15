import { useCallback, useEffect, useState } from 'react';
import {
  provideSecretStorageKey,
  cancelSecretStorageKeyRequest,
  setKeyRequestCallback,
} from './useMatrixClient/helpers';

export function useSecretStorageKeyRequest() {
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Set up the callback that will be triggered when the Matrix client needs a key
    setKeyRequestCallback(() => {
      setIsRequesting(true);
    });

    return () => {
      setKeyRequestCallback(null);
    };
  }, []);

  const handleProvideKey = useCallback((key: string) => {
    provideSecretStorageKey(key);
    setIsRequesting(false);
  }, []);

  const handleCancel = useCallback(() => {
    cancelSecretStorageKeyRequest();
    setIsRequesting(false);
  }, []);

  return {
    isRequesting,
    handleProvideKey,
    handleCancel,
  };
}
