import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { POSITIONS, PLAYS } from '../data/plays';

export default function Header() {
  const { theme, themes, toggleTheme } = useTheme();
  const t = themes[theme];
  const { activeView, setActiveView, selectedPosition, setSelectedPosition, showOpponents, setShowOpponents, isMirrored, setIsMirrored, sidebarOpen, setSidebarOpen, setIsPlaying } = useApp();

  const switchView = (view) => {
    if (view === activeView) return;
    setIsPlaying(false);
    if (view === 'tactics') setSidebarOpen(false);
    setActiveView(view);
  };

  const viewTab = (view, label) => ({
    flex: 1, maxWidth: 90, padding: '5px 0', borderRadius: 5, cursor: 'pointer',
    fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: 'monospace',
    border: `2px solid ${activeView === view ? t.ac : t.bd}`,
    background: activeView === view ? t.ab : 'transparent',
    color: activeView === view ? t.ac : t.td,
    transition: 'all .15s',
  });

  return (
    <div style={{ background: t.sf, borderBottom: `1px solid ${t.bd}`, padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {activeView === 'playbook' && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: `1px solid ${t.bd}`, color: t.tm, padding: '4px 9px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: t.ac, lineHeight: 1 }}>THE GOONSQUAD</div>
            <div style={{ fontSize: 8, letterSpacing: 3, color: t.td, fontWeight: 600 }}>PLAYBOOK • {PLAYS.length} PLAYS</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {activeView === 'playbook' && (
            <>
              <button
                onClick={() => setShowOpponents(!showOpponents)}
                style={{ background: showOpponents ? 'rgba(255,45,120,.1)' : 'none', border: `1px solid ${t.bd}`, color: showOpponents ? t.oc : t.td, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}
              >
                {showOpponents ? '◉' : '○'} OPP
              </button>
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                style={{ background: isMirrored ? t.ab : 'none', border: `1px solid ${t.bd}`, color: isMirrored ? t.ac : t.td, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 9, fontWeight: 600 }}
              >
                ↔ FLIP
              </button>
            </>
          )}
          <button
            onClick={toggleTheme}
            style={{ background: 'none', border: `1px solid ${t.bd}`, color: t.td, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 9 }}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>
      </div>
      {/* View tabs */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: activeView === 'playbook' ? 7 : 0 }}>
        <button onClick={() => switchView('playbook')} style={viewTab('playbook', 'PLAYS')}>PLAYS</button>
        <button onClick={() => switchView('tactics')} style={viewTab('tactics', 'TACTICS')}>TACTICS</button>
      </div>
      {/* Position selector (playbook only) */}
      {activeView === 'playbook' && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              style={{
                flex: 1, maxWidth: 50, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 1,
                border: `2px solid ${selectedPosition === pos ? t.sc : t.bd}`,
                background: selectedPosition === pos ? t.ab : t.cb,
                color: selectedPosition === pos ? t.sc : t.tm,
                transition: 'all .15s',
                boxShadow: selectedPosition === pos ? `0 0 8px ${t.sc}33` : 'none',
              }}
            >
              {pos}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
