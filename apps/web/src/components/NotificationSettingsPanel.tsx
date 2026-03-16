import Card from './ui/Card';
import SegmentedControl from './ui/SegmentedControl';
import type { SegmentedControlOption } from './ui/SegmentedControl';

interface NotificationSettingsPanelProps<T extends string> {
  title: string;
  body: string;
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  helper?: string | null;
}

function NotificationSettingsPanel<T extends string>({
  title,
  body,
  value,
  options,
  onChange,
  helper = null,
}: NotificationSettingsPanelProps<T>) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
      <div className="mt-4">
        <SegmentedControl value={value} options={options} onChange={onChange} />
      </div>
      {helper ? (
        <p className="mt-3 text-xs leading-5 text-text-muted">{helper}</p>
      ) : null}
    </Card>
  );
}

export default NotificationSettingsPanel;
