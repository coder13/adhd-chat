import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  theme?: 'light' | 'dark';
  inline?: boolean;
}

type EmojiMartSelection = {
  native?: string;
};

function ReactionPicker({
  onSelect,
  theme = 'light',
  inline = false,
}: ReactionPickerProps) {
  return (
    <div
      className={
        inline
          ? ''
          : 'absolute right-0 top-full z-30 mt-2 overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_20px_48px_-24px_rgba(15,23,42,0.35)]'
      }
    >
      <div
        className="max-h-[28rem] overflow-hidden overscroll-contain [touch-action:pan-y]"
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
      >
        <Picker
          data={data}
          theme={theme}
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
