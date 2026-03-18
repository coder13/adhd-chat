import type { Preview } from '@storybook/react-vite';
import { setupIonicReact } from '@ionic/react';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '../src/index.css';
import '../src/theme/variables.css';
import {
  storybookThemePresets,
  storybookThemeToolbarItems,
  type StorybookThemeKey,
} from '../src/theme/storybookThemePresets';

setupIonicReact();

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global color theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: storybookThemeToolbarItems,
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    viewport: {
      value: 'desktop',
      isRotated: false,
    },
  },
  parameters: {
    layout: 'fullscreen',
    controls: {
      expanded: true,
    },
    viewport: {
      options: {
        mobile: INITIAL_VIEWPORTS.iphone12,
        tablet: INITIAL_VIEWPORTS.ipad,
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1280px',
            height: '960px',
          },
          type: 'desktop',
        },
      },
    },
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: '#eef2f4' },
        { name: 'shell', value: '#fbfcfa' },
        { name: 'night', value: '#11171d' },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const activeTheme =
        storybookThemePresets[
          (context.globals.theme as StorybookThemeKey | undefined) ?? 'light'
        ] ?? storybookThemePresets.light;
      const isDark = activeTheme.mode === 'dark';

      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
      }

      return (
        <div
          className={isDark ? 'dark' : ''}
          style={{
            ...activeTheme.style,
            minHeight: '100vh',
            backgroundColor: 'var(--ion-background-color)',
            color: 'var(--ion-text-color)',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
