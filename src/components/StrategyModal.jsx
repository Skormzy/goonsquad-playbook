import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

export default function StrategyModal() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { currentPlay, strategyOpen, setStrategyOpen } = useApp();

  if (!strategyOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={() => setStrategyOpen(false)}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: t.sf, border: `1px solid ${t.bd}`, borderRadius: 12, maxWidth: 520, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: t.ac, fontWeight: 700, letterSpacing: 1 }}>STRATEGY</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.tx }}>{currentPlay?.n}</div>
          </div>
          <button onClick={() => setStrategyOpen(false)} style={{ background: 'none', border: 'none', color: t.tm, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.85, color: t.tx }}>{currentPlay?.strat}</div>
      </div>
    </div>
  );
}
