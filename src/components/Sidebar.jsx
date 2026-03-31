import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { PLAYS, CATEGORIES, DIFFICULTY_COLORS } from '../data/plays';

export default function Sidebar() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { currentPlay, setCurrentPlay, setCurrentPhase, setIsPlaying, setSidebarOpen, setPreviousPositions } = useApp();
  const [cat, setCat] = useState(null);

  const cc = {};
  PLAYS.forEach(p => { cc[p.cat] = (cc[p.cat] || 0) + 1; });
  const fp = cat ? PLAYS.filter(p => p.cat === cat) : PLAYS;

  const pick = p => {
    setPreviousPositions(null);
    setCurrentPlay(p);
    setCurrentPhase(0);
    setIsPlaying(false);
    setSidebarOpen(false);
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 270,
      background: t.sf, borderRight: `1px solid ${t.bd}`, zIndex: 20,
      overflowY: 'auto', padding: 8,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 8 }}>
        <button
          onClick={() => setCat(null)}
          style={{ padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 600, background: !cat ? t.ac : t.cb, color: !cat ? t.dt : t.tm }}
        >
          All ({PLAYS.length})
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            style={{ padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 600, background: cat === c.id ? t.ac : t.cb, color: cat === c.id ? t.dt : t.tm }}
          >
            {c.icon} {c.label} ({cc[c.id] || 0})
          </button>
        ))}
      </div>
      {fp.map(p => (
        <button
          key={p.id}
          onClick={() => pick(p)}
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '7px 8px', marginBottom: 2,
            borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${currentPlay?.id === p.id ? t.sc : t.bd}`,
            background: currentPlay?.id === p.id ? t.ab : t.cb,
            color: currentPlay?.id === p.id ? t.tx : t.tm,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 1 }}>{p.n}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${DIFFICULTY_COLORS[p.d]}22`, color: DIFFICULTY_COLORS[p.d], fontWeight: 700 }}>{p.d.toUpperCase()}</span>
            <span style={{ fontSize: 8, color: t.td }}>{p.phases.length}ph</span>
          </div>
        </button>
      ))}
    </div>
  );
}
