import { Button, Card } from '../../components';
import { useState } from 'react';

interface DesktopAccountPanelProps {
  currentUserName: string;
  currentUserId: string | null;
  onEditProfile: () => void;
  onOpenDevices: () => void;
  onOpenEncryption: () => void;
  onLogout: () => Promise<void>;
}

export default function DesktopAccountPanel({
  currentUserName,
  currentUserId,
  onEditProfile,
  onOpenDevices,
  onOpenEncryption,
  onLogout,
}: DesktopAccountPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
    } catch {
      setCopyMessage(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-base font-semibold text-text">Identity</h3>
        <div className="mt-4 space-y-3">
          {currentUserId ? (
            <InfoRow
              label="Account"
              value={currentUserName}
              secondaryValue={currentUserId}
              actionLabel="Copy"
              onAction={() => void copyValue(currentUserId, 'Matrix ID')}
            />
          ) : (
            <InfoRow label="Account" value={currentUserName} />
          )}
        </div>
        {copyMessage ? (
          <div className="mt-3 text-sm text-text-muted">{copyMessage}</div>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h3 className="text-base font-semibold text-text">Tools</h3>
        <div className="grid gap-3">
          <Button
            fullWidth
            className="bg-accent text-white hover:bg-accent-emphasis"
            onClick={onEditProfile}
          >
            Edit profile
          </Button>
          <Button variant="outline" fullWidth onClick={onOpenDevices}>
            Sessions
          </Button>
          <Button variant="outline" fullWidth onClick={onOpenEncryption}>
            Encryption tools
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-base font-semibold text-text">Session</h3>
        <p className="text-sm leading-6 text-text-muted">
          Sign out this browser if you no longer want it connected to your
          Matrix account.
        </p>
        <Button variant="outline" fullWidth onClick={() => void onLogout()}>
          Sign out this device
        </Button>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  secondaryValue,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-elevated/70 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.08em] text-text-subtle">
          {label}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-accent transition-colors hover:text-accent-emphasis"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="mt-1 break-all text-sm font-medium text-text">{value}</div>
      {secondaryValue ? (
        <div className="mt-1 break-all text-sm text-text-muted">
          {secondaryValue}
        </div>
      ) : null}
    </div>
  );
}
