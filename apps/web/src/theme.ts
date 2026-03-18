/**
 * Theme configuration for the application
 * This file centralizes theme-related constants and utilities
 */

export const theme = {
  colors: {
    primary: {
      50: '#f2f7fb',
      100: '#e2edf6',
      200: '#c6dced',
      300: '#9fc1de',
      400: '#709ec5',
      500: '#3c6f99',
      600: '#345f82',
      700: '#2b4f6b',
      800: '#244155',
      900: '#1f3342',
      950: '#14202b',
    },
    secondary: {
      50: '#f4f7f2',
      100: '#e8eee4',
      200: '#d2dccb',
      300: '#afc29f',
      400: '#8da379',
      500: '#6b8760',
      600: '#5b7352',
      700: '#4b5e44',
      800: '#3b4a37',
      900: '#2c382a',
      950: '#1c241b',
    },
    tertiary: {
      50: '#fbf6f1',
      100: '#f6ecdf',
      200: '#edd8bd',
      300: '#dfbb8b',
      400: '#c9995f',
      500: '#ae7b43',
      600: '#95673a',
      700: '#7a5431',
      800: '#614228',
      900: '#48321f',
      950: '#2f2014',
    },
    surface: {
      light: {
        canvas: '#eef2f4',
        shell: '#fbfcfa',
        panel: '#ffffff',
        elevated: '#f3f5f2',
        chat: '#e7edf2',
      },
      dark: {
        canvas: '#11171d',
        shell: '#171f28',
        panel: '#1d2630',
        elevated: '#24303c',
        chat: '#0f151c',
      },
    },
  },
  spacing: {
    xs: '0.5rem', // 8px
    sm: '0.75rem', // 12px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '3rem', // 48px
  },
  borderRadius: {
    sm: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    full: '9999px',
  },
} as const;

export type Theme = typeof theme;
