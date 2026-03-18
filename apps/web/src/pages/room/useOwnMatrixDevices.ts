import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';

export interface OwnMatrixDeviceSummary {
  deviceId: string;
  displayName: string;
  lastSeenIp: string | null;
  lastSeenTs: number | null;
  userAgent: string | null;
  sessionLabel: string;
  isVerified: boolean;
  verificationLabel: string;
}

export function useOwnMatrixDevices() {
  const { client, user } = useMatrixClient();
  const [devices, setDevices] = useState<OwnMatrixDeviceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !user) {
      setDevices([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await client.getDevices();
      const cryptoApi = client.getCrypto?.() ?? null;

      const nextDevices = await Promise.all(
        response.devices.map(async (device) => {
          const userAgent =
            device['org.matrix.msc3852.last_seen_user_agent'] ??
            device.last_seen_user_agent ??
            null;
          const verification = cryptoApi
            ? await cryptoApi.getDeviceVerificationStatus(user.userId, device.device_id)
            : null;
          const isVerified = Boolean(
            verification &&
              (verification.signedByOwner ||
                verification.crossSigningVerified ||
                verification.localVerified)
          );

          return {
            deviceId: device.device_id,
            displayName: device.display_name?.trim() || 'Unnamed session',
            lastSeenIp: device.last_seen_ip ?? null,
            lastSeenTs: device.last_seen_ts ?? null,
            userAgent,
            sessionLabel: formatSessionLabel(device.display_name, userAgent),
            isVerified,
            verificationLabel: isVerified ? 'Verified' : 'Unverified',
          } satisfies OwnMatrixDeviceSummary;
        })
      );

      setDevices(nextDevices);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort(
      (a, b) => (b.lastSeenTs ?? 0) - (a.lastSeenTs ?? 0)
    );
  }, [devices]);

  return {
    devices: sortedDevices,
    isLoading,
    error,
    refresh,
  };
}

function formatSessionLabel(displayName?: string, userAgent?: string | null) {
  const normalizedDisplayName = displayName?.trim();
  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  const normalizedAgent = (userAgent ?? '').toLowerCase();
  if (normalizedAgent.includes('linux')) {
    return 'Element on Linux';
  }
  if (normalizedAgent.includes('android')) {
    return 'Element on Android';
  }
  if (normalizedAgent.includes('iphone') || normalizedAgent.includes('ios')) {
    return 'Element on iOS';
  }
  if (normalizedAgent.includes('mac os') || normalizedAgent.includes('macintosh')) {
    return 'Element on macOS';
  }
  if (normalizedAgent.includes('windows')) {
    return 'Element on Windows';
  }

  return 'Current session';
}
