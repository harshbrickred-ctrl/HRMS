import { Platform } from 'react-native';

/** Design44 palette — mirrors apps/web/src/index.css */
export const Colors = {
  light: {
    text: '#131412',
    background: '#e9eeea',
    card: '#f7faf7',
    cardElevated: '#ffffff',
    border: '#d5ddd8',
    textSecondary: '#929191',
    backgroundElement: '#f7faf7',
  },
  dark: {
    text: '#e9eeea',
    background: '#131412',
    card: '#1c1e1c',
    cardElevated: '#252825',
    border: '#353935',
    textSecondary: '#a3a8a4',
    backgroundElement: '#1c1e1c',
  },
} as const;

export const brand = {
  primary: '#e2f28e',
  primaryHover: '#d4e87a',
  primaryInk: '#131412',
  danger: '#8f2f2f',
  dangerBg: '#f4e8e8',
  warning: '#7a5a00',
  success: '#2f4a12',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export function useThemeColors(
  scheme: 'light' | 'dark' | 'unspecified' | null | undefined,
) {
  const mode = scheme === 'dark' ? 'dark' : 'light';
  return {
    ...Colors[mode],
    primary: brand.primary,
    primaryHover: brand.primaryHover,
    primaryInk: brand.primaryInk,
    danger: brand.danger,
    dangerBg: brand.dangerBg,
    warning: brand.warning,
    success: brand.success,
  };
}

export const Fonts = Platform.select({
  ios: { sans: 'System', display: 'System' },
  default: { sans: 'System', display: 'System' },
  web: {
    sans: 'DM Sans, Segoe UI, system-ui, sans-serif',
    display: 'Syne, Segoe UI, system-ui, sans-serif',
  },
});
