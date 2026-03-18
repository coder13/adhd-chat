import type { CSSProperties } from 'react';

export type ThemeMode = 'light' | 'dark';
export type StorybookThemeKey =
  | 'light'
  | 'dark'
  | 'warm-friendly'
  | 'dark-cozy'
  | 'pastel'
  | 'minimal';

interface ThemeSeed {
  key: StorybookThemeKey;
  name: string;
  mode: ThemeMode;
  primary: string;
  accent: string;
  background: string;
  surface?: string;
  text?: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface StorybookThemePreset {
  key: StorybookThemeKey;
  name: string;
  mode: ThemeMode;
  palette: {
    primary: string;
    secondary: string;
    tertiary: string;
    background: string;
    surface: string;
    text: string;
  };
  style: CSSProperties;
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : normalized;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor) {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mix(base: string, target: string, amount: number) {
  const baseRgb = hexToRgb(base);
  const targetRgb = hexToRgb(target);

  return rgbToHex({
    r: baseRgb.r + (targetRgb.r - baseRgb.r) * amount,
    g: baseRgb.g + (targetRgb.g - baseRgb.g) * amount,
    b: baseRgb.b + (targetRgb.b - baseRgb.b) * amount,
  });
}

function tint(color: string, amount: number) {
  return mix(color, '#ffffff', amount);
}

function shade(color: string, amount: number) {
  return mix(color, '#000000', amount);
}

function rgbChannels(color: string) {
  const { r, g, b } = hexToRgb(color);
  return `${r}, ${g}, ${b}`;
}

function rgba(color: string, alpha: number) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(color: string) {
  const { r, g, b } = hexToRgb(color);
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(colorA: string, colorB: string) {
  const lighter = Math.max(relativeLuminance(colorA), relativeLuminance(colorB));
  const darker = Math.min(relativeLuminance(colorA), relativeLuminance(colorB));
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastText(
  background: string,
  light = '#ffffff',
  dark = '#1f2933'
) {
  return contrastRatio(background, light) >= contrastRatio(background, dark)
    ? light
    : dark;
}

function createColorVars(prefix: string, value: string) {
  return {
    [`--${prefix}`]: value,
    [`--${prefix}-rgb`]: rgbChannels(value),
  };
}

function createIonicColorVars(name: 'primary' | 'secondary' | 'tertiary', value: string) {
  const contrast = contrastText(value);
  return {
    [`--ion-color-${name}`]: value,
    [`--ion-color-${name}-rgb`]: rgbChannels(value),
    [`--ion-color-${name}-contrast`]: contrast,
    [`--ion-color-${name}-contrast-rgb`]: rgbChannels(contrast),
    [`--ion-color-${name}-shade`]: shade(value, 0.14),
    [`--ion-color-${name}-tint`]: tint(value, 0.12),
  };
}

function buildThemeStyle(seed: ThemeSeed) {
  const text = seed.text ?? (seed.mode === 'dark' ? '#f3f4f6' : '#1f2933');
  const panel = seed.surface ?? (seed.mode === 'dark' ? tint(seed.background, 0.08) : '#ffffff');
  const shell =
    seed.mode === 'dark'
      ? mix(seed.background, panel, 0.48)
      : tint(seed.background, 0.35);
  const secondary =
    seed.mode === 'dark'
      ? shade(seed.primary, 0.22)
      : shade(seed.primary, 0.14);
  const tertiary = seed.accent;
  const elevated =
    seed.mode === 'dark'
      ? tint(panel, 0.06)
      : mix(seed.background, seed.primary, 0.05);
  const surfaceMuted =
    seed.mode === 'dark'
      ? tint(panel, 0.03)
      : mix(seed.background, tertiary, 0.08);
  const chatBackground =
    seed.mode === 'dark'
      ? shade(seed.background, 0.06)
      : mix(seed.background, seed.primary, 0.08);
  const messageSurface =
    seed.mode === 'dark'
      ? tint(panel, 0.03)
      : mix(panel, seed.primary, 0.05);
  const messageSurfaceHover =
    seed.mode === 'dark'
      ? tint(panel, 0.08)
      : mix(panel, seed.primary, 0.1);
  const primarySoft =
    seed.mode === 'dark'
      ? mix(panel, seed.primary, 0.32)
      : mix(seed.background, seed.primary, 0.72);
  const primaryStrong =
    seed.mode === 'dark'
      ? tint(seed.primary, 0.48)
      : shade(seed.primary, 0.32);
  const secondarySoft =
    seed.mode === 'dark'
      ? mix(panel, secondary, 0.3)
      : mix(seed.background, secondary, 0.72);
  const secondaryStrong =
    seed.mode === 'dark'
      ? tint(secondary, 0.48)
      : shade(secondary, 0.28);
  const tertiarySoft =
    seed.mode === 'dark'
      ? mix(panel, tertiary, 0.28)
      : mix(seed.background, tertiary, 0.74);
  const tertiaryStrong =
    seed.mode === 'dark'
      ? tint(tertiary, 0.5)
      : shade(tertiary, 0.36);
  const iconButtonBg =
    seed.mode === 'dark'
      ? tint(panel, 0.05)
      : mix(panel, seed.primary, 0.1);
  const iconButtonHover =
    seed.mode === 'dark'
      ? tint(panel, 0.1)
      : mix(panel, seed.primary, 0.16);
  const iconButtonActive =
    seed.mode === 'dark'
      ? mix(panel, seed.primary, 0.18)
      : mix(panel, seed.primary, 0.24);
  const listItemHover =
    seed.mode === 'dark'
      ? mix(panel, text, 0.04)
      : mix(panel, seed.primary, 0.06);
  const listItemActive =
    seed.mode === 'dark'
      ? mix(panel, seed.primary, 0.22)
      : mix(panel, seed.primary, 0.18);
  const menuItemHover =
    seed.mode === 'dark'
      ? mix(panel, tertiary, 0.08)
      : mix(panel, tertiary, 0.1);
  const menuItemActive =
    seed.mode === 'dark'
      ? mix(panel, tertiary, 0.18)
      : mix(panel, tertiary, 0.2);
  const bubbleOwn =
    seed.mode === 'dark'
      ? mix(panel, seed.primary, 0.42)
      : mix(seed.background, seed.primary, 0.4);
  const bubbleOwnHover =
    seed.mode === 'dark'
      ? mix(panel, seed.primary, 0.52)
      : mix(seed.background, seed.primary, 0.5);
  const bubbleOther =
    seed.mode === 'dark'
      ? mix(panel, tertiary, 0.24)
      : mix(seed.background, tertiary, 0.34);
  const bubbleOtherHover =
    seed.mode === 'dark'
      ? mix(panel, tertiary, 0.32)
      : mix(seed.background, tertiary, 0.44);
  const bubbleOwnText = contrastText(bubbleOwn, '#f8fafc', '#1f2933');
  const bubbleOtherText = contrastText(bubbleOther, '#f8fafc', '#1f2933');
  const mediumText =
    seed.mode === 'dark'
      ? mix(text, seed.background, 0.32)
      : mix(text, seed.background, 0.55);
  const inverseText = seed.mode === 'dark' ? '#11171d' : '#ffffff';
  const borderBase =
    seed.mode === 'dark'
      ? mix(text, seed.background, 0.72)
      : mix(text, seed.background, 0.82);
  const shadowColor = seed.mode === 'dark' ? '#000000' : '#111827';

  const style = {
    ...createColorVars('ion-background-color', seed.background),
    ...createColorVars('ion-text-color', text),
    ...createColorVars('ion-color-medium', mediumText),
    ...createColorVars('ion-color-light', panel),
    ...createColorVars('app-shell-background', shell),
    ...createColorVars('app-chat-background', chatBackground),
    ...createColorVars('app-surface-panel', panel),
    ...createColorVars('app-surface-elevated', elevated),
    ...createColorVars('app-surface-muted', surfaceMuted),
    ...createColorVars('app-surface-glass', shell),
    ...createColorVars('app-message-surface', messageSurface),
    ...createColorVars('app-message-surface-hover', messageSurfaceHover),
    ...createColorVars('app-color-primary', seed.primary),
    ...createColorVars('app-color-primary-soft', primarySoft),
    ...createColorVars('app-color-primary-strong', primaryStrong),
    ...createColorVars('app-color-secondary', secondary),
    ...createColorVars('app-color-secondary-soft', secondarySoft),
    ...createColorVars('app-color-secondary-strong', secondaryStrong),
    ...createColorVars('app-color-tertiary', tertiary),
    ...createColorVars('app-color-tertiary-soft', tertiarySoft),
    ...createColorVars('app-color-tertiary-strong', tertiaryStrong),
    ...createColorVars('app-icon-button-bg', iconButtonBg),
    ...createColorVars('app-icon-button-hover', iconButtonHover),
    ...createColorVars('app-icon-button-active', iconButtonActive),
    ...createIonicColorVars('primary', seed.primary),
    ...createIonicColorVars('secondary', secondary),
    ...createIonicColorVars('tertiary', tertiary),
    ...createColorVars('app-bubble-own', bubbleOwn),
    ...createColorVars('app-bubble-own-hover', bubbleOwnHover),
    ...createColorVars('app-bubble-own-text', bubbleOwnText),
    ...createColorVars('app-bubble-other', bubbleOther),
    ...createColorVars('app-bubble-other-hover', bubbleOtherHover),
    ...createColorVars('app-bubble-other-text', bubbleOtherText),
    ...createColorVars('app-inverse-text-color', inverseText),
    '--app-list-item-hover-rgb': rgbChannels(listItemHover),
    '--app-list-item-active-rgb': rgbChannels(listItemActive),
    '--app-menu-item-hover-rgb': rgbChannels(menuItemHover),
    '--app-menu-item-active-rgb': rgbChannels(menuItemActive),
    '--app-border-color': rgba(borderBase, 0.14),
    '--app-border-color-rgb': rgbChannels(borderBase),
    '--app-border-strong-color': rgba(borderBase, 0.22),
    '--app-border-strong-color-rgb': rgbChannels(borderBase),
    '--app-shadow-color-rgb': rgbChannels(shadowColor),
  } as CSSProperties;

  return {
    palette: {
      primary: seed.primary,
      secondary,
      tertiary,
      background: seed.background,
      surface: panel,
      text,
    },
    style,
  };
}

const currentLightPreset: StorybookThemePreset = {
  key: 'light',
  name: 'Default Light',
  mode: 'light',
  palette: {
    primary: '#3C6F99',
    secondary: '#6B8760',
    tertiary: '#AE7B43',
    background: '#EEF2F4',
    surface: '#FFFFFF',
    text: '#1C2733',
  },
  style: {},
};

const currentDarkPreset: StorybookThemePreset = {
  key: 'dark',
  name: 'Default Dark',
  mode: 'dark',
  palette: {
    primary: '#8CB9E0',
    secondary: '#B4CC9C',
    tertiary: '#E9BF8E',
    background: '#11171D',
    surface: '#1D2630',
    text: '#EDF3F8',
  },
  style: {},
};

const candidateSeeds: ThemeSeed[] = [
  {
    key: 'warm-friendly',
    name: 'Warm Friendly',
    mode: 'light',
    primary: '#6C8EAD',
    accent: '#F2B880',
    background: '#FAF7F2',
  },
  {
    key: 'dark-cozy',
    name: 'Dark Cozy',
    mode: 'dark',
    primary: '#89A8C9',
    accent: '#E6A86A',
    background: '#1F2430',
    surface: '#2A3140',
    text: '#F3F4F6',
  },
  {
    key: 'pastel',
    name: 'Pastel',
    mode: 'light',
    primary: '#8FA8FF',
    accent: '#FFB6C9',
    background: '#FFF9FC',
  },
  {
    key: 'minimal',
    name: 'Minimal',
    mode: 'light',
    primary: '#4F46E5',
    accent: '#10B981',
    background: '#F9FAFB',
  },
];

const candidatePresets = candidateSeeds.reduce<Record<string, StorybookThemePreset>>(
  (presets, seed) => {
    const resolved = buildThemeStyle(seed);

    presets[seed.key] = {
      key: seed.key,
      name: seed.name,
      mode: seed.mode,
      palette: resolved.palette,
      style: resolved.style,
    };

    return presets;
  },
  {}
);

export const storybookThemePresets = {
  light: currentLightPreset,
  dark: currentDarkPreset,
  'warm-friendly': candidatePresets['warm-friendly'],
  'dark-cozy': candidatePresets['dark-cozy'],
  pastel: candidatePresets.pastel,
  minimal: candidatePresets.minimal,
} satisfies Record<StorybookThemeKey, StorybookThemePreset>;

export const storybookThemeToolbarItems = (
  Object.values(storybookThemePresets) as StorybookThemePreset[]
).map((preset) => ({
  value: preset.key,
  title: preset.name,
}));

export const storybookCandidateThemes = [
  storybookThemePresets['warm-friendly'],
  storybookThemePresets['dark-cozy'],
  storybookThemePresets.pastel,
  storybookThemePresets.minimal,
];

