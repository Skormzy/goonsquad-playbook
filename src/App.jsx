import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from './context/ThemeContext';
import { useApp } from './context/AppContext';
import { PLAYS } from './data/plays';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PlayViewer from './components/PlayViewer';
import StrategyModal from './components/StrategyModal';
import TacticsLearn from './components/TacticsLearn';

export default function App() {
  const { theme, themes, toggleTheme } = useTheme();
  const t = themes[theme];
  const {
    activeView,
    currentPlay, setCurrentPlay, currentPhase, setCurrentPhase,
    isPlaying, setIsPlaying, isMirrored, setIsMirrored,
    showOpponents, setShowOpponents, sidebarOpen,
    speed, setPreviousPositions, cancelPlaybackRestart,
  } = useApp();

  const intervalRef = useRef(null);
  const tot = currentPlay?.phases.length || 0;

  // Initialize first play
  useEffect(() => {
    if (!currentPlay && PLAYS.length > 0) {
      setCurrentPlay(PLAYS[0]);
    }
  }, [currentPlay, setCurrentPlay]);

  // Navigate phases
  const go = useCallback((n) => {
    cancelPlaybackRestart();
    if (!currentPlay || n < 0 || n >= tot) return;
    setPreviousPositions(currentPlay.phases[currentPhase]?.pos || null);
    setCurrentPhase(n);
  }, [currentPlay, currentPhase, tot, setPreviousPositions, setCurrentPhase, cancelPlaybackRestart]);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentPhase(p => {
          if (p >= tot - 1) {
            setIsPlaying(false);
            return p;
          }
          setPreviousPositions(currentPlay.phases[p]?.pos || null);
          return p + 1;
        });
      }, 2500 / speed);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, tot, currentPlay, speed, setCurrentPhase, setIsPlaying, setPreviousPositions]);

  // Keyboard shortcuts (playbook mode only — tactics has its own)
  useEffect(() => {
    if (activeView !== 'playbook') return;
    const handler = (e) => {
      if (e.key === 'ArrowRight') go(currentPhase + 1);
      else if (e.key === 'ArrowLeft') go(currentPhase - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        cancelPlaybackRestart();
        setIsPlaying(p => !p);
      }
      else if (e.key === 'm') setIsMirrored(m => !m);
      else if (e.key === 'o') setShowOpponents(o => !o);
      else if (e.key === 't') toggleTheme();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView, currentPhase, go, setIsPlaying, setIsMirrored, setShowOpponents, toggleTheme, cancelPlaybackRestart]);

  return (
    <div style={{
      fontFamily: "'Trebuchet MS','Lucida Grande',sans-serif",
      background: t.bg, color: t.tx, minHeight: '100vh',
      display: 'flex', flexDirection: 'column', transition: 'background .3s',
    }}>
      <StrategyModal />
      <Header />
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        {activeView === 'playbook' ? (
          <>
            {sidebarOpen && <Sidebar />}
            <PlayViewer />
          </>
        ) : (
          <TacticsLearn />
        )}
      </div>
    </div>
  );
}
