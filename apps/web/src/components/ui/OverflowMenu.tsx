import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Fragment } from 'react';
import { cn } from '../../lib/cn';

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
};

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  buttonLabel?: string;
  align?: 'left' | 'right';
}

function OverflowMenu({
  items,
  buttonLabel = 'Open menu',
  align = 'right',
}: OverflowMenuProps) {
  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="app-icon-button inline-flex h-10 w-10 items-center justify-center rounded-full"
        aria-label={buttonLabel}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current">
          <circle cx="12" cy="5" r="1.75" fill="currentColor" />
          <circle cx="12" cy="12" r="1.75" fill="currentColor" />
          <circle cx="12" cy="19" r="1.75" fill="currentColor" />
        </svg>
      </MenuButton>

      <MenuItems
        anchor={align === 'right' ? 'bottom end' : 'bottom start'}
        transition
        className={cn(
          'app-menu-surface z-20 mt-2 w-56 rounded-3xl p-2 outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
          align === 'right' ? 'origin-top-right' : 'origin-top-left'
        )}
      >
        {items.map((item) => (
          <MenuItem key={item.label} as={Fragment}>
            {({ focus }) => (
              <button
                type="button"
                onClick={item.onSelect}
                className={cn(
                  'app-interactive-menu-item flex w-full rounded-2xl px-4 py-3 text-left text-sm font-medium',
                  focus ? 'is-active' : '',
                  item.tone === 'danger' ? 'text-danger-strong' : 'text-text'
                )}
              >
                {item.label}
              </button>
            )}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

export default OverflowMenu;
