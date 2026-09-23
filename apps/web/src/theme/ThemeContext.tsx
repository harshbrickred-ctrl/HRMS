import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyResolvedTheme,
  nextPreference,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredPreference()),
  );

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStoredPreference(next);
    const effective = resolveTheme(next);
    setResolved(effective);
    applyResolvedTheme(effective);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference(nextPreference(preference));
  }, [preference, setPreference]);

  useEffect(() => {
    applyResolvedTheme(resolveTheme(preference));
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const effective = resolveTheme('system');
      setResolved(effective);
      applyResolvedTheme(effective);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference,
      cyclePreference,
    }),
    [preference, resolved, setPreference, cyclePreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
