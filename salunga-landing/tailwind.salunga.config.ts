import type { Config } from 'tailwindcss'

// Salunga Brand Color Palette
// Inspired by professional project management tools with a modern, trustworthy feel
const salungaColors = {
  // Primary brand colors - Professional blue with tech feel
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main primary
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },

  // Accent colors - Complementary teal for highlights and CTAs
  accent: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6', // Main accent
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    950: '#042f2e',
  },

  // Success colors - Green for positive states
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Main success
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  // Warning colors - Amber for caution states
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Main warning
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // Danger colors - Red for error states
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // Main danger
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Neutral colors - Light theme with subtle grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
}

// Salunga theme extension for Tailwind
export const salungaTheme: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        // Salunga semantic color mappings
        'salunga-primary': salungaColors.primary[500],
        'salunga-primary-hover': salungaColors.primary[600],
        'salunga-primary-light': salungaColors.primary[100],
        'salunga-primary-dark': salungaColors.primary[700],

        'salunga-accent': salungaColors.accent[500],
        'salunga-accent-hover': salungaColors.accent[600],
        'salunga-accent-light': salungaColors.accent[100],
        'salunga-accent-dark': salungaColors.accent[700],

        'salunga-success': salungaColors.success[500],
        'salunga-success-hover': salungaColors.success[600],
        'salunga-success-light': salungaColors.success[100],

        'salunga-warning': salungaColors.warning[500],
        'salunga-warning-hover': salungaColors.warning[600],
        'salunga-warning-light': salungaColors.warning[100],

        'salunga-danger': salungaColors.danger[500],
        'salunga-danger-hover': salungaColors.danger[600],
        'salunga-danger-light': salungaColors.danger[100],

        // Background and foreground for light theme
        'salunga-bg': '#ffffff',
        'salunga-bg-secondary': salungaColors.neutral[50],
        'salunga-bg-muted': salungaColors.neutral[100],

        'salunga-fg': salungaColors.neutral[900],
        'salunga-fg-secondary': salungaColors.neutral[700],
        'salunga-fg-muted': salungaColors.neutral[500],

        // Border and input colors
        'salunga-border': salungaColors.neutral[200],
        'salunga-border-hover': salungaColors.neutral[300],
        'salunga-input': salungaColors.neutral[100],
        'salunga-input-border': salungaColors.neutral[300],

        // Full color palettes for advanced usage
        'salunga-primary-palette': salungaColors.primary,
        'salunga-accent-palette': salungaColors.accent,
        'salunga-success-palette': salungaColors.success,
        'salunga-warning-palette': salungaColors.warning,
        'salunga-danger-palette': salungaColors.danger,
        'salunga-neutral-palette': salungaColors.neutral,
      },

      // Custom CSS variables for dynamic theming
      backgroundColor: {
        'salunga-primary': 'var(--salunga-primary, #0ea5e9)',
        'salunga-accent': 'var(--salunga-accent, #14b8a6)',
        'salunga-success': 'var(--salunga-success, #22c55e)',
        'salunga-warning': 'var(--salunga-warning, #f59e0b)',
        'salunga-danger': 'var(--salunga-danger, #ef4444)',
        'salunga-bg': 'var(--salunga-bg, #ffffff)',
        'salunga-muted': 'var(--salunga-muted, #f5f5f5)',
      },

      textColor: {
        'salunga-primary': 'var(--salunga-primary, #0ea5e9)',
        'salunga-accent': 'var(--salunga-accent, #14b8a6)',
        'salunga-success': 'var(--salunga-success, #22c55e)',
        'salunga-warning': 'var(--salunga-warning, #f59e0b)',
        'salunga-danger': 'var(--salunga-danger, #ef4444)',
        'salunga-fg': 'var(--salunga-fg, #171717)',
        'salunga-muted': 'var(--salunga-muted, #737373)',
      },

      borderColor: {
        'salunga-primary': 'var(--salunga-primary, #0ea5e9)',
        'salunga-accent': 'var(--salunga-accent, #14b8a6)',
        'salunga-border': 'var(--salunga-border, #e5e5e5)',
      },

      // Typography extensions for Salunga
      fontFamily: {
        'salunga-sans': ['Inter', 'system-ui', 'sans-serif'],
        'salunga-heading': ['Space Grotesk', 'system-ui', 'sans-serif'],
      },

      // Custom spacing for consistent layouts
      spacing: {
        'salunga-xs': '0.5rem', // 8px
        'salunga-sm': '0.75rem', // 12px
        'salunga-md': '1rem', // 16px
        'salunga-lg': '1.5rem', // 24px
        'salunga-xl': '2rem', // 32px
        'salunga-2xl': '3rem', // 48px
      },

      // Custom border radius for consistent styling
      borderRadius: {
        'salunga-sm': '0.375rem', // 6px
        'salunga-md': '0.5rem', // 8px
        'salunga-lg': '0.75rem', // 12px
        'salunga-xl': '1rem', // 16px
      },

      // Custom shadows for depth
      boxShadow: {
        'salunga-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'salunga-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'salunga-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'salunga-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
}

// CSS custom properties for runtime theming
export const salungaCSSVariables = `
:root {
  --salunga-primary: #0ea5e9;
  --salunga-primary-hover: #0284c7;
  --salunga-primary-light: #e0f2fe;
  --salunga-primary-dark: #0369a1;
  
  --salunga-accent: #14b8a6;
  --salunga-accent-hover: #0d9488;
  --salunga-accent-light: #ccfbf1;
  --salunga-accent-dark: #0f766e;
  
  --salunga-success: #22c55e;
  --salunga-warning: #f59e0b;
  --salunga-danger: #ef4444;
  
  --salunga-bg: #ffffff;
  --salunga-bg-secondary: #fafafa;
  --salunga-bg-muted: #f5f5f5;
  
  --salunga-fg: #171717;
  --salunga-fg-secondary: #404040;
  --salunga-fg-muted: #737373;
  
  --salunga-border: #e5e5e5;
  --salunga-border-hover: #d4d4d4;
  --salunga-input: #f5f5f5;
  --salunga-input-border: #d4d4d4;
}
`

export default salungaTheme
