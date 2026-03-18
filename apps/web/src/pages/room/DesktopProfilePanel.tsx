import { IonIcon } from '@ionic/react';
import {
  cameraOutline,
  checkmarkOutline,
  closeOutline,
  createOutline,
  openOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppAvatar, Card, Input } from '../../components';
import { saveCurrentUserProfileOverride } from '../../hooks/useCurrentUserProfileSummary';
import { useMatrixClient } from '../../hooks/useMatrixClient';

interface DesktopProfilePanelProps {
  currentUserName: string;
  currentUserAvatarUrl: string | null;
  currentUserId: string | null;
}

function getManageAccountUrl(homeserver: string) {
  try {
    return new URL('/account', homeserver).toString();
  } catch {
    return homeserver;
  }
}

function ProfileInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-elevated px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 break-all text-sm text-text">{value}</div>
    </div>
  );
}

export default function DesktopProfilePanel({
  currentUserName,
  currentUserAvatarUrl,
  currentUserId,
}: DesktopProfilePanelProps) {
  const { client } = useMatrixClient();
  const [displayNameDraft, setDisplayNameDraft] = useState(currentUserName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayNameDraft(currentUserName);
  }, [currentUserName]);

  useEffect(() => {
    if (!isEditingName) {
      return;
    }

    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditingName]);

  const avatarPreviewUrl = useMemo(() => {
    if (!avatarFile) {
      return currentUserAvatarUrl;
    }

    return URL.createObjectURL(avatarFile);
  }, [avatarFile, currentUserAvatarUrl]);

  useEffect(() => {
    if (!avatarFile || !avatarPreviewUrl || avatarPreviewUrl === currentUserAvatarUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarFile, avatarPreviewUrl, currentUserAvatarUrl]);

  const homeserver = client?.getHomeserverUrl() ?? '';
  const manageAccountUrl = homeserver ? getManageAccountUrl(homeserver) : null;
  const trimmedDisplayName = displayNameDraft.trim();
  const hasDisplayNameChange = trimmedDisplayName !== currentUserName;
  const hasAvatarChange = avatarFile !== null;

  const handleSave = async () => {
    if (!client || isSaving) {
      return;
    }

    if (!trimmedDisplayName) {
      setError('Display name cannot be empty.');
      return;
    }

    if (!hasDisplayNameChange && !hasAvatarChange) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      let nextAvatarMxcUrl = currentUserAvatarUrl;

      if (hasDisplayNameChange) {
        await client.setDisplayName(trimmedDisplayName);
      }

      if (avatarFile) {
        const upload = await client.uploadContent(avatarFile, {
          type: avatarFile.type || undefined,
          includeFilename: true,
        });
        await client.setAvatarUrl(upload.content_uri);
        nextAvatarMxcUrl = upload.content_uri;
      }

      if (currentUserId) {
        saveCurrentUserProfileOverride(currentUserId, {
          displayName: trimmedDisplayName,
          avatarMxcUrl: nextAvatarMxcUrl,
        });
      }

      setAvatarFile(null);
      setIsEditingName(false);
      setSaveMessage('Profile updated');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelNameEdit = () => {
    setDisplayNameDraft(currentUserName);
    setIsEditingName(false);
    setError(null);
    setSaveMessage(null);
  };

  return (
    <Card className="overflow-hidden px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Profile
          </div>
          <div className="mt-1 text-sm text-text-muted">
            Your avatar and Matrix identity
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-text transition-colors hover:bg-panel"
                onClick={handleCancelNameEdit}
                aria-label="Cancel name edit"
              >
                <IonIcon icon={closeOutline} className="text-lg" />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-emphasis disabled:opacity-60"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSaving}
                aria-label="Save profile changes"
              >
                <IonIcon icon={checkmarkOutline} className="text-lg" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-text transition-colors hover:bg-panel"
              onClick={() => {
                setIsEditingName(true);
                setSaveMessage(null);
                setError(null);
              }}
              aria-label="Edit profile"
            >
              <IonIcon icon={createOutline} className="text-lg" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-start gap-4">
        <div className="relative shrink-0">
          <AppAvatar
            name={trimmedDisplayName || currentUserName}
            avatarUrl={avatarPreviewUrl}
            className="h-20 w-20"
            textClassName="text-2xl"
          />
          <button
            type="button"
            className="absolute -right-1 -bottom-1 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-text shadow-sm transition-colors hover:bg-elevated"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change avatar"
          >
            <IonIcon icon={cameraOutline} className="text-base" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setAvatarFile(file);
              setSaveMessage(null);
              setError(null);
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <Input
              ref={nameInputRef}
              label="Display name"
              value={displayNameDraft}
              onChange={(event) => {
                setDisplayNameDraft(event.target.value);
                setSaveMessage(null);
                setError(null);
              }}
              placeholder="Your name"
            />
          ) : (
            <>
              <div className="truncate text-2xl font-semibold text-text">
                {trimmedDisplayName || currentUserName}
              </div>
              {currentUserId ? (
                <div className="mt-1 break-all text-sm text-text-muted">
                  {currentUserId}
                </div>
              ) : null}
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated"
              onClick={() => fileInputRef.current?.click()}
            >
              Change photo
            </button>
            {avatarFile ? (
              <>
                <button
                  type="button"
                  className="rounded-full bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-emphasis disabled:opacity-60"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save photo'}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated"
                  onClick={() => {
                    setAvatarFile(null);
                    setSaveMessage(null);
                    setError(null);
                  }}
                  disabled={isSaving}
                >
                  Reset photo
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {currentUserId ? (
          <ProfileInfoRow label="Matrix ID" value={currentUserId} />
        ) : null}
        {homeserver ? (
          <ProfileInfoRow label="Homeserver" value={homeserver} />
        ) : null}
      </div>

      {manageAccountUrl ? (
        <div className="mt-5">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-elevated"
            onClick={() => {
              window.open(manageAccountUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <IonIcon icon={openOutline} className="text-base" />
            Manage account
          </button>
        </div>
      ) : null}

      {error ? <div className="mt-4 text-sm text-danger">{error}</div> : null}
      {saveMessage ? (
        <div className="mt-4 text-sm text-success">{saveMessage}</div>
      ) : null}
    </Card>
  );
}
