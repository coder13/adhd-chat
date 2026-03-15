import { useCallback, useEffect, useState } from 'react';
import {
  cancelBrowserInteractiveAuth,
  completeBrowserInteractiveAuth,
  setBrowserInteractiveAuthRequestCallback,
} from './useMatrixClient/helpers';

type BrowserInteractiveAuthPayload = {
  title: string;
  description: string;
  url: string;
};

export function useBrowserInteractiveAuthRequest() {
  const [payload, setPayload] = useState<BrowserInteractiveAuthPayload | null>(
    null
  );

  useEffect(() => {
    setBrowserInteractiveAuthRequestCallback((nextPayload) => {
      setPayload(nextPayload);
    });

    return () => {
      setBrowserInteractiveAuthRequestCallback(null);
    };
  }, []);

  const handleContinue = useCallback(() => {
    completeBrowserInteractiveAuth();
    setPayload(null);
  }, []);

  const handleCancel = useCallback(() => {
    cancelBrowserInteractiveAuth();
    setPayload(null);
  }, []);

  return {
    payload,
    handleContinue,
    handleCancel,
  };
}
