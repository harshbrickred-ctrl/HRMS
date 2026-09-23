export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'peopleos-theme';

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return getSystemTheme();
  return preference;
}

export function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function writeStoredPreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
}

export function nextPreference(current: ThemePreference): ThemePreference {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}

export function preferenceLabel(preference: ThemePreference): string {
  if (preference === 'system') return 'System';
  if (preference === 'light') return 'Light';
  return 'Dark';
}
