import { IonAvatar } from '@ionic/react';
import { cn } from '../lib/cn';

interface AppAvatarProps {
  name: string;
  avatarUrl?: string | null;
  alt?: string;
  className?: string;
  textClassName?: string;
}

function getInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }

  const firstVisibleChar = trimmed.startsWith('@') && trimmed.length > 1
    ? trimmed.slice(1)
    : trimmed;

  return firstVisibleChar.charAt(0).toUpperCase();
}

function AppAvatar({
  name,
  avatarUrl = null,
  alt,
  className,
  textClassName,
}: AppAvatarProps) {
  return (
    <IonAvatar className={cn('bg-accent-soft', className)}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={alt ?? name} className="h-full w-full object-cover" />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center font-semibold text-accent',
            textClassName
          )}
        >
          {getInitial(name)}
        </div>
      )}
    </IonAvatar>
  );
}

export default AppAvatar;
