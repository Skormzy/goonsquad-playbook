import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

function phaseColor(title, ac) {
  if (title?.includes('✅')) return '#22c55e';
  if (title?.includes('❌')) return '#ef4444';
  return ac;
}

export default function PhaseControls() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { currentPlay, currentPhase, setCurrentPhase, isPlaying, setIsPlaying, speed, setSpeed, setPreviousPositions, playbackTimerRef } = useApp();

  const tot = currentPlay?.phases.length || 0;

  const go = (n) => {
    if (!currentPlay || n < 0 || n >= tot) return;
    setPreviousPositions(currentPlay.phases[currentPhase]?.pos || null);
    setCurrentPhase(n);
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentPhase >= tot - 1) {
        setPreviousPositions(null);
        setCurrentPhase(0);
        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => { playbackTimerRef.current = null; setIsPlaying(true); }, 80);
      } else {
        setIsPlaying(true);
      }
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', margin: '6px 0' }}>
        <button
          onClick={() => go(currentPhase - 1)}
          disabled={currentPhase === 0}
          style={{ padding: '6px 10px', borderRadius: 5, border: `1px solid ${t.bd}`, background: t.cb, color: currentPhase === 0 ? t.td : t.tx, cursor: currentPhase === 0 ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}
        >◀</button>
        <button
          onClick={togglePlay}
          style={{ padding: '6px 16px', borderRadius: 5, border: `2px solid ${t.ac}`, background: isPlaying ? t.ac : 'transparent', color: isPlaying ? t.dt : t.ac, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
        >{isPlaying ? '⏸' : '▶'}</button>
        <button
          onClick={() => go(currentPhase + 1)}
          disabled={currentPhase >= tot - 1}
          style={{ padding: '6px 10px', borderRadius: 5, border: `1px solid ${t.bd}`, background: t.cb, color: currentPhase >= tot - 1 ? t.td : t.tx, cursor: currentPhase >= tot - 1 ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}
        >▶</button>
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          style={{ padding: '3px', borderRadius: 4, border: `1px solid ${t.bd}`, background: t.cb, color: t.tm, fontSize: 9, cursor: 'pointer' }}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {currentPlay?.phases.map((p, i) => {
          const c = phaseColor(p.t, t.ac);
          return (
            <button
              key={i}
              onClick={() => go(i)}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                background: i === currentPhase ? c : i < currentPhase ? t.tm : t.bd,
                boxShadow: i === currentPhase ? `0 0 4px ${c}` : 'none',
              }}
            />
          );
        })}
      </div>
    </>
  );
}
