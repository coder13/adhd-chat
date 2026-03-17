import { useEffect, useState } from 'react';
import Button from './Button';
import type { DeviceVerificationState } from '../hooks/useMatrixClient/types';

interface DeviceVerificationPanelProps {
  verification: DeviceVerificationState;
  onStart: () => Promise<void>;
  onStartSas: () => Promise<void>;
  onConfirmSas: () => Promise<void>;
  onCancel: () => Promise<void>;
}

function DeviceVerificationPanel({
  verification,
  onStart,
  onStartSas,
  onConfirmSas,
  onCancel,
}: DeviceVerificationPanelProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (verification.status !== 'idle') {
      setIsStarting(false);
      setStartError(null);
    }
  }, [verification.status]);

  const isBusy =
    isStarting ||
    verification.status === 'requesting' ||
    verification.status === 'starting_sas' ||
    verification.status === 'confirming';

  const handleStart = async () => {
    setIsStarting(true);
    setStartError(null);

    try {
      await onStart();
    } catch (cause) {
      setIsStarting(false);
      setStartError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">
          Unlock with another device
        </h4>
        <p className="text-sm text-gray-600 mt-1">
          Use an already verified Matrix device to approve this browser instead
          of typing your recovery key.
        </p>
      </div>

      {verification.status === 'idle' && (
        <div className="space-y-3">
          <Button onClick={() => void handleStart()} disabled={isBusy}>
            {isStarting ? 'Sending Request...' : 'Use Another Device'}
          </Button>
          {isStarting && (
            <p className="text-sm text-gray-600">
              Sending a verification request to your other signed-in device...
            </p>
          )}
          {startError && (
            <p className="text-sm text-red-600">{startError}</p>
          )}
        </div>
      )}

      {verification.status === 'requesting' && (
        <p className="text-sm text-gray-600">
          Sending a verification request to your other devices...
        </p>
      )}

      {verification.status === 'waiting' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Check your other Matrix client and accept the verification request.
          </p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {verification.status === 'ready' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Your other device accepted. Start emoji verification on this
            browser.
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onStartSas}>Show Emojis</Button>
          </div>
        </div>
      )}

      {(verification.status === 'starting_sas' ||
        verification.status === 'confirming') && (
        <p className="text-sm text-gray-600">
          {verification.status === 'starting_sas'
            ? 'Starting emoji verification...'
            : 'Waiting for verification to finish...'}
        </p>
      )}

      {verification.status === 'showing_sas' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Compare these emojis with the other device, then confirm if they
            match.
          </p>
          {verification.emojis && verification.emojis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {verification.emojis.map((emoji) => (
                <div
                  key={`${emoji.symbol}-${emoji.name}`}
                  className="bg-gray-50 rounded-lg p-3 text-center"
                >
                  <p className="text-2xl">{emoji.symbol}</p>
                  <p className="text-xs text-gray-600 mt-1">{emoji.name}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onConfirmSas}>They Match</Button>
          </div>
        </div>
      )}

      {verification.status === 'done' && (
        <p className="text-sm text-green-700">
          Verification complete. This device can now restore encrypted message
          keys.
        </p>
      )}

      {(verification.status === 'cancelled' ||
        verification.status === 'error') && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">
            {verification.error ?? 'Verification did not complete.'}
          </p>
          <div className="flex justify-end">
            <Button onClick={onStart} disabled={isBusy}>
              Try Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceVerificationPanel;
