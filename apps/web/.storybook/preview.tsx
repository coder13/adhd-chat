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

setupIonicReact();

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global color theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light mode' },
          { value: 'dark', title: 'Dark mode' },
        ],
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
        { name: 'app', value: '#f5f7fb' },
        { name: 'shell', value: '#ffffff' },
        { name: 'night', value: '#0f172a' },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.theme === 'dark';

      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
      }

      return (
        <div
          className={isDark ? 'dark' : ''}
          style={{
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
