import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { POSITIONS } from '../data/plays';

const URGENCY_ICONS = { sprint: '⚡', run: '🏃', drift: '↗', hold: '📍' };

export default function ResponsibilityPanel() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { selectedPosition, setSelectedPosition, currentPlay, currentPhase, isMirrored } = useApp();

  const ph = currentPlay?.phases[currentPhase];
  if (!ph) return null;

  const mirSel = isMirrored ? ({ LW: 'RW', RW: 'LW', LD: 'RD', RD: 'LD' }[selectedPosition] || selectedPosition) : selectedPosition;
  const pd = ph.pos[mirSel];

  return (
    <>
      {pd && (
        <div style={{ width: '100%', maxWidth: 390, background: t.sf, borderRadius: 9, border: `2px solid ${t.sc}30`, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: t.sc, color: t.dt, fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>{selectedPosition}</span>
            <div>
              <div style={{ fontSize: 10, color: t.td, fontWeight: 700 }}>YOUR ROLE</div>
              <div style={{ fontSize: 8, color: t.td }}>{URGENCY_ICONS[pd.u] || '•'} {pd.u?.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: (pd.key || pd.comm) ? 7 : 0, color: t.tx }}>{pd.role}</div>
          {pd.key && (
            <div style={{ background: t.cb, borderRadius: 5, padding: '6px 9px', marginBottom: 4, borderLeft: '3px solid #eab308' }}>
              <div style={{ fontSize: 8, color: '#eab308', fontWeight: 700, marginBottom: 1 }}>KEY READ</div>
              <div style={{ fontSize: 10.5, lineHeight: 1.5, color: t.tx }}>{pd.key}</div>
            </div>
          )}
          {pd.comm && (
            <div style={{ background: t.cb, borderRadius: 5, padding: '6px 9px', borderLeft: '3px solid #22c55e' }}>
              <div style={{ fontSize: 8, color: '#22c55e', fontWeight: 700, marginBottom: 1 }}>CALL OUT</div>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>"{pd.comm}"</div>
            </div>
          )}
        </div>
      )}
      <div style={{ width: '100%', maxWidth: 390, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: t.tm, lineHeight: 1.5, padding: '0 3px' }}>{ph.desc}</div>
      </div>
      <div style={{ width: '100%', maxWidth: 390, marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: t.td, fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>ALL POSITIONS</div>
        {POSITIONS.filter(p => p !== 'G').map(pos => {
          const mpos = isMirrored ? ({ LW: 'RW', RW: 'LW', LD: 'RD', RD: 'LD' }[pos] || pos) : pos;
          const d = ph.pos[mpos];
          if (!d) return null;
          const me = pos === selectedPosition;
          return (
            <div
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              style={{
                display: 'flex', gap: 6, alignItems: 'flex-start', padding: '4px 6px', marginBottom: 1,
                borderRadius: 4, cursor: 'pointer',
                background: me ? t.ab : 'transparent',
                borderLeft: me ? `3px solid ${t.sc}` : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color: me ? t.sc : t.pc[pos], minWidth: 20 }}>{pos}</span>
              <span style={{ fontSize: 9.5, color: me ? t.tx : t.td, lineHeight: 1.4 }}>{d.role.length > 70 ? d.role.slice(0, 70) + '…' : d.role}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
