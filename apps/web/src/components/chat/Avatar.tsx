interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-14 w-14 text-lg',
};

function Avatar({ name, size = 'md' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`${sizeStyles[size]} inline-flex items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

export default Avatar;
