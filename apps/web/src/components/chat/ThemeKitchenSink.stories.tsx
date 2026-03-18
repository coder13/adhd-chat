import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import ThemeShowcase from './ThemeShowcase';
import {
  storybookCandidateThemes,
  storybookThemePresets,
} from '../../theme/storybookThemePresets';

function DefaultThemeComparisonStory() {
  return (
    <MemoryRouter>
      <div className="min-h-screen p-6 sm:p-8">
        <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-2">
          <ThemeShowcase
            preset={storybookThemePresets.light}
            activeRoomId="!weekend:matrix.org"
          />
          <ThemeShowcase
            preset={storybookThemePresets.dark}
            activeRoomId="!groceries:matrix.org"
          />
        </div>
      </div>
    </MemoryRouter>
  );
}

function CandidateThemeGalleryStory() {
  return (
    <MemoryRouter>
      <div className="min-h-screen p-6 sm:p-8">
        <div className="mx-auto grid max-w-[1800px] gap-6 2xl:grid-cols-2">
          {storybookCandidateThemes.map((preset, index) => (
            <ThemeShowcase
              key={preset.key}
              preset={preset}
              activeRoomId={index % 2 === 0 ? '!weekend:matrix.org' : '!groceries:matrix.org'}
            />
          ))}
        </div>
      </div>
    </MemoryRouter>
  );
}

const meta = {
  title: 'Theme/Kitchen Sink',
  component: DefaultThemeComparisonStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DefaultThemeComparisonStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompareLightAndDark: Story = {
  globals: {
    theme: 'light',
  },
};

export const CompareCandidateThemes: Story = {
  render: () => <CandidateThemeGalleryStory />,
  globals: {
    theme: 'light',
  },
};

