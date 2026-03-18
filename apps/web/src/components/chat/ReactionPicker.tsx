import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  theme?: 'light' | 'dark';
  inline?: boolean;
  className?: string;
  align?: 'left' | 'right';
}

type EmojiMartSelection = {
  native?: string;
};

function ReactionPicker({
  onSelect,
  theme,
  inline = false,
  className = '',
  align = 'right',
}: ReactionPickerProps) {
  const anchoredClass = align === 'left' ? 'left-0' : 'right-0';
  const resolvedTheme =
    theme ??
    (typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light');

  return (
    <div
      className={
        inline
          ? className
          : `app-menu-surface absolute ${anchoredClass} top-full z-30 mt-2 overflow-hidden rounded-[24px] ${className}`
      }
    >
      <div
        className="max-h-[28rem] overflow-hidden overscroll-contain [touch-action:pan-y]"
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
      >
        <Picker
          data={data}
          theme={resolvedTheme}
          previewPosition="none"
          searchPosition="sticky"
          skinTonePosition="none"
          maxFrequentRows={1}
          perLine={8}
          emojiButtonSize={40}
          emojiSize={22}
          navPosition="top"
          icons="outline"
          onEmojiSelect={(emoji: EmojiMartSelection) => {
            if (emoji.native) {
              onSelect(emoji.native);
            }
          }}
        />
      </div>
    </div>
  );
}

export default ReactionPicker;
