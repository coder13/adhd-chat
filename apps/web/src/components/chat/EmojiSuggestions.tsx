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
    <div className="app-menu-surface rounded-[20px] p-2">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.shortcode}
            type="button"
            className={`app-icon-button flex h-10 w-10 items-center justify-center rounded-2xl text-[22px] leading-none ${
              index === selectedIndex
                ? 'is-active ring-1 ring-primary/20 text-primary-strong'
                : 'text-text hover:text-primary-strong'
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
