import { cn } from '../lib/cn';

export type NotificationSettingOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

interface NotificationSettingsPanelProps<T extends string> {
  title: string;
  body?: string | null;
  value: T;
  options: NotificationSettingOption<T>[];
  onChange: (value: T) => void;
  helper?: string | null;
}

function NotificationSettingsPanel<T extends string>({
  title,
  body = null,
  value,
  options,
  onChange,
  helper = null,
}: NotificationSettingsPanelProps<T>) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {body ? (
          <p className="mt-1 text-sm leading-6 text-text-muted">{body}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-elevated/70"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-text">
                  {option.label}
                </div>
                {option.description ? (
                  <p className="mt-1 text-sm leading-5 text-text-muted">
                    {option.description}
                  </p>
                ) : null}
              </div>

              <span
                aria-hidden="true"
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                  isSelected
                    ? 'border-accent bg-accent shadow-[0_0_0_3px_rgba(var(--ion-color-primary-rgb),0.16)]'
                    : 'border-line bg-transparent'
                )}
              >
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full transition-opacity',
                    isSelected ? 'bg-white opacity-100' : 'bg-transparent opacity-0'
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>

      {helper ? (
        <p className="text-xs leading-5 text-text-muted">{helper}</p>
      ) : null}
    </div>
  );
}

export default NotificationSettingsPanel;
