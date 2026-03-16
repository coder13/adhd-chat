import { cn } from '../../lib/cn';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-full border border-line bg-panel p-1">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-text-inverse'
                : 'text-text-muted hover:bg-elevated hover:text-text'
            )}
          >
            <span>{option.label}</span>
            {typeof option.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  isActive
                    ? 'bg-white/20 text-text-inverse'
                    : 'bg-elevated text-text'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
