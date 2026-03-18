interface TimelineDaySeparatorProps {
  label: string;
}

function TimelineDaySeparator({ label }: TimelineDaySeparatorProps) {
  return (
    <div className="relative flex items-center justify-center py-2" role="separator">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line/70" />
      <span className="relative rounded-full border border-line/70 bg-panel/95 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-text-muted shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)]">
        {label}
      </span>
    </div>
  );
}

export default TimelineDaySeparator;
