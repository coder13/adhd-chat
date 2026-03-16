import type { EmojiSuggestion } from '../../lib/chat/emojis';

interface EmojiSuggestionsProps {
  suggestions: EmojiSuggestion[];
  selectedIndex: number;
  onSelect: (emoji: string) => void;
  onHighlight: (index: number) => void;
}

function EmojiSuggestions({
  suggestions,
  selectedIndex,
  onSelect,
  onHighlight,
}: EmojiSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[20px] border border-line bg-white p-2 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.32)]">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.shortcode}
            type="button"
            className={`flex h-10 w-10 items-center justify-center rounded-2xl text-[22px] leading-none text-text transition-colors ${
              index === selectedIndex ? 'bg-elevated ring-1 ring-accent/30' : 'hover:bg-elevated'
            }`}
            aria-label={`Insert :${suggestion.shortcode}:`}
            title={`:${suggestion.shortcode}:`}
            onMouseEnter={() => onHighlight(index)}
            onClick={() => onSelect(suggestion.emoji)}
          >
            <span>{suggestion.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiSuggestions;
