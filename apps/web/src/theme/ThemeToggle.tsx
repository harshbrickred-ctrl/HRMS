import { Monitor, Moon, Sun } from 'lucide-react';
import { preferenceLabel, type ThemePreference } from './theme';
import { useTheme } from './ThemeContext';
import './ThemeToggle.css';

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === 'light') return <Sun size={18} aria-hidden />;
  if (preference === 'dark') return <Moon size={18} aria-hidden />;
  return <Monitor size={18} aria-hidden />;
}

export function ThemeToggle() {
  const { preference, resolved, cyclePreference } = useTheme();
  const label = preferenceLabel(preference);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cyclePreference}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label} (resolved ${resolved})`}
    >
      <ThemeIcon preference={preference} />
    </button>
  );
}
