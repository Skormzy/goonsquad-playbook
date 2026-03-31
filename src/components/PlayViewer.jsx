import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import RinkSVG from './RinkSVG';
import PhaseControls from './PhaseControls';
import ResponsibilityPanel from './ResponsibilityPanel';

function phaseColor(title, ac) {
  if (title?.includes('✅')) return '#22c55e';
  if (title?.includes('❌')) return '#ef4444';
  return ac;
}

export default function PlayViewer() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { currentPlay, currentPhase, isMirrored, setStrategyOpen } = useApp();

  const ph = currentPlay?.phases[currentPhase];
  const tot = currentPlay?.phases.length || 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 6px', overflowY: 'auto' }}>
      {/* Play title */}
      <div style={{ textAlign: 'center', marginBottom: 4, width: '100%' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.tx }}>{currentPlay?.n}</div>
        <div style={{ fontSize: 10, color: t.td, marginTop: 1 }}>{currentPlay?.desc}</div>
        <button
          onClick={() => setStrategyOpen(true)}
          style={{ marginTop: 4, padding: '3px 12px', borderRadius: 16, border: `1px solid ${t.ac}`, background: 'none', color: t.ac, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
        >
          📋 Strategy
        </button>
      </div>
      {/* Phase info */}
      <div style={{ textAlign: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: t.tm, letterSpacing: 1, fontFamily: 'monospace' }}>PHASE {currentPhase + 1}/{tot}</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: phaseColor(ph?.t, t.ac), marginTop: 1 }}>
          {ph?.t}{isMirrored ? ' (FLIPPED)' : ''}
        </div>
      </div>
      {/* Rink */}
      <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
        <RinkSVG />
      </div>
      {/* Controls */}
      <PhaseControls />
      {/* Responsibility */}
      <ResponsibilityPanel />
    </div>
  );
}
