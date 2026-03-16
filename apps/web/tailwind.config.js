/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--ion-background-color-rgb) / <alpha-value>)',
        panel: 'rgb(var(--ion-color-light-rgb) / <alpha-value>)',
        elevated: 'rgb(var(--ion-color-light-rgb) / <alpha-value>)',
        line: 'var(--app-border-color)',
        text: {
          DEFAULT: 'rgb(var(--ion-text-color-rgb) / <alpha-value>)',
          muted: 'rgb(var(--ion-color-medium-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--ion-color-medium-rgb) / <alpha-value>)',
          inverse: 'var(--app-inverse-text-color)',
        },
        accent: {
          DEFAULT: 'rgb(var(--ion-color-primary-rgb) / <alpha-value>)',
          strong: 'rgb(var(--ion-color-primary-rgb) / <alpha-value>)',
          soft: 'rgba(var(--ion-color-primary-rgb), 0.12)',
        },
        success: {
          DEFAULT: '#16a34a',
          soft: '#dcfce7',
        },
        warning: {
          DEFAULT: '#d97706',
          soft: '#fef3c7',
        },
        danger: {
          DEFAULT: '#dc2626',
          soft: '#fee2e2',
        },
        // Primary brand colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // Secondary/accent colors
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
      },
      boxShadow: {
        panel:
          '0 24px 60px -32px rgba(15, 23, 42, 0.30), 0 10px 24px -18px rgba(15, 23, 42, 0.22)',
      },
    },
  },
  plugins: [],
}
