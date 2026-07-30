import { ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function CoverageVisibilityControl({
  enabled,
  onChange,
  compact = false,
}) {
  const { theme, themes } = useTheme();
  const t = themes[theme];

  return (
    <button
      type="button"
      className={`coverage-visibility-control ${compact ? 'is-compact' : ''}`}
      aria-label={`${enabled ? 'Hide' : 'Show'} coverage lines`}
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
      title={`${enabled ? 'Hide' : 'Show'} coverage lines`}
      style={{
        '--coverage-control-accent': t.ac,
        '--coverage-control-border': t.bd,
        '--coverage-control-bg': t.cb,
        '--coverage-control-text': t.tm,
      }}
    >
      <ShieldCheck aria-hidden="true" />
      <span>Coverage</span>
      <strong>{enabled ? 'On' : 'Off'}</strong>
    </button>
  );
}
