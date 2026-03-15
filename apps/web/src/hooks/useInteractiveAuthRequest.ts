import { useCallback, useEffect, useState } from 'react';
import {
  cancelInteractiveAuthRequest,
  provideInteractiveAuthPassword,
  setInteractiveAuthRequestCallback,
} from './useMatrixClient/helpers';

export function useInteractiveAuthRequest() {
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    setInteractiveAuthRequestCallback(() => {
      setIsRequesting(true);
    });

    return () => {
      setInteractiveAuthRequestCallback(null);
    };
  }, []);

  const handleProvidePassword = useCallback((password: string) => {
    provideInteractiveAuthPassword(password);
    setIsRequesting(false);
  }, []);

  const handleCancel = useCallback(() => {
    cancelInteractiveAuthRequest();
    setIsRequesting(false);
  }, []);

  return {
    isRequesting,
    handleProvidePassword,
    handleCancel,
  };
}
